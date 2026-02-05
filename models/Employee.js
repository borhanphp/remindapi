const mongoose = require('mongoose');
const crypto = require('crypto');

const EmployeeSchema = new mongoose.Schema({
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true, required: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true, index: true },
  phone: { type: String },
  department: { type: String },
  designation: { type: String },
  dateOfJoining: { type: Date },
  employmentType: { type: String, enum: ['full-time', 'part-time', 'contract'], default: 'full-time' },
  salary: { type: Number, default: 0 },
  benefits: { type: Object, default: {} },
  taxCode: { type: String },
  status: { type: String, enum: ['active', 'inactive', 'terminated'], default: 'active' },
  terminationDate: { type: Date },
  profile: { type: Object, default: {} },

  // User account linkage
  linkedUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },

  // Portal invite fields
  inviteStatus: {
    type: String,
    enum: ['not_invited', 'pending', 'accepted'],
    default: 'not_invited'
  },
  inviteToken: { type: String },
  inviteTokenExpire: { type: Date },
  invitedAt: { type: Date },
  invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

// Generate invite token
EmployeeSchema.methods.generateInviteToken = function () {
  const token = crypto.randomBytes(32).toString('hex');

  this.inviteToken = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');

  // Token expires in 7 days
  this.inviteTokenExpire = Date.now() + 7 * 24 * 60 * 60 * 1000;
  this.inviteStatus = 'pending';
  this.invitedAt = new Date();

  return token;
};

// Index for invite token lookup
EmployeeSchema.index({ inviteToken: 1 });

module.exports = mongoose.model('Employee', EmployeeSchema);
