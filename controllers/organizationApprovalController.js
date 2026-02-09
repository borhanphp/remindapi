const Organization = require('../models/Organization');
const User = require('../models/User');

/**
 * @desc    Get all organizations with their approval status
 * @route   GET /api/admin/organizations
 * @access  Private/SuperAdmin
 */
exports.getAllOrganizations = async (req, res) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;

    // Build filter
    const filter = {};
    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      filter.approvalStatus = status;
    }
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { slug: { $regex: search, $options: 'i' } }
      ];
    }

    // Get total count
    const total = await Organization.countDocuments(filter);

    // Get organizations with pagination
    const organizations = await Organization.find(filter)
      .populate('approvedBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Get owner details for each organization
    const orgsWithOwners = await Promise.all(
      organizations.map(async (org) => {
        const owner = await User.findOne({
          organization: org._id,
          isOwner: true
        }).select('name email isEmailVerified');

        return {
          ...org.toObject(),
          owner: owner ? {
            name: owner.name,
            email: owner.email,
            isEmailVerified: owner.isEmailVerified
          } : null
        };
      })
    );

    res.json({
      success: true,
      data: orgsWithOwners,
      meta: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get organizations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch organizations'
    });
  }
};

/**
 * @desc    Get organization details
 * @route   GET /api/admin/organizations/:id
 * @access  Private/SuperAdmin
 */
exports.getOrganizationDetails = async (req, res) => {
  try {
    const organization = await Organization.findById(req.params.id)
      .populate('approvedBy', 'name email');

    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found'
      });
    }

    // Get all users in this organization
    const users = await User.find({ organization: organization._id })
      .select('name email role isActive isOwner isEmailVerified')
      .populate('role', 'name');

    res.json({
      success: true,
      data: {
        organization: organization.toObject(),
        users
      }
    });

  } catch (error) {
    console.error('Get organization details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch organization details'
    });
  }
};

/**
 * @desc    Approve organization
 * @route   PUT /api/admin/organizations/:id/approve
 * @access  Private/SuperAdmin
 */
exports.approveOrganization = async (req, res) => {
  try {
    const organization = await Organization.findById(req.params.id);

    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found'
      });
    }

    if (organization.approvalStatus === 'approved') {
      return res.status(400).json({
        success: false,
        message: 'Organization is already approved'
      });
    }

    // Update organization status
    organization.approvalStatus = 'approved';
    organization.approvedBy = req.user._id;
    organization.approvedAt = new Date();
    organization.rejectionReason = undefined; // Clear any rejection reason
    await organization.save();

    // TODO: Send email notification to organization owner
    const owner = await User.findOne({
      organization: organization._id,
      isOwner: true
    });

    if (owner) {
      // You can implement email notification here
      console.log(`Organization ${organization.name} approved. Owner: ${owner.email}`);
    }

    res.json({
      success: true,
      message: 'Organization approved successfully',
      data: organization
    });

  } catch (error) {
    console.error('Approve organization error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve organization'
    });
  }
};

/**
 * @desc    Reject organization
 * @route   PUT /api/admin/organizations/:id/reject
 * @access  Private/SuperAdmin
 */
exports.rejectOrganization = async (req, res) => {
  try {
    const { reason } = req.body;
    const organization = await Organization.findById(req.params.id);

    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found'
      });
    }

    if (organization.approvalStatus === 'rejected') {
      return res.status(400).json({
        success: false,
        message: 'Organization is already rejected'
      });
    }

    // Update organization status
    organization.approvalStatus = 'rejected';
    organization.approvedBy = req.user._id;
    organization.approvedAt = new Date();
    organization.rejectionReason = reason || 'No reason provided';
    await organization.save();

    // TODO: Send email notification to organization owner
    const owner = await User.findOne({
      organization: organization._id,
      isOwner: true
    });

    if (owner) {
      // You can implement email notification here
      console.log(`Organization ${organization.name} rejected. Owner: ${owner.email}`);
    }

    res.json({
      success: true,
      message: 'Organization rejected successfully',
      data: organization
    });

  } catch (error) {
    console.error('Reject organization error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject organization'
    });
  }
};

/**
 * @desc    Get approval statistics
 * @route   GET /api/admin/organizations/stats
 * @access  Private/SuperAdmin
 */
exports.getApprovalStats = async (req, res) => {
  try {
    const [pending, approved, rejected, total] = await Promise.all([
      Organization.countDocuments({ approvalStatus: 'pending' }),
      Organization.countDocuments({ approvalStatus: 'approved' }),
      Organization.countDocuments({ approvalStatus: 'rejected' }),
      Organization.countDocuments()
    ]);

    res.json({
      success: true,
      data: {
        pending,
        approved,
        rejected,
        total
      }
    });

  } catch (error) {
    console.error('Get approval stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics'
    });
  }
};

/**
 * @desc    Deactivate/Activate organization
 * @route   PUT /api/admin/organizations/:id/toggle-status
 * @access  Private/SuperAdmin
 */
exports.toggleOrganizationStatus = async (req, res) => {
  try {
    const organization = await Organization.findById(req.params.id);

    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found'
      });
    }

    // Toggle isActive status
    organization.isActive = !organization.isActive;
    await organization.save();

    // Also update all users in the organization
    await User.updateMany(
      { organization: organization._id },
      { isActive: organization.isActive }
    );

    res.json({
      success: true,
      message: `Organization ${organization.isActive ? 'activated' : 'deactivated'} successfully`,
      data: organization
    });

  } catch (error) {
    console.error('Toggle organization status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update organization status'
    });
  }
};

/**
 * @desc    Delete organization and all related data
 * @route   DELETE /api/admin/organizations/:id
 * @access  Private/SuperAdmin
 */
exports.deleteOrganization = async (req, res) => {
  try {
    const organization = await Organization.findById(req.params.id);

    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found'
      });
    }

    // Delete all users in the organization
    await User.deleteMany({ organization: organization._id });

    // Delete organization memberships
    const OrganizationMembership = require('../models/OrganizationMembership');
    await OrganizationMembership.deleteMany({ organization: organization._id });

    // Delete roles for this organization
    const Role = require('../models/Role');
    await Role.deleteMany({ organization: organization._id });

    // Delete the organization
    await Organization.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Organization and all related data deleted successfully'
    });

  } catch (error) {
    console.error('Delete organization error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete organization'
    });
  }
};

/**
 * @desc    Cancel organization subscription
 * @route   PUT /api/admin/organizations/:id/cancel-subscription
 * @access  Private/SuperAdmin
 */
exports.cancelSubscription = async (req, res) => {
  try {
    const { reason } = req.body;
    const organization = await Organization.findById(req.params.id);

    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found'
      });
    }

    if (!organization.subscription || organization.subscription.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Organization has no active subscription'
      });
    }

    // Update subscription status
    organization.subscription.status = 'cancelled';
    organization.subscription.cancellationReason = reason || 'Cancelled by admin';
    organization.subscription.cancelledAt = new Date();
    organization.subscription.plan = 'free';
    await organization.save();

    res.json({
      success: true,
      message: 'Subscription cancelled successfully',
      data: organization
    });

  } catch (error) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel subscription'
    });
  }
};
