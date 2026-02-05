const mongoose = require('mongoose');

const OrganizationMembershipSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  role: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Role',
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  joinedAt: {
    type: Date,
    default: Date.now
  },
  invitedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { 
  timestamps: true 
});

// Compound index for efficient lookups - ensures user can only have one membership per org
OrganizationMembershipSchema.index({ user: 1, organization: 1 }, { unique: true });

// Index for finding all active members of an organization
OrganizationMembershipSchema.index({ organization: 1, isActive: 1 });

// Index for finding all organizations a user belongs to
OrganizationMembershipSchema.index({ user: 1, isActive: 1 });

module.exports = mongoose.model('OrganizationMembership', OrganizationMembershipSchema);

