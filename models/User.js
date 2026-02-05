const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

/**
 * Password complexity regex
 * Requires at least:
 * - 8 characters minimum (12 recommended)
 * - One uppercase letter
 * - One lowercase letter  
 * - One number
 * Optional: special characters encouraged but not required for usability
 */
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
const PASSWORD_ERROR_MSG = 'Password must be at least 8 characters with at least one uppercase letter, one lowercase letter, and one number';

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    companyName: {
      type: String,
      maxlength: [100, 'Company name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: [255, 'Email cannot exceed 255 characters'],
    },
    password: {
      type: String,
      required: true,
      minlength: [8, 'Password must be at least 8 characters'],
      validate: {
        validator: function (v) {
          // Only validate on new passwords (not when retrieving hashed password)
          if (this.isNew || this.isModified('password')) {
            return PASSWORD_REGEX.test(v);
          }
          return true;
        },
        message: PASSWORD_ERROR_MSG
      }
    },
    role: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Role',
      required: true,
    },
    // Organization relationship for multi-tenancy
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: false, // Made optional to support super admin users
    },
    // Organization role within the tenant
    organizationRole: {
      type: String,
      enum: ['owner', 'admin', 'manager', 'user'],
      default: 'user'
    },
    // Keep legacy role field for backward compatibility during migration
    legacyRole: {
      type: String,
      enum: ['admin', 'manager', 'salesperson', 'accountant', 'staff'],
    },
    // Super admin flag for platform administrators
    isSuperAdmin: {
      type: Boolean,
      default: false,
    },
    // Organization owner flag
    isOwner: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    // User profile information
    avatar: {
      type: String,
    },
    phone: {
      type: String,
      maxlength: [20, 'Phone number cannot exceed 20 characters'],
    },
    timezone: {
      type: String,
      default: 'UTC'
    },
    // Last login tracking
    lastLogin: {
      type: Date,
    },
    // Email verification
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationToken: String,
    emailVerificationExpire: Date,
    // Password reset
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    // Invitation tracking
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    invitedAt: {
      type: Date,
    },
    acceptedInviteAt: {
      type: Date,
    },
    // UI preferences
    uiPreferences: {
      enabledModules: {
        type: [String],
        default: []
      }
    },
    // SaaS Subscription Fields
    plan: {
      type: String,
      enum: ['free', 'pro'],
      default: 'free'
    },
    subscriptionStatus: {
      type: String,
      enum: ['active', 'past_due', 'canceled', 'paused', 'trialing'],
      default: 'active' // Free plan is active by default
    },
    paddleCustomerId: {
      type: String,
    },
    paddleSubscriptionId: {
      type: String,
    },
    billingCycle: {
      type: String,
      enum: ['monthly', 'yearly'],
    }
  },
  { timestamps: true }
);

// Encrypt password using bcrypt with stronger cost factor
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }

  // SECURITY: Increased cost factor from 10 to 12 for stronger hashing
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
});

// Match user entered password to hashed password in database
UserSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Generate and hash password reset token
UserSchema.methods.getResetPasswordToken = function () {
  // Generate token
  const resetToken = crypto.randomBytes(20).toString('hex');

  // Hash token and set to resetPasswordToken field
  this.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  // Set expiration (10 minutes)
  this.resetPasswordExpire = Date.now() + 10 * 60 * 1000;

  return resetToken;
};

// Get user permissions from their role
UserSchema.methods.getPermissions = async function () {
  if (!this.role) return [];

  const Role = mongoose.model('Role');
  const role = await Role.findById(this.role);
  return role ? role.permissions : [];
};

// Check if user has a specific permission
UserSchema.methods.hasPermission = async function (permission) {
  const permissions = await this.getPermissions();
  return permissions.includes(permission);
};

// Generate email verification token
UserSchema.methods.getEmailVerificationToken = function () {
  const verificationToken = crypto.randomBytes(20).toString('hex');

  this.emailVerificationToken = crypto
    .createHash('sha256')
    .update(verificationToken)
    .digest('hex');

  this.emailVerificationExpire = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

  return verificationToken;
};

// Check if user is organization owner
UserSchema.methods.isOrganizationOwner = function () {
  return this.isOwner || this.organizationRole === 'owner';
};

// Check if user can manage organization
UserSchema.methods.canManageOrganization = function () {
  return this.isOwner || this.organizationRole === 'owner' || this.organizationRole === 'admin';
};

// Update last login
UserSchema.methods.updateLastLogin = function () {
  this.lastLogin = new Date();
  return this.save({ validateBeforeSave: false });
};

// Get all organizations this user belongs to
UserSchema.methods.getOrganizations = async function () {
  const OrganizationMembership = mongoose.model('OrganizationMembership');
  const memberships = await OrganizationMembership.find({
    user: this._id,
    isActive: true
  })
    .populate('organization')
    .populate('role');

  return memberships.map(m => ({
    organization: m.organization,
    role: m.role,
    joinedAt: m.joinedAt,
    membershipId: m._id
  }));
};

// Get membership details for a specific organization
UserSchema.methods.getMembershipForOrg = async function (organizationId) {
  const OrganizationMembership = mongoose.model('OrganizationMembership');
  return await OrganizationMembership.findOne({
    user: this._id,
    organization: organizationId,
    isActive: true
  })
    .populate('role')
    .populate('organization');
};

// Check if user has access to an organization
UserSchema.methods.hasAccessToOrg = async function (organizationId) {
  // Super admins have access to all organizations
  if (this.isSuperAdmin) return true;

  const OrganizationMembership = mongoose.model('OrganizationMembership');
  const membership = await OrganizationMembership.findOne({
    user: this._id,
    organization: organizationId,
    isActive: true
  });

  return !!membership;
};

// Indexes for better performance
UserSchema.index({ email: 1 });
UserSchema.index({ organization: 1 });
UserSchema.index({ organization: 1, organizationRole: 1 });
UserSchema.index({ resetPasswordToken: 1 });
UserSchema.index({ emailVerificationToken: 1 });

module.exports = mongoose.model('User', UserSchema); 