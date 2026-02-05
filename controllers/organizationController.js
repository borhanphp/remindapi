const Organization = require('../models/Organization');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const ErrorResponse = require('../utils/errorResponse');
const slugify = require('slugify');
const Role = require('../models/Role');
const OrganizationMembership = require('../models/OrganizationMembership');
const { PERMISSIONS } = require('../utils/permissions');

// @desc    Create new organization
// @route   POST /api/organizations
// @access  Private
exports.createOrganization = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    // Create organization with trial subscription
    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 days trial
    const organization = await Organization.create({
      name,
      slug: slugify(name, { lower: true, strict: true }),
      subscription: {
        status: 'trial',
        plan: 'free',
        trialEndsAt: trialEndsAt
      }
    });

    // Create owner role for this organization
    const allPermissions = Object.values(PERMISSIONS);
    const ownerRole = await Role.create({
      organization: organization._id,
      name: 'owner',
      description: 'Organization Owner with full access',
      permissions: allPermissions,
      isCustom: false
    });

    // Create owner user
    const user = await User.create({
      name,
      email,
      password,
      organization: organization._id,
      role: ownerRole._id,
      organizationRole: 'owner',
      isOwner: true
    });

    // Create Organization Membership
    await OrganizationMembership.create({
      user: user._id,
      organization: organization._id,
      role: ownerRole._id,
      isActive: true,
      joinedAt: new Date()
    });

    // Create trial subscription record
    // Paddle customer/subscription IDs will be set when user upgrades via Paddle checkout
    await Subscription.create({
      organization: organization._id,
      plan: 'free',
      status: 'trial',
      currentPeriodStart: new Date(),
      currentPeriodEnd: trialEndsAt
    });

    res.status(201).json({
      success: true,
      data: {
        organization,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get organization details
// @route   GET /api/organizations/me
// @access  Private
exports.getOrganization = async (req, res, next) => {
  try {
    const organization = await Organization.findById(req.organization._id)
      .select('-__v');

    const subscription = await Subscription.findOne({
      organization: organization._id,
      status: { $in: ['active', 'trial'] }
    });

    const users = await User.find({ organization: organization._id })
      .select('name email role isActive lastLogin');

    res.status(200).json({
      success: true,
      data: {
        organization,
        subscription,
        users
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update organization
// @route   PUT /api/organizations/me
// @access  Private (Owner/Admin)
exports.updateOrganization = async (req, res, next) => {
  try {
    const { name, settings } = req.body;
    const organization = await Organization.findById(req.organization._id);

    if (name && name !== organization.name) {
      organization.name = name;
      organization.slug = slugify(name, { lower: true, strict: true });
    }

    if (settings) {
      organization.settings = { ...organization.settings, ...settings };
    }

    await organization.save();

    res.status(200).json({
      success: true,
      data: organization
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update subscription (redirects to Paddle)
// @route   PUT /api/organizations/subscription
// @access  Private (Owner)
// NOTE: Subscription management is handled via Paddle. Use /api/paddle/checkout or /api/paddle/update
exports.updateSubscription = async (req, res, next) => {
  try {
    if (!req.user.isOwner) {
      return next(new ErrorResponse('Only organization owner can update subscription', 403));
    }

    // Redirect to Paddle for subscription management
    res.status(200).json({
      success: true,
      message: 'Subscription management is handled via Paddle. Please use the subscription page to upgrade.',
      redirectTo: '/subscription',
      paddleEndpoints: {
        checkout: '/api/paddle/checkout',
        update: '/api/paddle/update'
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Cancel subscription (redirects to Paddle)
// @route   DELETE /api/organizations/subscription
// @access  Private (Owner)
// NOTE: Subscription cancellation is handled via Paddle. Use /api/paddle/cancel
exports.cancelSubscription = async (req, res, next) => {
  try {
    if (!req.user.isOwner) {
      return next(new ErrorResponse('Only organization owner can cancel subscription', 403));
    }

    // Redirect to Paddle for cancellation
    res.status(200).json({
      success: true,
      message: 'Subscription cancellation is handled via Paddle. Please use the Paddle endpoint.',
      paddleEndpoint: '/api/paddle/cancel'
    });
  } catch (error) {
    next(error);
  }
};

// ===== Platform admin endpoints =====

// @desc    Get all organizations (platform admin)
// @route   GET /api/organizations/admin
// @access  Private (super admin / authority)
exports.getAllOrganizationsAdmin = async (req, res, next) => {
  try {
    const organizations = await Organization.find()
      .select('-__v')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: organizations
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single organization by id (platform admin)
// @route   GET /api/organizations/admin/:id
// @access  Private (super admin / authority)
exports.getOrganizationByIdAdmin = async (req, res, next) => {
  try {
    const organization = await Organization.findById(req.params.id).select('-__v');

    if (!organization) {
      return next(new ErrorResponse('Organization not found', 404));
    }

    res.status(200).json({
      success: true,
      data: organization
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update organization by id (platform admin)
// @route   PUT /api/organizations/admin/:id
// @access  Private (super admin / authority)
exports.updateOrganizationByIdAdmin = async (req, res, next) => {
  try {
    const { name, slug, subscription, modules } = req.body;

    const organization = await Organization.findById(req.params.id);
    if (!organization) {
      return next(new ErrorResponse('Organization not found', 404));
    }

    if (name && name !== organization.name) {
      organization.name = name;
      organization.slug =
        slug || slugify(name, { lower: true, strict: true });
    } else if (slug) {
      organization.slug = slugify(slug, { lower: true, strict: true });
    }

    if (subscription) {
      organization.subscription = {
        ...organization.subscription,
        ...subscription
      };
    }

    // Update modules if provided
    if (modules) {
      // Validate modules array
      const validModules = ['inventory', 'accounting', 'hrm', 'crm', 'projects', 'custom-invoicing'];
      const invalidModules = modules.filter(m => !validModules.includes(m));

      if (invalidModules.length > 0) {
        return next(new ErrorResponse(`Invalid modules: ${invalidModules.join(', ')}`, 400));
      }

      if (modules.length === 0) {
        return next(new ErrorResponse('At least one module must be enabled', 400));
      }

      organization.modules = modules;
    }

    await organization.save();

    res.status(200).json({
      success: true,
      data: organization
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update organization owner email/password (platform admin)
// @route   PUT /api/organizations/admin/:id/owner-credentials
// @access  Private (super admin / authority)
exports.updateOrganizationOwnerCredentialsAdmin = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email && !password) {
      return next(new ErrorResponse('Email or password is required', 400));
    }

    const ownerUser = await User.findOne({
      organization: req.params.id,
      $or: [{ isOwner: true }, { organizationRole: 'owner' }],
    });

    if (!ownerUser) {
      return next(new ErrorResponse('Owner user not found for this organization', 404));
    }

    if (email) {
      ownerUser.email = email;
    }
    if (password) {
      // Will be hashed by User schema pre-save hook
      ownerUser.password = password;
    }

    await ownerUser.save();

    res.status(200).json({
      success: true,
      data: {
        _id: ownerUser._id,
        name: ownerUser.name,
        email: ownerUser.email,
        organization: ownerUser.organization,
        organizationRole: ownerUser.organizationRole,
        isOwner: ownerUser.isOwner,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Cancel organization subscription (platform admin)
// @route   PUT /api/organizations/admin/:id/cancel-subscription
// @access  Private (super admin / authority)
exports.cancelOrganizationSubscriptionAdmin = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const organization = await Organization.findById(req.params.id);

    if (!organization) {
      return next(new ErrorResponse('Organization not found', 404));
    }

    // Update organization subscription status
    organization.subscription.status = 'cancelled';
    organization.subscription.cancelledAt = new Date();
    organization.subscription.cancellationReason = reason || 'Cancelled by admin';
    await organization.save();

    // Find and update subscription record if exists
    const Subscription = require('../models/Subscription');
    const subscription = await Subscription.findOne({
      organization: organization._id
    });

    if (subscription) {
      subscription.status = 'cancelled';
      subscription.cancelledAt = new Date();
      await subscription.save();
    }

    // Log the cancellation
    console.log(`[ADMIN] Organization ${organization.name} subscription cancelled by ${req.user.email}. Reason: ${reason || 'None provided'}`);

    res.status(200).json({
      success: true,
      message: 'Organization subscription cancelled successfully',
      data: {
        organization: {
          _id: organization._id,
          name: organization.name,
          subscription: organization.subscription
        }
      }
    });
  } catch (error) {
    console.error('Cancel subscription error:', error);
    next(error);
  }
};

// @desc    Update organization modules (platform admin)
// @route   PUT /api/organizations/admin/:id/modules
// @access  Private (super admin / authority)
exports.updateOrganizationModules = async (req, res, next) => {
  try {
    const { modules } = req.body;

    if (!modules || !Array.isArray(modules)) {
      return next(new ErrorResponse('Modules must be provided as an array', 400));
    }

    // Validate modules array
    const validModules = ['inventory', 'accounting', 'hrm', 'crm', 'projects', 'custom-invoicing'];
    const invalidModules = modules.filter(m => !validModules.includes(m));

    if (invalidModules.length > 0) {
      return next(new ErrorResponse(`Invalid modules: ${invalidModules.join(', ')}. Valid modules are: ${validModules.join(', ')}`, 400));
    }

    if (modules.length === 0) {
      return next(new ErrorResponse('At least one module must be enabled', 400));
    }

    const organization = await Organization.findById(req.params.id);
    if (!organization) {
      return next(new ErrorResponse('Organization not found', 404));
    }

    organization.modules = modules;
    await organization.save();

    // Log the module update
    console.log(`[ADMIN] Organization ${organization.name} modules updated by ${req.user.email}. New modules: ${modules.join(', ')}`);

    res.status(200).json({
      success: true,
      message: 'Organization modules updated successfully',
      data: {
        organization: {
          _id: organization._id,
          name: organization.name,
          modules: organization.modules
        }
      }
    });
  } catch (error) {
    console.error('Update modules error:', error);
    next(error);
  }
};