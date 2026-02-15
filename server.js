const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const errorHandler = require('./middleware/error');
const { serveReceipts, serveCvs, serveProducts } = require('./middleware/staticFiles');
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
    // Log CORS requests in production for debugging
    if (process.env.NODE_ENV === 'production' && origin) {
      console.log(`CORS request from origin: ${origin}`);
    }

    if (!origin) return callback(null, true); // mobile apps / curl / same-origin
    if (origins.includes(origin)) return callback(null, true);
    if (process.env.NODE_ENV !== 'production') return callback(null, true);

    console.error(`CORS BLOCKED for origin: ${origin}. Allowed origins:`, origins);
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
  req.rawBody = req.body.toString();
  req.body = JSON.parse(req.body);
  next();
});

// Request body parsing with size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files
app.use('/receipts', serveReceipts);
app.use('/cvs', serveCvs);
app.use('/uploads/products', serveProducts);

// Ensure upload directories exist
try {
  fs.mkdirSync(path.join(process.cwd(), 'uploads', 'cvs'), { recursive: true });
  fs.mkdirSync(path.join(process.cwd(), 'uploads', 'receipts'), { recursive: true });
  fs.mkdirSync(path.join(process.cwd(), 'uploads', 'products'), { recursive: true });
  fs.mkdirSync(path.join(process.cwd(), 'uploads', 'products', 'thumbnails'), { recursive: true });
} catch (e) {
  console.error('Failed to ensure upload directories:', e);
}

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

// Load module configuration
const { isModuleEnabled, getAllModules } = require('./config/modules');

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/saas', require('./routes/saasRoutes'));
app.use('/api/organizations', require('./routes/organizationRoutes'));
app.use('/api/users', require('./routes/users'));
app.use('/api/roles', require('./routes/roles'));
app.use('/api/permissions', require('./routes/permissionRoutes'));
app.use('/api/profile', require('./routes/profileRoutes'));
app.use('/api/upload', require('./routes/upload')); // Image upload routes
app.use('/api/paddle', require('./routes/paddleRoutes')); // Paddle subscription billing
app.use('/api/subscription', require('./routes/subscriptionRoutes')); // Subscription management

// Paddle Webhook (Public) - registered here to accessible
const paddleController = require('./controllers/paddleController');
app.post('/api/paddle/webhook', paddleController.handleWebhook);







// Public contact form route
app.use('/api/contact', require('./routes/contactRoutes'));

// Invoice Reminder Tool Routes
app.use('/api/invoice-reminder', require('./routes/invoiceReminderRoutes'));


// Integration routes (always available for module management)
app.use('/api/integration', require('./routes/integrationRoutes'));

// Organization approval routes (super admin only)
app.use('/api/admin/organizations', require('./routes/organizationApproval'));
app.use('/api/admin/audit', require('./routes/adminAuditRoutes'));
app.use('/api/admin/contacts', require('./routes/adminContactRoutes'));
app.use('/api/admin/users', require('./routes/adminUsersRoutes'));

// Module configuration endpoint has been deprecated; all modules are enabled by default.

// Root route with DB status
app.get('/', async (req, res) => {
  // Check MongoDB connection status
  const isConnected = mongoose.connection.readyState === 1;

  res.json({
    message: 'Welcome to Zeeventory API',
    databaseStatus: isConnected ? 'connected' : 'disconnected',
    version: '1.0.0'
    // NOTE: MongoDB URI removed for security - don't expose internal connection details
  });
});

// Error handling middleware
app.use(errorHandler);

// Start server (with Socket.IO)
const http = require('http');
const { Server } = require('socket.io');
const { setIO } = require('./utils/realtime');

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

// Socket.IO with proper CORS configuration (same as Express CORS)
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      // Apply same CORS logic as Express
      if (!origin) return callback(null, true); // mobile apps / curl / same-origin
      if (origins.includes(origin)) return callback(null, true);
      if (process.env.NODE_ENV !== 'production') return callback(null, true);

      console.error(`Socket.IO CORS BLOCKED for origin: ${origin}`);
      return callback(new Error(`CORS blocked for origin ${origin}`));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true
  }
});
setIO(io);

io.on('connection', (socket) => {
  // Namespace/rooms can be added later (e.g., per organization)
});

server.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  await connectDB();
  startScheduledTasks();
});
