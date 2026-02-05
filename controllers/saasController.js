const Organization = require('../models/Organization');
const User = require('../models/User');
const Role = require('../models/Role');
const OrganizationMembership = require('../models/OrganizationMembership');
const Subscription = require('../models/Subscription');
const { PERMISSIONS } = require('../utils/permissions');
const jwt = require('jsonwebtoken');
const slugify = require('slugify');
const crypto = require('crypto');
const sendEmail = require('../utils/sendEmail');
const subscriptionEmailService = require('../services/subscriptionEmailService');

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

/**
 * @desc    Register new organization with owner
 * @route   POST /api/saas/register
 * @access  Public
 */
exports.registerOrganization = async (req, res) => {
  try {
    const { organizationName, name, email, password } = req.body;

    // Validate required fields
    if (!organizationName || !name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Create organization slug
    let slug = slugify(organizationName, { lower: true, strict: true });

    // Ensure slug is unique
    let counter = 1;
    let originalSlug = slug;
    while (await Organization.findOne({ slug })) {
      slug = `${originalSlug}-${counter}`;
      counter++;
    }

    // Create organization with approved status (auto-approve for SaaS)
    const organization = await Organization.create({
      name: organizationName,
      slug,
      approvalStatus: 'approved', // Changed from pending to approved for immediate access
      subscription: {
        plan: 'free',
        status: 'trial',
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 14 days trial
      }
    });

    console.log('✅ Organization Created:', organization._id, organization.name);

    // Create owner role as "user" for this specific organization
    // Requested change: Role should be only "user" but with full permissions
    const ownerRole = await Role.create({
      organization: organization._id,
      name: 'user',
      description: 'User with full access',
      permissions: Object.values(PERMISSIONS),
      isCustom: false
    });

    // Create owner user
    let user;
    try {
      user = await User.create({
        name,
        email,
        password,
        organization: organization._id,
        role: ownerRole._id,
        organizationRole: 'user',
        isOwner: true, // Still marked as owner for billing/system purposes
        legacyRole: 'admin' // Keep as admin for legacy compatibility if needed
      });
      console.log('✅ User Created:', user._id, 'Org:', user.organization);
    } catch (userError) {
      console.error('❌ User Creation Failed:', userError);
      throw userError;
    }

    // Create Organization Membership (CRITICAL for permissions to work)
    try {
      await OrganizationMembership.create({
        user: user._id,
        organization: organization._id,
        role: ownerRole._id,
        isActive: true,
        joinedAt: new Date()
      });
      console.log('✅ Membership Created for User:', user._id);
    } catch (membError) {
      console.error('❌ Membership Creation Failed:', membError);
      console.log('Membership Payload:', {
        user: user?._id,
        organization: organization?._id,
        role: ownerRole?._id
      });
    }

    console.log('✅ Registration Flow Complete for User:', user._id);

    // Generate email verification token
    const verificationToken = user.getEmailVerificationToken();
    await user.save({ validateBeforeSave: false });

    // Create initial subscription record
    await Subscription.create({
      organization: organization._id,
      plan: 'free',
      status: 'trial',
      currentPeriodStart: new Date(),
      currentPeriodEnd: organization.subscription.trialEndsAt
    });

    // Send welcome email with trial information
    try {
      await subscriptionEmailService.sendTrialStartEmail(user, organization);
    } catch (emailError) {
      console.error('Failed to send trial start email:', emailError);
      // Don't fail registration if email fails
    }

    res.status(201).json({
      success: true,
      message: 'Organization created successfully. Please check your email to verify your account.',
      data: {
        email: user.email,
        emailSent: true,
        requiresVerification: true
      }
    });

  } catch (error) {
    console.error('Organization registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create organization',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Verify email address
 * @route   GET /api/saas/verify-email/:token
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
        message: 'Invalid or expired verification token'
      });
    }

    // Mark email as verified
    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpire = undefined;
    await user.save({ validateBeforeSave: false });

    res.json({
      success: true,
      message: 'Email verified successfully'
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
 * @route   POST /api/saas/resend-verification
 * @access  Private
 */
exports.resendVerification = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: 'Email is already verified'
      });
    }

    // Generate new verification token
    const verificationToken = user.getEmailVerificationToken();
    await user.save({ validateBeforeSave: false });

    // Send verification email
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email/${verificationToken}`;

    await sendEmail({
      to: user.email,
      subject: 'Verify Your Email Address',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #4F46E5;">Verify Your Email</h1>
          <p>Hi ${user.name},</p>
          <p>Please verify your email address by clicking the button below:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Verify Email Address</a>
          </div>
          <p>This link will expire in 24 hours.</p>
        </div>
      `,
      text: `Verify your email: ${verificationUrl}`
    });

    res.json({
      success: true,
      message: 'Verification email sent successfully'
    });

  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send verification email'
    });
  }
};

/**
 * @desc    Get subscription plans
 * @route   GET /api/saas/plans
 * @access  Public
 */
exports.getPlans = async (req, res) => {
  try {
    const plans = Subscription.plans;

    res.json({
      success: true,
      data: plans
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch plans'
    });
  }
};

/**
 * @desc    Get organization onboarding status
 * @route   GET /api/saas/onboarding-status
 * @access  Private
 */
exports.getOnboardingStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('organization');

    if (!user.organization) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found'
      });
    }

    // Check onboarding steps completion
    const status = {
      emailVerified: user.isEmailVerified,
      organizationSetup: true, // Already created
      profileComplete: !!(user.name && user.email),
      subscriptionActive: user.organization.subscription.status === 'active',
      trialDaysLeft: user.organization.subscription.status === 'trial' ?
        Math.max(0, Math.ceil((user.organization.subscription.trialEndsAt - new Date()) / (1000 * 60 * 60 * 24))) : 0
    };

    status.completed = status.emailVerified && status.organizationSetup && status.profileComplete;

    res.json({
      success: true,
      data: status
    });

  } catch (error) {
    console.error('Onboarding status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get onboarding status'
    });
  }
}; 