const User = require('../models/User');
const Role = require('../models/Role');
const sendEmail = require('../utils/sendEmail');

/**
 * @desc    Get all users with their roles (including inactive)
 * @route   GET /api/users
 * @access  Private/Admin
 */
exports.getUsers = async (req, res) => {
  try {
    const OrganizationMembership = require('../models/OrganizationMembership');
    
    // Get all memberships for this organization (active and inactive)
    const memberships = await OrganizationMembership.find({
      organization: req.user.organization
    })
    .populate({
      path: 'user',
      select: '-password'
    })
    .populate('role', 'name description permissions')
    .sort({ joinedAt: -1 });
    
    // Transform to include isActive status
    const users = memberships
      .filter(m => m.user) // Filter out any orphaned memberships
      .map(m => ({
        _id: m.user._id,
        name: m.user.name,
        email: m.user.email,
        role: m.role,
        isActive: m.isActive,
        isEmailVerified: m.user.isEmailVerified,
        lastLogin: m.user.lastLogin,
        joinedAt: m.joinedAt,
        membershipId: m._id // Include membership ID for activation/deactivation
      }));
    
    res.status(200).json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * @desc    Get single user with role
 * @route   GET /api/users/:id
 * @access  Private/Admin
 */
exports.getUser = async (req, res) => {
  try {
    const user = await User.findOne({ 
      _id: req.params.id, 
      organization: req.user.organization 
    })
      .populate('role', 'name description permissions')
      .select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error(error);
    
    if (error.kind === 'ObjectId') {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * @desc    Create user with role assignment
 * @route   POST /api/users
 * @access  Private/Admin
 */
exports.createUser = async (req, res) => {
  try {
    const { name, email, password, roleId, isActive } = req.body;
    const OrganizationMembership = require('../models/OrganizationMembership');
    
    // Validate role exists in current organization
    const role = await Role.findOne({ _id: roleId, $or: [ { organization: req.user.organization }, { organization: null } ] });
    if (!role) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role specified'
      });
    }
    
    // Check if user already exists
    let user = await User.findOne({ email });
    let isNewUser = false;
    let membership;
    
    if (user) {
      // User exists - check if they're already a member of this organization
      const existingMembership = await OrganizationMembership.findOne({
        user: user._id,
        organization: req.user.organization
      });
      
      if (existingMembership) {
        // Check if membership is active
        if (existingMembership.isActive) {
          return res.status(400).json({
            success: false,
            message: 'User is already a member of this organization'
          });
        }
        
        // Reactivate the inactive membership
        existingMembership.isActive = true;
        existingMembership.role = roleId;
        existingMembership.invitedBy = req.user._id;
        existingMembership.joinedAt = new Date();
        await existingMembership.save();
        
        membership = existingMembership;
        console.log(`✅ Reactivated membership for user ${user.email} in organization ${req.user.organization}`);
      } else {
        // Create new membership for existing user
        membership = await OrganizationMembership.create({
          user: user._id,
          organization: req.user.organization,
          role: roleId,
          invitedBy: req.user._id,
          isActive: isActive === undefined ? true : isActive
        });
        
        console.log(`✅ Added existing user ${user.email} to organization ${req.user.organization}`);
      }
    } else {
      // Create new user
      isNewUser = true;
      user = await User.create({
        name,
        email,
        password,
        role: roleId, // Keep for backward compatibility
        organization: req.user.organization, // Keep for backward compatibility
        isActive: isActive === undefined ? true : isActive,
        isEmailVerified: false // Require email verification
      });
      
      // Create membership for new user
      membership = await OrganizationMembership.create({
        user: user._id,
        organization: req.user.organization,
        role: roleId,
        invitedBy: req.user._id,
        isActive: isActive === undefined ? true : isActive
      });
      
      console.log(`✅ Created new user ${user.email} and added to organization ${req.user.organization}`);
    }
    
    // Handle email notification based on whether user is new or existing
    const Organization = require('../models/Organization');
    const org = await Organization.findById(req.user.organization);
    
    let verificationUrl = '';
    
    // Only generate verification token for new users or unverified users
    if (isNewUser || !user.isEmailVerified) {
      const verificationToken = user.getEmailVerificationToken();
      await user.save({ validateBeforeSave: false });
      verificationUrl = `${process.env.FRONTEND_URL}/verify-email/${verificationToken}`;
    }
    
    try {
      if (isNewUser) {
        // New user - send verification email
        await sendEmail({
          to: user.email,
          subject: `Welcome to ${org?.name || process.env.APP_NAME || 'Zeeventory'} - Verify Your Email`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #4F46E5;">Welcome to ${org?.name || process.env.APP_NAME || 'Zeeventory'}!</h1>
              <p>Hi ${user.name},</p>
              <p>An account has been created for you in ${org?.name || 'the organization'} by ${req.user.name}.</p>
              <p>To get started, please verify your email address by clicking the button below:</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${verificationUrl}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Verify Email Address</a>
              </div>
              <p><strong>Your Login Credentials:</strong></p>
              <p>Email: ${user.email}<br>Password: The password set by your administrator</p>
              <p>This verification link will expire in 24 hours.</p>
              <p>If you have any questions, feel free to contact our support team.</p>
              <p>Best regards,<br>The ${org?.name || process.env.APP_NAME || 'Zeeventory'} Team</p>
            </div>
          `,
          text: `Welcome to ${org?.name || process.env.APP_NAME || 'Zeeventory'}! An account has been created for you. Please verify your email: ${verificationUrl}`
        });
      } else if (!user.isEmailVerified) {
        // Existing user but not verified - send verification email
        await sendEmail({
          to: user.email,
          subject: `You've been invited to ${org?.name || process.env.APP_NAME || 'Zeeventory'}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #4F46E5;">New Organization Invitation</h1>
              <p>Hi ${user.name},</p>
              <p>You have been invited to join ${org?.name || 'a new organization'} by ${req.user.name}.</p>
              <p>Please verify your email address to access this organization:</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${verificationUrl}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Verify Email Address</a>
              </div>
              <p><strong>Login with your existing credentials:</strong></p>
              <p>Email: ${user.email}<br>Password: Use your existing password</p>
              <p>After verification, you can log in and select which organization to access.</p>
              <p>Best regards,<br>The ${org?.name || process.env.APP_NAME || 'Zeeventory'} Team</p>
            </div>
          `,
          text: `You've been invited to join ${org?.name || process.env.APP_NAME}. Please verify your email: ${verificationUrl}`
        });
      } else {
        // Existing verified user - send invitation notification only
        const loginUrl = `${process.env.FRONTEND_URL}/login`;
        await sendEmail({
          to: user.email,
          subject: `You've been invited to ${org?.name || process.env.APP_NAME || 'Zeeventory'}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #4F46E5;">New Organization Invitation</h1>
              <p>Hi ${user.name},</p>
              <p>Good news! You have been invited to join <strong>${org?.name || 'a new organization'}</strong> by ${req.user.name}.</p>
              <p>You can now access this organization using your existing login credentials.</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${loginUrl}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Log In Now</a>
              </div>
              <p><strong>Your Login Credentials:</strong></p>
              <p>Email: ${user.email}<br>Password: Use your existing password</p>
              <p>After logging in, you'll be able to select which organization you want to work with.</p>
              <p>Best regards,<br>The ${org?.name || process.env.APP_NAME || 'Zeeventory'} Team</p>
            </div>
          `,
          text: `You've been invited to join ${org?.name || process.env.APP_NAME}. Log in with your existing credentials: ${loginUrl}`
        });
      }
      
      console.log(`✅ ${isNewUser ? 'Verification' : 'Invitation'} email sent to ${user.email}`);
    } catch (emailError) {
      console.error('Failed to send email:', emailError);
      // Don't fail user creation if email fails
    }
    
    // Populate membership with role and organization
    await membership.populate('role', 'name description permissions');
    await membership.populate('organization', 'name logo modules');
    
    // Populate user response
    const userResponse = await User.findById(user._id).select('-password');
    
    res.status(201).json({
      success: true,
      message: isNewUser ? 'User created successfully. Verification email sent.' : 'User added to organization. Verification email sent.',
      data: {
        ...userResponse.toObject(),
        role: membership.role,
        organization: membership.organization,
        membershipId: membership._id
      }
    });
  } catch (error) {
    console.error(error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', ')
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * @desc    Update user including role assignment
 * @route   PUT /api/users/:id
 * @access  Private/Admin
 */
exports.updateUser = async (req, res) => {
  try {
    let user = await User.findOne({ 
      _id: req.params.id, 
      organization: req.user.organization 
    });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Fields to update
    const { name, email, password, roleId, isActive } = req.body;
    
    // Build update object
    const updateFields = {};
    if (name) updateFields.name = name;
    if (email) updateFields.email = email;
    if (password) updateFields.password = password; // Will be hashed by User model middleware
    if (isActive !== undefined) updateFields.isActive = isActive;
    
    // Validate role if provided
    if (roleId) {
      const role = await Role.findOne({ _id: roleId, $or: [ { organization: req.user.organization }, { organization: null } ] });
      if (!role) {
        return res.status(400).json({
          success: false,
          message: 'Invalid role specified'
        });
      }
      updateFields.role = roleId;
    }
    
    // Update user
    user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: updateFields },
      { new: true, runValidators: true }
    )
    .populate('role', 'name description permissions')
    .select('-password');
    
    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error(error);
    
    if (error.kind === 'ObjectId') {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', ')
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * @desc    Assign role to user
 * @route   PUT /api/users/:id/role
 * @access  Private/Admin
 */
exports.assignRole = async (req, res) => {
  try {
    const { roleId } = req.body;
    
    // Validate user exists in this organization
    const user = await User.findOne({ 
      _id: req.params.id, 
      organization: req.user.organization 
    });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Validate role exists
    const role = await Role.findOne({ _id: roleId, $or: [ { organization: req.user.organization }, { organization: null } ] });
    if (!role) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role specified'
      });
    }
    
    // Update user role
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { role: roleId },
      { new: true, runValidators: true }
    )
    .populate('role', 'name description permissions')
    .select('-password');
    
    res.status(200).json({
      success: true,
      message: 'Role assigned successfully',
      data: updatedUser
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * @desc    Get user permissions
 * @route   GET /api/users/:id/permissions
 * @access  Private/Admin
 */
exports.getUserPermissions = async (req, res) => {
  try {
    const user = await User.findOne({ 
      _id: req.params.id, 
      organization: req.user.organization 
    }).populate('role');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    const permissions = user.role ? user.role.permissions : [];
    
    res.status(200).json({
      success: true,
      data: {
        userId: user._id,
        roleName: user.role ? user.role.name : null,
        permissions
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * @desc    Delete user (remove from organization)
 * @route   DELETE /api/users/:id
 * @access  Private/Admin
 */
exports.deleteUser = async (req, res) => {
  try {
    const OrganizationMembership = require('../models/OrganizationMembership');
    
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Prevent admin from deleting themselves
    if (req.user.id === req.params.id) {
      return res.status(400).json({
        success: false,
        message: 'You cannot delete your own account'
      });
    }
    
    // Find the membership for this user in the current organization
    const membership = await OrganizationMembership.findOne({
      user: req.params.id,
      organization: req.user.organization
    });
    
    if (!membership) {
      return res.status(404).json({
        success: false,
        message: 'User is not a member of this organization'
      });
    }
    
    // Deactivate the membership instead of deleting the user
    membership.isActive = false;
    await membership.save();
    
    console.log(`✅ Deactivated membership for user ${user.email} in organization ${req.user.organization}`);
    
    res.status(200).json({
      success: true,
      message: 'User removed from organization successfully',
      data: {}
    });
  } catch (error) {
    console.error(error);
    
    if (error.kind === 'ObjectId') {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * @desc    Toggle user active status (activate/deactivate)
 * @route   PUT /api/users/:id/toggle-status
 * @access  Private/Admin
 */
exports.toggleUserStatus = async (req, res) => {
  try {
    const OrganizationMembership = require('../models/OrganizationMembership');
    
    // Prevent admin from deactivating themselves
    if (req.user.id === req.params.id) {
      return res.status(400).json({
        success: false,
        message: 'You cannot deactivate your own account'
      });
    }
    
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Find the membership for this user in the current organization
    const membership = await OrganizationMembership.findOne({
      user: req.params.id,
      organization: req.user.organization
    });
    
    if (!membership) {
      return res.status(404).json({
        success: false,
        message: 'User is not a member of this organization'
      });
    }
    
    // Toggle the active status
    membership.isActive = !membership.isActive;
    await membership.save();
    
    const action = membership.isActive ? 'activated' : 'deactivated';
    console.log(`✅ ${action} membership for user ${user.email} in organization ${req.user.organization}`);
    
    res.status(200).json({
      success: true,
      message: `User ${action} successfully`,
      data: {
        isActive: membership.isActive
      }
    });
  } catch (error) {
    console.error(error);
    
    if (error.kind === 'ObjectId') {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
}; 
