// In-memory store for rate limiting and backoff tracking
const authStore = {
  ip: {},      // IP -> { attempts: 0, lastAttempt: Date, blockUntil: Date }
  account: {}  // Account (email/username) -> { attempts: 0, lastAttempt: Date, blockUntil: Date }
};

// General rate limiter store
const generalStore = {};

/**
 * Custom Rate Limiter for general endpoints
 */
export function ipLimiter({ limit, windowMs, message }) {
  return (req, res, next) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const now = Date.now();

    if (!generalStore[ip]) {
      generalStore[ip] = [];
    }

    // Filter requests outside window
    generalStore[ip] = generalStore[ip].filter(timestamp => now - timestamp < windowMs);

    if (generalStore[ip].length >= limit) {
      return res.status(429).json({
        success: false,
        message: message || 'Too many requests from this IP. Please try again later.'
      });
    }

    generalStore[ip].push(now);
    next();
  };
}

/**
 * Public Endpoint Rate Limiter (Moderate: 100 requests per 15 minutes)
 */
export const publicLimiter = ipLimiter({
  limit: 100,
  windowMs: 15 * 60 * 1000,
  message: 'Moderate public endpoint rate limit exceeded.'
});

/**
 * Authenticated Action Rate Limiter (Relaxed: 500 requests per 15 minutes)
 */
export const authenticatedLimiter = ipLimiter({
  limit: 500,
  windowMs: 15 * 60 * 1000,
  message: 'Authenticated action rate limit exceeded.'
});

/**
 * Auth Route Rate Limiter with Exponential Backoff
 * Handles checking whether the IP or Account is currently blocked.
 */
export function authRateLimiter(req, res, next) {
  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const account = req.body.email || req.body.username; // track either email or username
  const now = new Date();

  // 1. Check IP-based block
  if (authStore.ip[ip] && authStore.ip[ip].blockUntil && authStore.ip[ip].blockUntil > now) {
    const waitTime = Math.ceil((authStore.ip[ip].blockUntil - now) / 1000);
    return res.status(429).json({
      success: false,
      message: `Too many login attempts from this device. Please wait ${waitTime} seconds.`
    });
  }

  // 2. Check Account-based block
  if (account && authStore.account[account] && authStore.account[account].blockUntil && authStore.account[account].blockUntil > now) {
    const waitTime = Math.ceil((authStore.account[account].blockUntil - now) / 1000);
    return res.status(429).json({
      success: false,
      message: `Too many login attempts for this account. Please wait ${waitTime} seconds.`
    });
  }

  next();
}

/**
 * Record a failed auth attempt to calculate exponential backoff
 */
export function recordAuthFailure(ip, account) {
  const now = new Date();
  
  // Update IP attempts
  if (!authStore.ip[ip]) {
    authStore.ip[ip] = { attempts: 0, lastAttempt: now, blockUntil: null };
  }
  const ipData = authStore.ip[ip];
  ipData.attempts += 1;
  ipData.lastAttempt = now;
  if (ipData.attempts >= 3) {
    // Backoff formula: 2^(attempts-3) * 5 seconds. (attempts=3: 5s, attempts=4: 10s, attempts=5: 20s...) Max 1 hour
    const seconds = Math.min(Math.pow(2, ipData.attempts - 3) * 5, 3600);
    ipData.blockUntil = new Date(now.getTime() + seconds * 1000);
  }

  // Update Account attempts
  if (account) {
    if (!authStore.account[account]) {
      authStore.account[account] = { attempts: 0, lastAttempt: now, blockUntil: null };
    }
    const accData = authStore.account[account];
    accData.attempts += 1;
    accData.lastAttempt = now;
    if (accData.attempts >= 3) {
      const seconds = Math.min(Math.pow(2, accData.attempts - 3) * 5, 3600);
      accData.blockUntil = new Date(now.getTime() + seconds * 1000);
    }
  }
}

/**
 * Reset auth attempts on successful login
 */
export function recordAuthSuccess(ip, account) {
  if (authStore.ip[ip]) {
    delete authStore.ip[ip];
  }
  if (account && authStore.account[account]) {
    delete authStore.account[account];
  }
}
