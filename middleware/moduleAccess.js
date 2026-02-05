const ApiError = require('../utils/ApiError');
const Organization = require('../models/Organization');

/**
 * Module access control middleware
 * Checks if the organization has access to a specific module
 * @param {string} module - The module name (inventory, accounting, hrm, crm, projects, custom-invoicing)
 */
exports.checkModuleAccess = (module) => {
  return async (req, res, next) => {
    try {
      // Super admins bypass all module checks
      if (req.user && req.user.isSuperAdmin) {
        return next();
      }

      // Get user's organization
      const organizationId = req.user.organization?._id || req.user.organization;
      
      if (!organizationId) {
        throw new ApiError(403, 'No organization associated with this user');
      }

      // Fetch organization to check modules
      const organization = await Organization.findById(organizationId);
      
      if (!organization) {
        throw new ApiError(404, 'Organization not found');
      }

      // Check if organization subscription is active
      if (organization.subscription?.status === 'cancelled' || organization.subscription?.status === 'expired') {
        throw new ApiError(403, 'Your organization subscription is not active. Please contact support.');
      }

      // Check if the organization has access to the module
      if (!organization.modules || !organization.modules.includes(module)) {
        throw new ApiError(
          403, 
          `Access denied. Your organization does not have access to the ${module} module. Please contact your administrator to enable this module.`
        );
      }

      // Store module info in request for potential use downstream
      req.currentModule = module;
      
      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Check if organization has access to any of the specified modules
 */
exports.checkModuleAccessAny = (modules) => {
  return async (req, res, next) => {
    try {
      // Super admins bypass all module checks
      if (req.user && req.user.isSuperAdmin) {
        return next();
      }

      const organizationId = req.user.organization?._id || req.user.organization;
      
      if (!organizationId) {
        throw new ApiError(403, 'No organization associated with this user');
      }

      const organization = await Organization.findById(organizationId);
      
      if (!organization) {
        throw new ApiError(404, 'Organization not found');
      }

      // Check if organization has access to at least one of the modules
      const hasAccess = modules.some(module => 
        organization.modules && organization.modules.includes(module)
      );

      if (!hasAccess) {
        throw new ApiError(
          403, 
          `Access denied. Your organization does not have access to any of these modules: ${modules.join(', ')}`
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Module constants for easy reference
 */
exports.MODULES = {
  INVENTORY: 'inventory',
  ACCOUNTING: 'accounting',
  HRM: 'hrm',
  CRM: 'crm',
  PROJECTS: 'projects'
};

