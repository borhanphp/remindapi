const Organization = require('../models/Organization');
const Subscription = require('../models/Subscription');
const ErrorResponse = require('../utils/errorResponse');
const ApiError = require('../utils/ApiError');

// Middleware to set organization context
exports.setOrganizationContext = async (req, res, next) => {
  try {
    if (!req.user) {
      return next(new ErrorResponse('Not authenticated', 401));
    }

    const organization = await Organization.findById(req.user.organization);
    if (!organization) {
      return next(new ErrorResponse('Organization not found', 404));
    }

    // Check subscription status
    const subscription = await Subscription.findOne({ 
      organization: organization._id,
      status: { $in: ['active', 'trial'] }
    });

    if (!subscription && organization.subscription.status !== 'trial') {
      return next(new ErrorResponse('Subscription required', 403));
    }

    // Add organization and subscription to request
    req.organization = organization;
    req.subscription = subscription || {
      plan: 'free',
      status: 'trial',
      features: Subscription.plans.free.features
    };

    next();
  } catch (error) {
    next(error);
  }
};

// Middleware to check feature access
exports.checkFeatureAccess = (feature) => {
  return (req, res, next) => {
    if (!req.subscription) {
      return next(new ErrorResponse('Subscription required', 403));
    }

    const planFeatures = Subscription.plans[req.subscription.plan].features;
    if (!planFeatures[feature]) {
      return next(new ErrorResponse(`Feature '${feature}' not available in your plan`, 403));
    }

    next();
  };
};

// Middleware to check usage limits
exports.checkUsageLimit = async (model, limit) => {
  return async (req, res, next) => {
    try {
      if (!req.subscription) {
        return next(new ErrorResponse('Subscription required', 403));
      }

      const planFeatures = Subscription.plans[req.subscription.plan].features;
      const maxLimit = planFeatures[limit];

      // If unlimited (-1), allow
      if (maxLimit === -1) {
        return next();
      }

      // Check current usage
      const count = await model.countDocuments({ organization: req.organization._id });
      if (count >= maxLimit) {
        return next(new ErrorResponse(`You have reached the maximum limit for ${limit}`, 403));
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

// Middleware to check role permissions
exports.checkRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new ErrorResponse('Not authenticated', 401));
    }

    if (!roles.includes(req.user.role)) {
      return next(new ErrorResponse('Not authorized to access this route', 403));
    }

    next();
  };
}; 

// Middleware to ensure user has an organization
exports.requireOrganization = (req, res, next) => {
  try {
    if (!req.user.organization) {
      throw new ApiError(400, 'User must be part of an organization to access this resource');
    }
    next();
  } catch (error) {
    next(error);
  }
};

// Middleware to check if user is organization admin
exports.requireOrganizationAdmin = (req, res, next) => {
  try {
    if (!req.user.organization) {
      throw new ApiError(400, 'User must be part of an organization to access this resource');
    }
    
    // Check if user is owner or admin
    const isAdmin = req.user.isOwner || 
                   req.user.organizationRole === 'owner' || 
                   req.user.organizationRole === 'admin' ||
                   req.user.legacyRole === 'admin';
    
    if (!isAdmin) {
      throw new ApiError(403, 'Access denied. Organization admin privileges required');
    }
    
    next();
  } catch (error) {
    next(error);
  }
};

// Middleware to check if user is organization owner
exports.requireOrganizationOwner = (req, res, next) => {
  try {
    if (!req.user.organization) {
      throw new ApiError(400, 'User must be part of an organization to access this resource');
    }
    
    // Check if user is owner
    const isOwner = req.user.isOwner || req.user.organizationRole === 'owner';
    
    if (!isOwner) {
      throw new ApiError(403, 'Access denied. Organization owner privileges required');
    }
    
    next();
  } catch (error) {
    next(error);
  }
}; 