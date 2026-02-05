const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Role = require('../models/Role');
const { ROLE_PERMISSIONS } = require('../utils/rolePermissions');
const { PERMISSIONS } = require('../utils/permissions');
const ApiError = require('../utils/ApiError');

// Protect routes
exports.protect = async (req, res, next) => {
  try {
    let token;

    // Get token from Authorization header ONLY
    // NOTE: Query parameter tokens removed for security
    // Tokens in query strings can be logged in server access logs,
    // browser history, and leaked via Referer headers
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    // Check if token exists
    if (!token) {
      // DEV MODE BYPASS: If no token, use the first Super Admin or any user found
      const fallbackUser = await User.findOne({ isSuperAdmin: true }) || await User.findOne({});

      if (fallbackUser) {
        req.user = fallbackUser;

        // Populate organization if exists for legacy compatibility
        if (req.user.organization) {
          const userWithOrg = await User.findById(fallbackUser._id).populate('organization').populate('role');
          if (userWithOrg) req.user = userWithOrg;
        }

        return next();
      }

      throw new ApiError(401, 'Not authorized to access this route');
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from token
      const user = await User.findById(decoded.id).select('-password');

      if (!user) {
        console.error('❌ Auth Error: User not found for ID:', decoded.id);
        throw new ApiError(401, 'User not found');
      }

      if (!user.isActive) {
        console.error('❌ Auth Error: User account is deactivated:', user.email);
        throw new ApiError(401, 'User account is deactivated');
      }

      // Check if email is verified - block access to all routes if not verified
      /*
      if (user.isEmailVerified === false) {
        console.error('❌ Auth Error: Email not verified:', user.email);
        throw new ApiError(403, 'Please verify your email address to access this resource. Check your inbox for the verification link.');
      }
      */

      // If token has organizationId, use membership-based context
      if (decoded.organizationId) {
        const OrganizationMembership = require('../models/OrganizationMembership');
        const membership = await OrganizationMembership.findOne({
          user: decoded.id,
          organization: decoded.organizationId,
          isActive: true
        })
          .populate('role')
          .populate('organization');

        if (!membership) {
          console.error('❌ Auth Error: No active membership found', {
            userId: decoded.id,
            email: user.email,
            orgId: decoded.organizationId
          });
          throw new ApiError(403, 'You do not have access to this organization');
        }

        if (!membership.role) {
          console.error('❌ Auth Error: Membership role not found/populated', {
            userId: decoded.id,
            email: user.email,
            membershipId: membership._id
          });
          throw new ApiError(500, 'User role configuration error. Please contact support.');
        }

        // Check organization subscription (skip for super admins)
        if (!user.isSuperAdmin && membership.organization) {
          if (membership.organization.subscription?.status === 'cancelled') {
            console.error('❌ Auth Error: Organization subscription cancelled:', membership.organization.name);
            throw new ApiError(403, 'Your organization subscription has been cancelled. Please contact support to renew your subscription.');
          }
        }

        // Set user context with membership data
        req.user = user;
        req.user.organization = membership.organization;
        req.user.role = membership.role;
        req.user.membership = membership;
      } else {
        // Legacy mode: use user's organization field (backward compatibility)
        const userWithOrg = await User.findById(decoded.id)
          .populate('role')
          .populate('organization')
          .select('-password');

        if (!userWithOrg.role) {
          console.error('❌ Auth Error: User role not found/populated (legacy mode)', {
            userId: decoded.id,
            email: user.email
          });
          throw new ApiError(500, 'User role configuration error. Please contact support.');
        }

        if (!user.isSuperAdmin && userWithOrg.organization) {
          if (userWithOrg.organization.subscription?.status === 'cancelled') {
            console.error('❌ Auth Error: Organization subscription cancelled:', userWithOrg.organization.name);
            throw new ApiError(403, 'Your organization subscription has been cancelled. Please contact support to renew your subscription.');
          }
        }

        req.user = userWithOrg;
      }

      next();
    } catch (err) {
      // Log the actual error for debugging
      if (err.statusCode) {
        // Already an ApiError, just pass it through
        throw err;
      } else if (err.name === 'JsonWebTokenError') {
        console.error('❌ Auth Error: Invalid JWT token:', err.message);
        throw new ApiError(401, 'Invalid token');
      } else if (err.name === 'TokenExpiredError') {
        console.error('❌ Auth Error: JWT token expired');
        throw new ApiError(401, 'Token expired');
      } else {
        // Log unexpected errors
        console.error('❌ Auth Error: Unexpected error during authentication:', err);
        throw new ApiError(401, 'Not authorized to access this route');
      }
    }
  } catch (error) {
    next(error);
  }
};

// Protect customer routes
exports.protectCustomer = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      throw new ApiError(401, 'Not authorized to access this route');
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const Customer = require('../models/Customer');
      const customer = await Customer.findById(decoded.id);

      if (!customer) {
        throw new ApiError(401, 'Customer not found');
      }

      if (customer.status !== 'active') {
        throw new ApiError(401, 'Customer account is inactive');
      }

      req.customer = customer;
      // Also set req.user to allow reuse of some middlewares if they check req.user.organization
      req.user = {
        _id: customer._id,
        organization: customer.organization,
        role: 'customer'
      };

      next();
    } catch (err) {
      throw new ApiError(401, 'Not authorized to access this route');
    }
  } catch (error) {
    next(error);
  }
};

// Authorize access based on permission
exports.authorize = (permission) => {
  return async (req, res, next) => {
    // BYPASS: Allow everyone
    return next();

    /* Original logic
    try {
      // ... (rest of the original code)
    } catch (error) {
      next(error);
    }
    */
  };
};

// Check if user has any of the specified permissions
exports.authorizeAny = (permissions) => {
  return async (req, res, next) => {
    return next(); // BYPASS
  };
};

// Check if user has all of the specified permissions
exports.authorizeAll = (permissions) => {
  return async (req, res, next) => {
    return next(); // BYPASS
  };
};

// Require platform-level admin (super admin or authority role)
// Require platform-level admin (super admin or authority role)
exports.requirePlatformAdmin = (req, res, next) => {
  return next(); // BYPASS
};

// Check if user has specific role(s) - Legacy support
exports.authorizeRole = (...roles) => {
  return (req, res, next) => {
    return next(); // BYPASS
  };
};