/**
 * Rate Limiting Middleware
 * Simple in-memory rate limiter (per-process). For distributed setups, use Redis.
 * 
 * SECURITY: This module provides critical protection against:
 * - Brute force attacks on login
 * - Password reset flooding
 * - Account enumeration attempts
 */

const buckets = new Map();

// Cleanup old entries periodically to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets.entries()) {
    const filtered = bucket.filter(ts => ts > now - 3600000); // Keep last hour
    if (filtered.length === 0) {
      buckets.delete(key);
    } else {
      buckets.set(key, filtered);
    }
  }
}, 300000); // Clean every 5 minutes

/**
 * Generic rate limiter factory
 * @param {Object} options - Rate limit configuration
 * @param {number} options.windowMs - Time window in milliseconds
 * @param {number} options.max - Maximum requests per window
 * @param {function} options.keyGenerator - Function to generate rate limit key
 * @param {string} options.message - Custom error message
 */
function rateLimit({ windowMs = 60_000, max = 60, keyGenerator, message } = {}) {
  return (req, res, next) => {
    try {
      const now = Date.now();
      const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
        req.ip ||
        req.socket.remoteAddress ||
        'unknown';
      const key = (keyGenerator ? keyGenerator(req) : ip) + '|' + req.path;
      const bucket = buckets.get(key) || [];

      // Prune old entries
      const cutoff = now - windowMs;
      const recent = bucket.filter(ts => ts > cutoff);

      if (recent.length >= max) {
        const retryAfter = Math.ceil((recent[0] + windowMs - now) / 1000);
        res.set('Retry-After', retryAfter);
        return res.status(429).json({
          success: false,
          message: message || 'Too many requests. Please try again later.',
          retryAfter: retryAfter
        });
      }

      recent.push(now);
      buckets.set(key, recent);
      next();
    } catch (e) {
      console.error('Rate limit error:', e);
      next(); // Fail open but log error
    }
  };
}

/**
 * Strict rate limiter for login attempts
 * Prevents brute force password attacks
 * 5 attempts per 15 minutes per IP
 */
const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: 'Too many login attempts. Please try again in 15 minutes.',
  keyGenerator: (req) => {
    // Rate limit by IP + email to prevent distributed attacks
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.ip ||
      req.socket.remoteAddress ||
      'unknown';
    const email = req.body?.email?.toLowerCase() || 'unknown';
    return `login:${ip}:${email}`;
  }
});

/**
 * Rate limiter for password reset requests
 * Prevents reset token flooding
 * 3 attempts per hour per IP
 */
const passwordResetRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  message: 'Too many password reset requests. Please try again in an hour.'
});

/**
 * Rate limiter for registration
 * Prevents mass account creation
 * 10 attempts per hour per IP
 */
const registrationRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: 'Too many registration attempts. Please try again later.'
});

/**
 * Rate limiter for verification email resends
 * 5 attempts per hour
 */
const verificationRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: 'Too many verification email requests. Please try again later.'
});

/**
 * General API rate limiter
 * 100 requests per minute for general endpoints
 */
const apiRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  message: 'Too many requests. Please slow down.'
});

/**
 * Rate limiter for invoice creation
 * Prevents abuse of invoice creation
 * 10 invoices per hour per user
 */
const invoiceCreateRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: 'Too many invoices created. Please try again later.',
  keyGenerator: (req) => {
    // Rate limit by user ID
    const userId = req.user?._id || 'unknown';
    return `invoice-create:${userId}`;
  }
});

/**
 * Rate limiter for sending reminders
 * Prevents email spam abuse
 * 20 reminders per hour per user
 */
const reminderRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  message: 'Too many reminders sent. Please try again later.',
  keyGenerator: (req) => {
    const userId = req.user?._id || 'unknown';
    return `reminder:${userId}`;
  }
});

/**
 * Rate limiter for general invoice API operations
 * 60 requests per minute
 */
const invoiceApiRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  message: 'Too many invoice requests. Please slow down.'
});

module.exports = {
  rateLimit,
  loginRateLimit,
  passwordResetRateLimit,
  registrationRateLimit,
  verificationRateLimit,
  apiRateLimit,
  invoiceCreateRateLimit,
  reminderRateLimit,
  invoiceApiRateLimit
};

