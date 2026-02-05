const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const Role = require('../models/Role');
const sendEmail = require('../utils/sendEmail');

/**
 * Generate JWT Token
 * SECURITY: Token expires in 24 hours (reduced from 30 days)
 * For longer sessions, implement refresh token rotation
 * 
 * @param {string} id - User ID
 * @param {string} organizationId - Organization ID (optional)
 * @returns {string} JWT token
 */
const generateToken = (id, organizationId = null) => {
  const payload = { id };
  if (organizationId) {
    payload.organizationId = organizationId;
  }
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '24h', // Default 24 hours, configurable via env
  });
};

/**
 * @desc    Register a user
 * @route   POST /api/auth/register
 * @access  Public
 */
exports.register = async (req, res) => {
  try {
    const { name, companyName, email, password } = req.body;

    // SaaS Dependencies (imported here for scope safety)
    const Organization = require('../models/Organization');
    const OrganizationMembership = require('../models/OrganizationMembership');
    const slugify = require('slugify');
    const { PERMISSIONS } = require('../utils/permissions');

    // 1. Check if user exists
    let user = await User.findOne({ email });

    if (user) {
      return res.status(400).json({
        success: false,
        message: 'User already exists',
      });
    }

    // 2. Create Organization
    const orgName = companyName || `${name}'s Organization`;

    // Create a clean slug
    let slug = slugify(orgName, { lower: true, strict: true, remove: /[*+~.()'"!:@]/g });
    if (!slug) slug = `org-${Date.now()}`;

    // Ensure slug uniqueness
    let counter = 1;
    const originalSlug = slug;
    while (await Organization.findOne({ slug })) {
      slug = `${originalSlug}-${counter}`;
      counter++;
    }

    const organization = await Organization.create({
      name: orgName,
      slug,
      approvalStatus: 'approved', // Auto-approve for SaaS
      subscription: {
        plan: 'free',
        status: 'trial',
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
      }
    });

    console.log('✅ Auth Register: Organization Created:', organization._id);

    // 3. Create Role (User) for this Org
    const ownerRole = await Role.create({
      organization: organization._id,
      name: 'user', // "User" role but with owner permissions
      description: 'User with full access',
      permissions: Object.values(PERMISSIONS),
      isCustom: false
    });

    // 4. Create User linked to Org
    user = await User.create({
      name,
      companyName,
      email,
      password,
      organization: organization._id, // DIRECT LINK
      role: ownerRole._id,
      organizationRole: 'user',
      isOwner: true,
      legacyRole: 'admin'
    });

    console.log('✅ Auth Register: User Created:', user._id);

    // 5. Create Membership (CRITICAL)
    await OrganizationMembership.create({
      user: user._id,
      organization: organization._id,
      role: ownerRole._id,
      isActive: true,
      joinedAt: new Date()
    });

    console.log('✅ Auth Register: Membership Created');

    // 6. Generate email verification token
    const verificationToken = user.getEmailVerificationToken();
    await user.save({ validateBeforeSave: false });

    // 7. Send verification email
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email/${verificationToken}`;

    try {
      await sendEmail({
        to: user.email,
        subject: `Welcome to ${process.env.APP_NAME || 'ZeeRemind'} - Verify Your Email`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #4F46E5;">Welcome to ${process.env.APP_NAME || 'ZeeRemind'}!</h1>
            <p>Hi ${user.name},</p>
            <p>Thank you for signing up! Your organization "<strong>${organization.name}</strong>" is ready.</p>
            <p>Please verify your email address to get started:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Verify Email Address</a>
            </div>
            <p>If you have any questions, feel free to contact our support team.</p>
          </div>
        `,
        text: `Welcome! Verify email: ${verificationUrl}`
      });
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
    }

    res.status(201).json({
      success: true,
      message: 'User registered successfully. Please check your email to verify your account.',
      data: {
        email: user.email,
        emailSent: true,
        requiresVerification: true
      }
    });
  } catch (err) {
    console.error(err);
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', '),
      });
    }
    res.status(500).json({
      success: false,
      message: 'Server Error',
    });
  }
};

/**
 * @desc    Login user
 * @route   POST /api/auth/login
 * @access  Public
 */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check for user (don't populate organization yet)
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Check if password matches
    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Check if email is verified - block ALL unverified users
    // SECURITY: Don't expose email in response (user already knows their email)
    if (user.isEmailVerified === false) {
      return res.status(403).json({
        success: false,
        message: 'Please verify your email address before logging in. Check your inbox for the verification link.',
        requiresVerification: true
        // SECURITY: Removed email field to prevent account enumeration
      });
    }

    // Find all active organization memberships for this user
    const OrganizationMembership = require('../models/OrganizationMembership');
    console.log('🔍 Login: Looking for memberships for user:', user._id);

    const memberships = await OrganizationMembership.find({
      user: user._id,
      isActive: true
    })
      .populate('organization')
      .populate('role');

    console.log(`🔍 Login: Found ${memberships.length} memberships`);

    // If user has no memberships but has legacy organization, handle backward compatibility
    if (memberships.length === 0 && user.organization) {
      console.log('🔍 Login: No memberships, checking legacy organization:', user.organization);
      const legacyUser = await User.findById(user._id).populate('role').populate('organization');

      // Check organization approval
      if (!user.isSuperAdmin && legacyUser.organization && legacyUser.organization.approvalStatus !== 'approved') {
        const statusMessage = legacyUser.organization.approvalStatus === 'pending'
          ? 'Your organization is pending approval by the administrator. You will be able to login once approved.'
          : 'Your organization has been rejected. Please contact support for more information.';

        return res.status(403).json({
          success: false,
          message: statusMessage,
          requiresApproval: true,
          approvalStatus: legacyUser.organization.approvalStatus,
          organizationName: legacyUser.organization.name
        });
      }

      // Check subscription
      if (!user.isSuperAdmin && legacyUser.organization && legacyUser.organization.subscription?.status === 'cancelled') {
        return res.status(403).json({
          success: false,
          message: 'Your organization subscription has been cancelled. Please contact support to renew your subscription.',
          subscriptionCancelled: true,
          organizationName: legacyUser.organization.name,
          cancellationReason: legacyUser.organization.subscription.cancellationReason
        });
      }

      // Auto-login with legacy organization
      const token = generateToken(user._id, legacyUser.organization._id);

      return res.json({
        success: true,
        token,
        requiresOrgSelection: false,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: legacyUser.role,
          organization: legacyUser.organization,
          legacyRole: user.legacyRole,
          isActive: user.isActive,
          isSuperAdmin: user.isSuperAdmin,
        },
      });
    }

    // If user has no memberships at all
    if (memberships.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'You are not a member of any organization. Please contact your administrator.',
      });
    }

    // Filter out organizations with issues
    const validMemberships = memberships.filter(m => {
      if (!m.organization) return false;
      if (!user.isSuperAdmin && m.organization.approvalStatus !== 'approved') return false;
      if (!user.isSuperAdmin && m.organization.subscription?.status === 'cancelled') return false;
      return true;
    });

    if (validMemberships.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'None of your organizations are currently accessible. Please contact support.',
      });
    }

    // If user has only one valid organization, auto-select it
    if (validMemberships.length === 1) {
      const membership = validMemberships[0];
      const token = generateToken(user._id, membership.organization._id);

      return res.json({
        success: true,
        token,
        requiresOrgSelection: false,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: membership.role,
          organization: membership.organization,
          isActive: user.isActive,
          isSuperAdmin: user.isSuperAdmin,
        },
      });
    }

    // User has multiple organizations - return list for selection
    const organizations = validMemberships.map(m => ({
      _id: m.organization._id,
      name: m.organization.name,
      logo: m.organization.logo,
      modules: m.organization.modules,
      role: {
        _id: m.role._id,
        name: m.role.name,
        permissions: m.role.permissions
      },
      joinedAt: m.joinedAt
    }));

    // Generate a temporary token for organization selection (short-lived)
    const tempToken = jwt.sign(
      { id: user._id, temp: true },
      process.env.JWT_SECRET,
      { expiresIn: '10m' }
    );

    res.json({
      success: true,
      requiresOrgSelection: true,
      tempToken,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        isActive: user.isActive,
        isSuperAdmin: user.isSuperAdmin,
      },
      organizations
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: 'Server Error',
    });
  }
};

/**
 * @desc    Get current logged in user
 * @route   GET /api/auth/me
 * @access  Private
 */
exports.getMe = async (req, res) => {
  try {
    // For multi-org users, req.user already has the correct organization and role
    // loaded by the protect middleware from the JWT token and OrganizationMembership
    if (req.user.organization && req.user.role) {
      // User is in a specific organization context (from JWT)
      const user = await User.findById(req.user._id).select('-password');

      // Update last login
      user.updateLastLogin();

      res.json({
        success: true,
        data: {
          _id: user._id,
          name: user.name,
          email: user.email,
          isActive: user.isActive,
          isEmailVerified: user.isEmailVerified,
          isSuperAdmin: user.isSuperAdmin,
          isOwner: user.isOwner, // Required for subscription upgrade UI
          lastLogin: user.lastLogin,
          avatar: user.avatar,
          phone: user.phone,
          timezone: user.timezone,
          organization: req.user.organization, // From JWT/OrganizationMembership
          role: req.user.role, // From JWT/OrganizationMembership
        },
      });
    } else {
      // Legacy fallback or super admin without org context
      const user = await User.findById(req.user._id)
        .populate('role')
        .populate('organization')
        .select('-password');

      // Update last login
      user.updateLastLogin();

      res.json({
        success: true,
        data: user,
      });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: 'Server Error',
    });
  }
};

/**
 * @desc    Forgot password - Generate reset token and send email
 * @route   POST /api/auth/forgotpassword
 * @access  Public
 */
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });

    // SECURITY: Don't reveal if user exists or not - prevents account enumeration
    if (!user) {
      // Use same response as success to prevent enumeration
      return res.json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.',
      });
    }

    // Get reset token
    const resetToken = user.getResetPasswordToken();

    // Save the updated user with reset token
    await user.save({ validateBeforeSave: false });

    // Create reset URL
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

    // Create email message
    const message = `
      <h1>Password Reset Request</h1>
      <p>You are receiving this email because you (or someone else) has requested the reset of a password.</p>
      <p>Please click on the following link to reset your password:</p>
      <a href="${resetUrl}" target="_blank">Reset Your Password</a>
      <p>This link will expire in 10 minutes.</p>
      <p>If you did not request this, please ignore this email and your password will remain unchanged.</p>
    `;

    try {
      await sendEmail({
        to: user.email,
        subject: 'ZeeRemind Password Reset',
        html: message,
        text: `Reset your password by visiting: ${resetUrl}`
      });

      // SECURITY: Never expose reset URL in response - only send via email
      res.json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.',
      });
    } catch (error) {
      console.error('Email send error:', error);

      // Clear the token since email failed
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save({ validateBeforeSave: false });

      // SECURITY: Don't expose error details in production
      return res.status(500).json({
        success: false,
        message: 'Unable to send password reset email. Please try again later.',
        // Never expose: error.message, resetUrl
      });
    }
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({
      success: false,
      message: 'An error occurred. Please try again later.',
      // SECURITY: Removed err.message exposure
    });
  }
};

/**
 * @desc    Reset password
 * @route   PUT /api/auth/resetpassword/:resettoken
 * @access  Public
 */
exports.resetPassword = async (req, res) => {
  try {
    // Get hashed token
    const resetPasswordToken = crypto
      .createHash('sha256')
      .update(req.params.resettoken)
      .digest('hex');

    // Find user by reset token and check if token is still valid
    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired token',
      });
    }

    // Set new password
    user.password = req.body.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    // Skip full validation to avoid legacy role casting issues;
    // only password and reset-token fields are being updated here.
    await user.save({ validateBeforeSave: false });

    // Return JWT token so user can be logged in right away
    const token = generateToken(user._id);

    res.json({
      success: true,
      message: 'Password reset successful',
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: 'Server Error',
    });
  }
};

/**
 * @desc    Test email - For debugging only (remove in production)
 * @route   GET /api/auth/test-email
 * @access  Public
 */
exports.testEmail = async (req, res) => {
  try {
    const testEmail = req.query.email || process.env.EMAIL_USERNAME;

    await sendEmail({
      to: testEmail,
      subject: 'Zeeventory Email Test',
      html: '<h1>This is a test email</h1><p>If you received this, your email configuration is working!</p>',
      text: 'This is a test email. If you received this, your email configuration is working!'
    });

    res.json({
      success: true,
      message: `Test email sent to ${testEmail}`,
      emailConfig: {
        service: process.env.EMAIL_SERVICE,
        from: process.env.EMAIL_FROM,
        username: process.env.EMAIL_USERNAME ? `${process.env.EMAIL_USERNAME.slice(0, 3)}...` : 'not set',
        // Don't expose full password
        passwordSet: !!process.env.EMAIL_PASSWORD
      }
    });
  } catch (error) {
    console.error('Test email error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send test email',
      error: process.env.NODE_ENV !== 'production' ? error.message : undefined,
      emailConfig: {
        service: process.env.EMAIL_SERVICE,
        from: process.env.EMAIL_FROM,
        username: process.env.EMAIL_USERNAME ? `${process.env.EMAIL_USERNAME.slice(0, 3)}...` : 'not set',
        // Don't expose full password
        passwordSet: !!process.env.EMAIL_PASSWORD
      }
    });
  }
};

/**
 * @desc    Verify email address
 * @route   GET /api/auth/verify-email/:token
 * @access  Public
 */
exports.verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;

    // Hash the token
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    // Find user with valid token
    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification token. Please request a new verification email.'
      });
    }

    // Mark email as verified
    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpire = undefined;
    await user.save({ validateBeforeSave: false });

    res.json({
      success: true,
      message: 'Email verified successfully! You can now log in to your account.'
    });

  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Email verification failed'
    });
  }
};

/**
 * @desc    Resend email verification
 * @route   POST /api/auth/resend-verification
 * @access  Public (accepts email in body)
 */
exports.resendVerification = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      // Don't reveal if user exists or not for security
      return res.json({
        success: true,
        message: 'If an account with that email exists and is not verified, a verification email has been sent.'
      });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: 'Email is already verified. You can log in to your account.'
      });
    }

    // Generate new verification token
    const verificationToken = user.getEmailVerificationToken();
    await user.save({ validateBeforeSave: false });

    // Send verification email
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email/${verificationToken}`;

    try {
      await sendEmail({
        to: user.email,
        subject: `Verify Your Email - ${process.env.APP_NAME || 'Zeeventory'}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #4F46E5;">Verify Your Email</h1>
            <p>Hi ${user.name},</p>
            <p>Please verify your email address by clicking the button below:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Verify Email Address</a>
            </div>
            <p>This link will expire in 24 hours.</p>
            <p>If you didn't request this email, you can safely ignore it.</p>
            <p>Best regards,<br>The ${process.env.APP_NAME || 'Zeeventory'} Team</p>
          </div>
        `,
        text: `Verify your email: ${verificationUrl}`
      });
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      return res.status(500).json({
        success: false,
        message: 'Failed to send verification email. Please try again later.'
      });
    }

    res.json({
      success: true,
      message: 'Verification email sent successfully. Please check your inbox.'
    });

  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to resend verification email'
    });
  }
};

/**
 * @desc    Select organization after login
 * @route   POST /api/auth/select-organization
 * @access  Public (requires temp token)
 */
exports.selectOrganization = async (req, res) => {
  try {
    const { organizationId, tempToken } = req.body;

    if (!organizationId || !tempToken) {
      return res.status(400).json({
        success: false,
        message: 'Organization ID and temp token are required'
      });
    }

    // Verify temp token
    let decoded;
    try {
      decoded = jwt.verify(tempToken, process.env.JWT_SECRET);
      if (!decoded.temp) {
        throw new Error('Invalid token type');
      }
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }

    // Get user
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify user has access to this organization
    const hasAccess = await user.hasAccessToOrg(organizationId);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this organization'
      });
    }

    // Get membership details
    const membership = await user.getMembershipForOrg(organizationId);
    if (!membership) {
      return res.status(404).json({
        success: false,
        message: 'Membership not found'
      });
    }

    // Check organization approval and subscription
    if (!user.isSuperAdmin) {
      if (membership.organization.approvalStatus !== 'approved') {
        return res.status(403).json({
          success: false,
          message: 'This organization is not approved'
        });
      }

      if (membership.organization.subscription?.status === 'cancelled') {
        return res.status(403).json({
          success: false,
          message: 'This organization subscription has been cancelled'
        });
      }
    }

    // Generate full token with organization context
    const token = generateToken(user._id, organizationId);

    res.json({
      success: true,
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: membership.role,
        organization: membership.organization,
        isActive: user.isActive,
        isSuperAdmin: user.isSuperAdmin,
      },
    });
  } catch (error) {
    console.error('Select organization error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to select organization'
    });
  }
};

/**
 * @desc    Get all organizations user belongs to
 * @route   GET /api/auth/my-organizations
 * @access  Private
 */
exports.getMyOrganizations = async (req, res) => {
  try {
    const OrganizationMembership = require('../models/OrganizationMembership');

    const memberships = await OrganizationMembership.find({
      user: req.user._id,
      isActive: true
    })
      .populate('organization')
      .populate('role')
      .sort({ joinedAt: -1 });

    // Filter out organizations with issues (unless super admin)
    const validMemberships = memberships.filter(m => {
      if (!m.organization) return false;
      if (req.user.isSuperAdmin) return true;
      if (m.organization.approvalStatus !== 'approved') return false;
      if (m.organization.subscription?.status === 'cancelled') return false;
      return true;
    });

    const organizations = validMemberships.map(m => ({
      _id: m.organization._id,
      name: m.organization.name,
      logo: m.organization.logo,
      modules: m.organization.modules,
      role: {
        _id: m.role._id,
        name: m.role.name,
        permissions: m.role.permissions
      },
      joinedAt: m.joinedAt,
      isCurrent: m.organization._id.toString() === req.user.organization?._id?.toString()
    }));

    res.json({
      success: true,
      data: organizations
    });
  } catch (error) {
    console.error('Get my organizations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch organizations'
    });
  }
};

/**
 * @desc    Switch to a different organization
 * @route   POST /api/auth/switch-organization
 * @access  Private
 */
exports.switchOrganization = async (req, res) => {
  try {
    const { organizationId } = req.body;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: 'Organization ID is required'
      });
    }

    // Verify user has access to this organization
    const hasAccess = await req.user.hasAccessToOrg(organizationId);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this organization'
      });
    }

    // Get membership details
    const membership = await req.user.getMembershipForOrg(organizationId);
    if (!membership) {
      return res.status(404).json({
        success: false,
        message: 'Membership not found'
      });
    }

    // Check organization approval and subscription
    if (!req.user.isSuperAdmin) {
      if (membership.organization.approvalStatus !== 'approved') {
        return res.status(403).json({
          success: false,
          message: 'This organization is not approved'
        });
      }

      if (membership.organization.subscription?.status === 'cancelled') {
        return res.status(403).json({
          success: false,
          message: 'This organization subscription has been cancelled'
        });
      }
    }

    // Generate new token with new organization context
    const token = generateToken(req.user._id, organizationId);

    res.json({
      success: true,
      token,
      user: {
        _id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        role: membership.role,
        organization: membership.organization,
        isActive: req.user.isActive,
        isSuperAdmin: req.user.isSuperAdmin,
      },
    });
  } catch (error) {
    console.error('Switch organization error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to switch organization'
    });
  }
};

/**
 * @desc    Update password
 * @route   PUT /api/auth/updatepassword
 * @access  Private
 */
exports.updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both current and new passwords'
      });
    }

    // Get user with password
    const user = await User.findById(req.user._id).select('+password');

    // Check current password
    if (!(await user.matchPassword(currentPassword))) {
      return res.status(401).json({
        success: false,
        message: 'Incorrect current password'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    // Send new token
    const token = generateToken(user._id, req.user.organization?._id);

    res.json({
      success: true,
      token,
      message: 'Password updated successfully',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: req.user.role,
        organization: req.user.organization
      }
    });
  } catch (error) {
    console.error('Update password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

/**
 * @desc    Update user details (Profile)
 * @route   PUT /api/auth/updatedetails
 * @access  Private
 */
exports.updateDetails = async (req, res) => {
  try {
    const { name, companyName } = req.body;

    // Updates object
    const fieldsToUpdate = {};
    if (name) fieldsToUpdate.name = name;

    // 1. Update User
    const user = await User.findByIdAndUpdate(
      req.user.id,
      fieldsToUpdate,
      {
        new: true,
        runValidators: true
      }
    );

    // 2. Update Organization Name (if provided and user is authorized)
    let organization = null;
    if (companyName && req.user.organization) {
      // Check if user is owner or admin of the organization
      // Note: req.user.role is populated by protect middleware
      const canUpdateOrg = req.user.isSuperAdmin ||
        req.user.isOrganizationOwner() ||
        (req.user.organizationRole === 'admin') ||
        (req.user.role && req.user.role.permissions && req.user.role.permissions.includes('settings:edit'));

      if (canUpdateOrg) {
        const Organization = require('../models/Organization');
        organization = await Organization.findByIdAndUpdate(
          req.user.organization._id || req.user.organization,
          { name: companyName },
          { new: true, runValidators: true }
        );
      }
    }

    res.status(200).json({
      success: true,
      data: {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: req.user.role,
          organization: organization || req.user.organization,
          isActive: user.isActive,
          isSuperAdmin: user.isSuperAdmin,
        },
        message: 'Profile updated successfully'
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};
