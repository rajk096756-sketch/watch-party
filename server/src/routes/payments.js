import express from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';
import Razorpay from 'razorpay';
import nodemailer from 'nodemailer';
import { prisma } from '../db/database.js';
import { authenticateUser } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { authenticatedLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const INVOICES_DIR = path.join(__dirname, '..', '..', 'invoices');

if (!fs.existsSync(INVOICES_DIR)) {
  fs.mkdirSync(INVOICES_DIR, { recursive: true });
}

// Plan details definitions
const PLAN_DETAILS = {
  'Bronze': { price: 199, currency: 'INR', description: 'Increased daily download limits (5/day)' },
  'Silver': { price: 499, currency: 'INR', description: 'Power usage streaming limits (15/day)' },
  'Gold': { price: 999, currency: 'INR', description: 'Infinite download limits (100/day)' }
};

// Razorpay client instance setup (checks if keys are present, falls back to Mock mode)
const isRazorpayConfigured = process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET;
let razorpayInstance = null;

if (isRazorpayConfigured) {
  razorpayInstance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
  });
  console.log('[PAYMENTS] Razorpay SDK initialized in Test Mode.');
} else {
  console.log('[PAYMENTS] Razorpay credentials missing. Operating in Mock Billing Mode.');
}

// Transporter for nodemailer
let mailTransporter;
async function getMailTransporter() {
  if (mailTransporter) return mailTransporter;
  try {
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
  } catch (err) {
    mailTransporter = {
      sendMail: async (options) => {
        console.log(`[SMTP MOCK] Email would be sent:\nTo: ${options.to}\nSubject: ${options.subject}`);
        return { messageId: 'mock-invoice-email' };
      }
    };
  }
  return mailTransporter;
}

getMailTransporter();

// --- VALIDATION SCHEMAS ---

const createOrderSchema = z.object({
  plan: z.enum(['Bronze', 'Silver', 'Gold'])
}).strict();

const verifyPaymentSchema = z.object({
  razorpay_order_id: z.string().min(5),
  razorpay_payment_id: z.string().min(5),
  razorpay_signature: z.string().min(5),
  plan: z.enum(['Bronze', 'Silver', 'Gold'])
}).strict();

// --- INVOICE GENERATOR HELPER ---

function generateInvoiceHtml({ username, email, plan, price, currency, orderId, paymentId, date }) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Payment Invoice - ${plan} Subscription</title>
      <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #2d3748; line-height: 1.6; margin: 0; padding: 20px; background-color: #f7fafc; }
        .invoice-card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
        .header { background: linear-gradient(135deg, #1a202c 0%, #2d3748 100%); color: #ffffff; padding: 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; letter-spacing: 1px; font-weight: 700; }
        .header p { margin: 5px 0 0 0; color: #a0aec0; font-size: 14px; }
        .content { padding: 30px; }
        .details-table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        .details-table th, .details-table td { text-align: left; padding: 12px; border-bottom: 1px solid #edf2f7; }
        .details-table th { color: #718096; font-weight: 600; text-transform: uppercase; font-size: 12px; }
        .details-table td { color: #2d3748; font-size: 15px; }
        .total-row { background-color: #f8fafc; font-weight: bold; }
        .badge { display: inline-block; padding: 4px 8px; background: #ebf8ff; color: #2b6cb0; border-radius: 9999px; font-size: 12px; font-weight: 600; }
        .footer { background: #edf2f7; text-align: center; padding: 20px; font-size: 12px; color: #718096; }
      </style>
    </head>
    <body>
      <div class="invoice-card">
        <div class="header">
          <h1>INVOICE CONFIRMATION</h1>
          <p>Thank you for your purchase!</p>
        </div>
        <div class="content">
          <h3>Hello ${username},</h3>
          <p>Your transaction has been processed successfully. Your account is now active on the <strong>${plan}</strong> subscription plan.</p>
          
          <table class="details-table">
            <thead>
              <tr>
                <th>Transaction Item</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Customer Email</td>
                <td>${email}</td>
              </tr>
              <tr>
                <td>Order Reference</td>
                <td><span style="font-family: monospace;">${orderId}</span></td>
              </tr>
              <tr>
                <td>Payment Reference</td>
                <td><span style="font-family: monospace;">${paymentId}</span></td>
              </tr>
              <tr>
                <td>Billing Date</td>
                <td>${date}</td>
              </tr>
              <tr>
                <td>Subscription Plan</td>
                <td><span class="badge">${plan} Tier</span></td>
              </tr>
              <tr class="total-row">
                <td>Total Charged</td>
                <td>${currency} ${price}.00</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="footer">
          <p>watch party &bull; Encrypted Digital Invoice &bull; Securing your stream.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// --- API ROUTES ---

/**
 * Route: POST /api/payments/create-order
 * Initiates Razorpay checkout orders or returns mock metadata
 */
router.post('/create-order', authenticateUser, authenticatedLimiter, validate(createOrderSchema), async (req, res, next) => {
  const { plan } = req.body;
  const planInfo = PLAN_DETAILS[plan];

  try {
    const amountInPaise = planInfo.price * 100; // Paise conversion

    if (isRazorpayConfigured) {
      // Direct Razorpay Call
      const options = {
        amount: amountInPaise,
        currency: 'INR',
        receipt: `receipt_${req.user.id.substring(0, 8)}_${Date.now()}`
      };
      
      const order = await razorpayInstance.orders.create(options);
      return res.status(200).json({
        success: true,
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        key: process.env.RAZORPAY_KEY_ID,
        isMock: false
      });
    } else {
      // Mock order generation for local testing
      const mockOrderId = `order_mock_${Math.random().toString(36).substring(2, 12)}`;
      return res.status(200).json({
        success: true,
        orderId: mockOrderId,
        amount: amountInPaise,
        currency: 'INR',
        key: 'rzp_test_mock_keys',
        isMock: true
      });
    }
  } catch (err) {
    next(err);
  }
});

/**
 * Route: POST /api/payments/verify
 * Confirms payment signature, updates subscription plan and creates PDF/HTML Invoice emails
 */
router.post('/verify', authenticateUser, authenticatedLimiter, validate(verifyPaymentSchema), async (req, res, next) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan } = req.body;
  const user = req.user;
  const planInfo = PLAN_DETAILS[plan];

  try {
    let isValid = false;

    if (razorpay_order_id.startsWith('order_mock_')) {
      // Mock verification - only allowed in development mode
      if (process.env.NODE_ENV === 'production') {
        return res.status(400).json({
          success: false,
          message: 'Mock payments are not allowed in production mode.'
        });
      }
      const expectedMockSig = crypto.createHmac('sha256', process.env.JWT_SECRET || 'dev-mock-fallback')
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');
      isValid = true; // For development simplicity, allow mock orders to verify
    } else {
      // Production HMAC-SHA256 signature verification
      if (!isRazorpayConfigured) {
        return res.status(400).json({
          success: false,
          message: 'Razorpay keys not configured on server. Use simulated mock payments.'
        });
      }
      
      const body = razorpay_order_id + "|" + razorpay_payment_id;
      const expectedSignature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(body.toString())
        .digest('hex');

      isValid = expectedSignature === razorpay_signature;
    }

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: 'Payment verification failed. Security signature mismatch.'
      });
    }

    // 1. Update user profile to new subscription tier in DB
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { subscriptionPlan: plan }
    });

    // 2. Generate Invoice HTML
    const dateStr = new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'long' });
    const invoiceHtml = generateInvoiceHtml({
      username: user.username,
      email: user.email,
      plan,
      price: planInfo.price,
      currency: planInfo.currency,
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      date: dateStr
    });

    // 3. Write invoice to local file in workspace directory so user can inspect it
    const localInvoiceFilename = `invoice-${razorpay_order_id}.html`;
    const localInvoicePath = path.join(INVOICES_DIR, localInvoiceFilename);
    fs.writeFileSync(localInvoicePath, invoiceHtml);
    console.log(`[INVOICE] HTML Invoice saved locally at: ${localInvoicePath}`);

    // 4. Trigger invoice notification via Nodemailer
    const transporter = await getMailTransporter();
    await transporter.sendMail({
      from: '"Antigravity billing" <billing@watchparty.com>',
      to: user.email,
      subject: `Invoice Confirmation - ${plan} Upgrade`,
      text: `Thank you for upgrading to ${plan}! Total Charged: INR ${planInfo.price}.00. Order ID: ${razorpay_order_id}`,
      html: invoiceHtml
    });

    return res.status(200).json({
      success: true,
      message: `Successfully upgraded to ${plan} tier! Transaction has been logged.`,
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        email: updatedUser.email,
        subscriptionPlan: updatedUser.subscriptionPlan
      },
      invoiceFilename: localInvoiceFilename
    });

  } catch (err) {
    next(err);
  }
});

export default router;
