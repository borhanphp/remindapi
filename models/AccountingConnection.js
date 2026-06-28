const mongoose = require('mongoose');
const crypto = require('crypto');

const accountingConnectionSchema = new mongoose.Schema({
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  provider: {
    type: String,
    enum: ['quickbooks', 'xero'],
    required: true
  },
  accessToken: {
    type: String,
    required: true
  },
  refreshToken: {
    type: String,
    required: true
  },
  tokenExpiresAt: {
    type: Date,
    required: true
  },
  realmId: String,
  tenantId: String,
  companyName: String,
  active: {
    type: Boolean,
    default: true
  },
  lastSyncAt: Date,
  lastError: String,
  syncCount: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

accountingConnectionSchema.index({ organization: 1, provider: 1 }, { unique: true });

const ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY || process.env.JWT_SECRET;

accountingConnectionSchema.pre('save', function (next) {
  if (this.isModified('accessToken') && !this.accessToken.startsWith('enc:')) {
    this.accessToken = encrypt(this.accessToken);
  }
  if (this.isModified('refreshToken') && !this.refreshToken.startsWith('enc:')) {
    this.refreshToken = encrypt(this.refreshToken);
  }
  next();
});

accountingConnectionSchema.methods.getAccessToken = function () {
  return decrypt(this.accessToken);
};

accountingConnectionSchema.methods.getRefreshToken = function () {
  return decrypt(this.refreshToken);
};

function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `enc:${iv.toString('hex')}:${encrypted}`;
}

function decrypt(text) {
  if (!text.startsWith('enc:')) return text;
  const parts = text.split(':');
  const iv = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

module.exports = mongoose.model('AccountingConnection', accountingConnectionSchema);
