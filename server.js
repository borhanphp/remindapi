const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const errorHandler = require('./middleware/error');
const { startScheduledTasks } = require('./utils/scheduledTasks');

// Load environment variables
dotenv.config();

// Load models
require('./models');

// Create Express app
const app = express();

// ============================================
// SECURITY MIDDLEWARE
// ============================================

// Security headers - similar to helmet but inline for zero dependencies
// This provides essential HTTP security headers
const securityHeaders = (req, res, next) => {
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Prevent clickjacking - frames not allowed from different origins
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');

  // XSS protection for older browsers (modern browsers don't need this)
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Don't send referrer for cross-origin requests
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions policy - restrict browser features
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  // Content-Security-Policy - restrict resource loading to prevent XSS
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https:",
    "connect-src 'self' https://api.paddle.com https://sandbox-api.paddle.com",
    "frame-src 'self' https://checkout.paddle.com https://sandbox-checkout.paddle.com",
    "object-src 'none'",
    "base-uri 'self'"
  ].join('; '));

  // In production, also add HSTS
  if (process.env.NODE_ENV === 'production') {
    // Strict Transport Security - force HTTPS for 1 year
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  // Remove Express identification header
  res.removeHeader('X-Powered-By');

  next();
};

// Apply security headers first
app.use(securityHeaders);

// Middleware
// Flexible CORS: allow configured origins; allow any origin in non-production if not explicitly blocked
const defaultOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:3003',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:3002',
  'http://127.0.0.1:3003',
  'http://localhost:4000',
  'http://127.0.0.1:4000',
  'https://zeeremind.com',
  'https://www.zeeremind.com'
];
const allowedOrigins = (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
// Merge environment origins with defaults (no duplicates)
const origins = allowedOrigins.length > 0
  ? [...new Set([...defaultOrigins, ...allowedOrigins])]
  : defaultOrigins;


app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // mobile apps / curl / same-origin
    if (origins.includes(origin)) return callback(null, true);
    if (process.env.NODE_ENV !== 'production') return callback(null, true);

    console.error(`CORS BLOCKED for origin: ${origin}`);
    return callback(new Error(`CORS blocked for origin ${origin}`));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['Content-Range', 'X-Content-Range', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200,
  preflightContinue: false
}));

// Raw body parsing for Paddle webhooks (must be before json parser for this route)
app.use('/api/paddle/webhook', express.raw({ type: 'application/json' }), (req, res, next) => {
  // Skip raw body parsing for non-POST requests (e.g., GET test endpoint)
  if (req.method !== 'POST') {
    return next();
  }
  try {
    req.rawBody = req.body.toString();
    req.body = JSON.parse(req.body);
    next();
  } catch (err) {
    console.error('[Paddle Webhook] Failed to parse request body:', err.message);
    return res.status(400).json({ error: 'Invalid request body' });
  }
});

// Raw body parsing for Stripe webhooks (must be before json parser)
app.use('/api/payments/stripe/webhook', express.raw({ type: 'application/json' }), (req, res, next) => {
  if (req.method !== 'POST') {
    return next();
  }
  try {
    req.rawBody = req.body.toString();
    req.body = JSON.parse(req.body);
    next();
  } catch (err) {
    console.error('[Stripe Webhook] Failed to parse request body:', err.message);
    return res.status(400).json({ error: 'Invalid request body' });
  }
});

// Request body parsing with size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Connect to MongoDB
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return true;
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    console.error(error);

    // Don't exit the process, let the server continue running
    return false;
  }
};

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/organizations', require('./routes/organizationRoutes'));
app.use('/api/profile', require('./routes/profileRoutes'));
app.use('/api/paddle', require('./routes/paddleRoutes'));
app.use('/api/subscription', require('./routes/subscriptionRoutes'));
app.use('/api/contact', require('./routes/contactRoutes'));

// Invoice Reminder Tool Routes
app.use('/api/invoice-reminder', require('./routes/invoiceReminderRoutes'));
app.use('/api/invoice-reminder/recurring', require('./routes/recurringReminderRoutes'));
app.use('/api/portal', require('./routes/clientPortalRoutes'));
app.use('/api/team', require('./routes/teamRoutes'));
app.use('/api/webhooks', require('./routes/webhookRoutes'));
app.use('/api/accounting', require('./routes/accountingRoutes'));
app.use('/api/clients', require('./routes/clientRoutes'));
app.use('/api/branding', require('./routes/brandingRoutes'));
app.use('/api/payments', require('./routes/paymentCollectionRoutes'));

// Serve uploaded branding files
const path = require('path');
app.use('/uploads/branding', require('express').static(path.join(__dirname, 'uploads', 'branding')));

// Root route with DB status
app.get('/', async (req, res) => {
  // Check MongoDB connection status
  const isConnected = mongoose.connection.readyState === 1;

  res.json({
    message: 'Welcome to ZeeRemind API',
    databaseStatus: isConnected ? 'connected' : 'disconnected',
    version: '1.0.0'
    // NOTE: MongoDB URI removed for security - don't expose internal connection details
  });
});

// Error handling middleware
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const gracefulShutdown = async (signal) => {
  console.log(`\n[${signal}] Shutting down gracefully...`);
  try {
    await mongoose.connection.close();
    console.log('[Shutdown] MongoDB connection closed');
  } catch (err) {
    console.error('[Shutdown] Error closing MongoDB:', err);
  }
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  await connectDB();
  startScheduledTasks();
});
