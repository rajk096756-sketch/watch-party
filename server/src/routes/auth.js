import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import nodemailer from 'nodemailer';
import twilio from 'twilio';
import { prisma } from '../db/database.js';
import { validate } from '../middleware/validate.js';
import { authRateLimiter, recordAuthFailure, recordAuthSuccess } from '../middleware/rateLimiter.js';
import { secureAvatarUpload, serveAvatarSecurely } from '../middleware/fileUpload.js';
import { authenticateUser } from '../middleware/auth.js';

const router = express.Router();

// Transporter for nodemailer (using ethereal test credentials or configured SMTP)
let mailTransporter;
async function getMailTransporter() {
  if (mailTransporter) return mailTransporter;
  
  // Check if real SMTP credentials are provided in .env
  const hasRealSmtp = process.env.SMTP_HOST && 
                      process.env.SMTP_PORT && 
                      process.env.SMTP_USER && 
                      process.env.SMTP_PASS &&
                      process.env.SMTP_USER !== 'mock_user@ethereal.email';
  
  try {
    if (hasRealSmtp) {
      // Use configured SMTP from .env
      mailTransporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT),
        secure: parseInt(process.env.SMTP_PORT) === 465, // SSL for 465, TLS for 587
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
      console.log(`[SMTP] Production SMTP initialized. Host: ${process.env.SMTP_HOST}`);
    } else {
      // Use Ethereal test account for development
      const account = await nodemailer.createTestAccount();
      mailTransporter = nodemailer.createTransport({
        host: account.smtp.host,
        port: account.smtp.port,
        secure: account.smtp.secure,
        auth: {
          user: account.user,
          pass: account.pass,
        },
      });
      console.log(`[SMTP] Test SMTP initialized. Mail user: ${account.user}`);
      console.log(`[SMTP] Ethereal preview URL: https://ethereal.email/messages`);
    }
  } catch (err) {
    console.error('[SMTP] Failed to initialize email transporter:', err.message);
    console.warn('[SMTP] Falling back to console logging for email dispatch.');
    mailTransporter = {
      sendMail: async (options) => {
        console.log(`[SMTP MOCK] Email would be sent:\nTo: ${options.to}\nSubject: ${options.subject}\nBody:\n${options.text || options.html}`);
        return { messageId: 'mock-id-' + Date.now() };
      }
    };
  }
  return mailTransporter;
}

// Ensure SMTP loads in background
getMailTransporter();

// Twilio client for SMS OTP
function getTwilioClient() {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_PHONE_NUMBER) {
    console.warn('[SMS] Twilio credentials not configured. SMS will be logged to console only.');
    return null;
  }
  return twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

// Send SMS OTP
async function sendSmsOtp(phoneNumber, otpCode) {
  const client = getTwilioClient();
  
  if (!client) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[SMS MOCK] SMS would be sent to ${phoneNumber}: Your OTP code is ${otpCode}`);
      console.log('================================================');
      console.log(`[DEV ONLY] SMS OTP Generated for ${phoneNumber}: ${otpCode}`);
      console.log('================================================');
    }
    return true;
  }
  
  try {
    await client.messages.create({
      body: `Your Watch Party OTP code is: ${otpCode}. Valid for 5 minutes.`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phoneNumber
    });
    console.log(`[SMS] OTP sent successfully to ${phoneNumber}`);
    return true;
  } catch (err) {
    console.error('[SMS] Failed to send OTP:', err.message);
    if (process.env.NODE_ENV === 'development') {
      console.log(`[SMS MOCK] SMS would be sent to ${phoneNumber}: Your OTP code is ${otpCode}`);
      console.log('================================================');
      console.log(`[DEV ONLY] SMS OTP Generated for ${phoneNumber}: ${otpCode}`);
      console.log('================================================');
    }
    return false;
  }
}

// Server-side IP location resolver
// In development, can use simulated headers for testing (disabled in production)
async function resolveIpLocation(req) {
  if (process.env.NODE_ENV === 'development') {
    const city = req.headers['x-simulate-city'] || 'Mumbai';
    const state = req.headers['x-simulate-state'] || 'Maharashtra';
    const country = req.headers['x-simulate-country'] || 'India';
    return { city, state, country };
  }
  
  // In production, use real IP-based location detection
  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const geoipService = process.env.GEOIP_SERVICE || 'ipapi';
  const geoipApiKey = process.env.GEOIP_API_KEY;
  
  if (geoipApiKey && geoipService === 'ipapi') {
    try {
      const response = await fetch(`https://ipapi.co/${ip}/json/?key=${geoipApiKey}`);
      const data = await response.json();
      if (data.city && data.region && data.country_name) {
        return { 
          city: data.city, 
          state: data.region, 
          country: data.country_name 
        };
      }
    } catch (err) {
      console.error('[GEOIP] Failed to fetch location:', err.message);
    }
  }
  
  // Fallback to unknown if geo-IP fails or not configured
  return { city: 'Unknown', state: 'Unknown', country: 'Unknown' };
}

// --- STRICT VALIDATION SCHEMAS ---

const signupSchema = z.object({
  email: z.string().email().min(5).max(100).toLowerCase(),
  phoneNumber: z.string().regex(/^[+]?[0-9]{10,15}$/).optional(),
  username: z.string().regex(/^[a-zA-Z0-9_]+$/).min(3).max(30),
  password: z.string().min(8).max(50),
  deviceFingerprint: z.string().min(5).max(200),
}).strict();

const loginSchema = z.object({
  emailOrUsername: z.string().min(3).max(100).toLowerCase(),
  password: z.string().min(6).max(50),
  deviceFingerprint: z.string().min(5).max(200),
}).strict();

const otpVerifySchema = z.object({
  userId: z.string().uuid(),
  code: z.string().regex(/^\d{6}$/, "OTP must be exactly 6 digits"),
  deviceFingerprint: z.string().min(5).max(200),
}).strict();

// --- HELPER FUNCTION: GENERATE JWT ---
function generateToken(userId, email) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('Server configuration error: JWT_SECRET not set.');
  }
  return jwt.sign(
    { userId, email },
    secret,
    { expiresIn: '7d' }
  );
}

// --- CONTROLLERS ---

/**
 * Route: POST /api/auth/signup
 */
router.post('/signup', authRateLimiter, validate(signupSchema), async (req, res, next) => {
  const { email, phoneNumber, username, password, deviceFingerprint } = req.body;
  const { city, state, country } = await resolveIpLocation(req);
  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  try {
    // Check if user already exists
    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }]
      }
    });

    if (existing) {
      recordAuthFailure(ip, email);
      return res.status(400).json({
        success: false,
        message: 'Registration failed. Email or username already registered.'
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const newUser = await prisma.user.create({
      data: {
        email,
        phoneNumber,
        username,
        passwordHash,
        deviceFingerprints: {
          create: { fingerprint: deviceFingerprint }
        },
        loginLocations: {
          create: { city, state, country }
        }
      }
    });

    recordAuthSuccess(ip, email);
    const token = generateToken(newUser.id, newUser.email);

    return res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        username: newUser.username,
        subscriptionPlan: newUser.subscriptionPlan,
        themePreference: newUser.themePreference,
        shareLocation: newUser.shareLocation
      }
    });

  } catch (err) {
    next(err);
  }
});

/**
 * Route: POST /api/auth/login
 */
router.post('/login', authRateLimiter, validate(loginSchema), async (req, res, next) => {
  const { emailOrUsername, password, deviceFingerprint } = req.body;
  const { city, state, country } = await resolveIpLocation(req);
  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  try {
    // Load user (supports both email and username)
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: emailOrUsername },
          { username: emailOrUsername }
        ]
      },
      include: {
        deviceFingerprints: true,
        loginLocations: true
      }
    });

    if (!user) {
      recordAuthFailure(ip, emailOrUsername);
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials provided.'
      });
    }

    // Check password
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      recordAuthFailure(ip, emailOrUsername);
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials provided.'
      });
    }

    // --- ANOMALOUS LOGIN CHECK ---
    let isAnomalous = false;
    let reason = [];

    // Check device fingerprint
    const knownFingerprints = user.deviceFingerprints.map(df => df.fingerprint);
    if (knownFingerprints.length > 0 && !knownFingerprints.includes(deviceFingerprint)) {
      isAnomalous = true;
      reason.push('unrecognized device');
    }

    // Check city and state location
    const knownLocations = user.loginLocations;
    if (knownLocations.length > 0) {
      const matchCity = knownLocations.some(loc => loc.city.toLowerCase() === city.toLowerCase());
      const matchState = knownLocations.some(loc => loc.state.toLowerCase() === state.toLowerCase());
      
      if (!matchCity || !matchState) {
        isAnomalous = true;
        reason.push(`new location detected: ${city}, ${state}`);
      }
    }

    if (isAnomalous) {
      // Create OTP
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digits
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes validity

      await prisma.oTP.create({
        data: {
          userId: user.id,
          code: otpCode,
          expiresAt
        }
      });

      // Send via SMTP with fail-safe error handling
      const transporter = await getMailTransporter();
      let emailResult = null;
      try {
        emailResult = await transporter.sendMail({
          from: '"watch party" <no-reply@watchparty.com>',
          to: user.email,
          subject: 'Anomalous Login Alert - OTP Verification',
          text: `We detected a login attempt with: ${reason.join(' & ')}\n\nYour 6-digit OTP code is: ${otpCode}\nThis code is valid for 5 minutes.`,
          html: `
            <div style="font-family: sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 8px; max-width: 500px;">
              <h2 style="color: #e53e3e;">Security Alert: Anomalous Login Detected</h2>
              <p>We noticed a login attempt with: <strong>${reason.join(' & ')}</strong>.</p>
              <p>To verify it is you, please enter the following One-Time Password (OTP) code on the verification screen:</p>
              <div style="font-size: 28px; font-weight: bold; background: #f7fafc; padding: 15px; border-radius: 4px; text-align: center; margin: 20px 0; border: 1px dashed #cbd5e0; color: #2d3748; letter-spacing: 4px;">
                ${otpCode}
              </div>
              <p style="color: #718096; font-size: 12px;">If this wasn't you, please change your password immediately.</p>
            </div>
          `
        });
        console.log(`[SMTP] OTP email sent successfully to ${user.email}`);
        if (emailResult && emailResult.messageId) {
          console.log(`[SMTP] Message ID: ${emailResult.messageId}`);
        }
        // Log Ethereal preview URL if using test account
        if (emailResult && emailResult.previewUrl) {
          console.log(`[SMTP] Preview email at: ${emailResult.previewUrl}`);
        }
      } catch (emailErr) {
        console.error('[SMTP] Failed to send OTP email:', emailErr.message);
        console.error('[SMTP] Error details:', emailErr);
        // Continue with login flow even if email fails - OTP is still in DB
      }

      // Also send SMS if phone number is available
      if (user.phoneNumber) {
        await sendSmsOtp(user.phoneNumber, otpCode);
      }

      // Development environment: Log OTP to console for testing
      if (process.env.NODE_ENV === 'development') {
        console.log('================================================');
        console.log(`[DEV ONLY] MFA OTP Generated for ${user.email}: ${otpCode}`);
        if (user.phoneNumber) {
          console.log(`[DEV ONLY] SMS OTP Generated for ${user.phoneNumber}: ${otpCode}`);
        }
        console.log('================================================');
      }

      console.log(`[SECURITY] Anomalous login for user ${user.username}. Reason: ${reason.join(', ')}.`);

      return res.status(200).json({
        success: true,
        otpRequired: true,
        userId: user.id,
        hasPhone: !!user.phoneNumber,
        message: user.phoneNumber 
          ? 'Anomalous login detected. Verification code sent to email and phone.'
          : 'Anomalous login detected. Verification code sent to email.'
      });
    }

    // Save location and fingerprint if they aren't fully recorded, but match existing general patterns
    const hasLocation = user.loginLocations.some(loc => loc.city === city && loc.state === state);
    if (!hasLocation) {
      await prisma.loginLocation.create({
        data: { userId: user.id, city, state, country }
      });
    }
    const hasFingerprint = user.deviceFingerprints.some(df => df.fingerprint === deviceFingerprint);
    if (!hasFingerprint) {
      await prisma.deviceFingerprint.create({
        data: { userId: user.id, fingerprint: deviceFingerprint }
      });
    }

    recordAuthSuccess(ip, emailOrUsername);
    const token = generateToken(user.id, user.email);

    return res.status(200).json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        subscriptionPlan: user.subscriptionPlan,
        themePreference: user.themePreference,
        shareLocation: user.shareLocation
      }
    });

  } catch (err) {
    next(err);
  }
});

/**
 * Route: POST /api/auth/verify-otp
 */
router.post('/verify-otp', authRateLimiter, validate(otpVerifySchema), async (req, res, next) => {
  const { userId, code, deviceFingerprint } = req.body;
  const { city, state, country } = await resolveIpLocation(req);
  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  try {
    const otp = await prisma.oTP.findFirst({
      where: {
        userId,
        code,
        verified: false,
        expiresAt: { gt: new Date() }
      },
      include: {
        user: true
      }
    });

    if (!otp) {
      recordAuthFailure(ip, `userId:${userId}`);
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP code.'
      });
    }

    // Mark OTP verified
    await prisma.oTP.update({
      where: { id: otp.id },
      data: { verified: true }
    });

    // Save location & fingerprint to prevent future anomalies for this device/locale
    await prisma.loginLocation.create({
      data: { userId, city, state, country }
    });
    await prisma.deviceFingerprint.create({
      data: { userId, fingerprint: deviceFingerprint }
    });

    recordAuthSuccess(ip, otp.user.email);
    const token = generateToken(otp.user.id, otp.user.email);

    return res.status(200).json({
      success: true,
      token,
      user: {
        id: otp.user.id,
        email: otp.user.email,
        username: otp.user.username,
        subscriptionPlan: otp.user.subscriptionPlan,
        themePreference: otp.user.themePreference,
        shareLocation: otp.user.shareLocation
      }
    });

  } catch (err) {
    next(err);
  }
});

/**
 * Route: POST /api/auth/avatar
 * Secure file upload route for avatars
 */
router.post('/avatar', authenticateUser, secureAvatarUpload, async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    const avatarUrl = `/api/auth/avatar/${req.file.savedName}`;
    
    // Update user profile in DB
    await prisma.user.update({
      where: { id: req.user.id },
      data: { avatarUrl }
    });

    return res.status(200).json({
      success: true,
      message: 'Avatar uploaded and verified successfully.',
      avatarUrl
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Route: GET /api/auth/avatar/:filename
 * Serves uploads securely using read stream with execution stripped
 */
router.get('/avatar/:filename', serveAvatarSecurely);

/**
 * Route: GET /api/auth/me
 * Validate current token and fetch details
 */
router.get('/me', authenticateUser, (req, res) => {
  return res.status(200).json({
    success: true,
    user: {
      id: req.user.id,
      email: req.user.email,
      username: req.user.username,
      subscriptionPlan: req.user.subscriptionPlan,
      themePreference: req.user.themePreference,
      shareLocation: req.user.shareLocation,
      avatarUrl: req.user.avatarUrl,
      preferredLocale: req.user.preferredLocale,
      createdAt: req.user.createdAt
    }
  });
});

/**
 * Route: PUT /api/auth/profile
 * Update user options (theme preference, share location toggle, locale)
 */
const profileUpdateSchema = z.object({
  themePreference: z.enum(['system', 'light', 'dark']).optional(),
  shareLocation: z.boolean().optional(),
  preferredLocale: z.string().min(2).max(10).optional(),
  notifEmail: z.boolean().optional(),
  notifPush: z.boolean().optional()
}).strict();

router.put('/profile', authenticateUser, validate(profileUpdateSchema), async (req, res, next) => {
  const { themePreference, shareLocation, preferredLocale, notifEmail, notifPush } = req.body;
  try {
    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        ...(themePreference !== undefined && { themePreference }),
        ...(shareLocation !== undefined && { shareLocation }),
        ...(preferredLocale !== undefined && { preferredLocale }),
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Profile options updated.',
      user: {
        id: updated.id,
        email: updated.email,
        username: updated.username,
        subscriptionPlan: updated.subscriptionPlan,
        themePreference: updated.themePreference,
        shareLocation: updated.shareLocation,
        avatarUrl: updated.avatarUrl,
        preferredLocale: updated.preferredLocale,
        createdAt: updated.createdAt,
        notifEmail: notifEmail ?? true,
        notifPush: notifPush ?? true
      }
    });
  } catch (err) {
    next(err);
  }
});

export default router;
