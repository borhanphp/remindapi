const Role = require('../models/Role');
const { PERMISSIONS } = require('../utils/permissions');

/**
 * @desc    Get all roles (including custom roles)
 * @route   GET /api/roles
 * @access  Private/Admin
 */
exports.getRoles = async (req, res) => {
  try {
    const roles = await Role.find({ organization: req.user.organization });
    
    res.status(200).json({
      success: true,
      count: roles.length,
      data: roles
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
 * @desc    Get custom roles only
 * @route   GET /api/roles/custom
 * @access  Private/Admin
 */
exports.getCustomRoles = async (req, res) => {
  try {
    const roles = await Role.find({ organization: req.user.organization, isCustom: true });
    
    res.status(200).json({
      success: true,
      count: roles.length,
      data: roles
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
 * @desc    Get single role
 * @route   GET /api/roles/:id
 * @access  Private/Admin
 */
exports.getRole = async (req, res) => {
  try {
    const role = await Role.findOne({ _id: req.params.id, organization: req.user.organization });
    
    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Role not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: role
    });
  } catch (error) {
    console.error(error);
    
    if (error.kind === 'ObjectId') {
      return res.status(404).json({
        success: false,
        message: 'Role not found'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * @desc    Create role
 * @route   POST /api/roles
 * @access  Private/Admin
 */
exports.createRole = async (req, res) => {
  try {
    const { name, description, permissions } = req.body;
    const org = req.user.organization;
    
    // Check if role already exists
    const roleExists = await Role.findOne({ organization: org, name: name.toLowerCase() });
    
    if (roleExists) {
      return res.status(400).json({
        success: false,
        message: 'Role with this name already exists'
      });
    }
    
    // Create role
    const role = await Role.create({
      organization: org,
      name: name.toLowerCase(),
      description,
      permissions,
      isCustom: true
    });
    try { const { logAudit } = require('../utils/audit'); await logAudit({ req, action: 'role_create', entityType: 'Role', entityId: role._id, before: null, after: role.toObject() }); } catch(e) {}
    
    res.status(201).json({
      success: true,
      data: role
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
 * @desc    Update role
 * @route   PUT /api/roles/:id
 * @access  Private/Admin
 */
exports.updateRole = async (req, res) => {
  try {
    const { name, description, permissions } = req.body;
    const org = req.user.organization;
    let role = await Role.findOne({ _id: req.params.id, organization: org });
    
    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Role not found'
      });
    }
    
    // Don't allow updating if not a custom role
    if (!role.isCustom) {
      return res.status(400).json({
        success: false,
        message: 'Cannot modify system-defined roles'
      });
    }
    
    // Check if new name already exists (if name is being changed)
    if (name && name.toLowerCase() !== role.name) {
      const nameExists = await Role.findOne({ organization: org, name: name.toLowerCase() });
      if (nameExists) {
        return res.status(400).json({
          success: false,
          message: 'Role with this name already exists'
        });
      }
    }
    
    // Update role
    const before = role.toObject();
    role = await Role.findOneAndUpdate(
      { _id: req.params.id, organization: org },
      { 
        name: name?.toLowerCase(),
        description,
        permissions
      },
      { new: true, runValidators: true }
    );
    try { const { logAudit } = require('../utils/audit'); await logAudit({ req, action: 'role_update', entityType: 'Role', entityId: role._id, before, after: role.toObject() }); } catch(e) {}
    
    res.status(200).json({
      success: true,
      data: role
    });
  } catch (error) {
    console.error(error);
    
    if (error.kind === 'ObjectId') {
      return res.status(404).json({
        success: false,
        message: 'Role not found'
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
 * @desc    Delete role
 * @route   DELETE /api/roles/:id
 * @access  Private/Admin
 */
exports.deleteRole = async (req, res) => {
  try {
    const role = await Role.findOne({ _id: req.params.id, organization: req.user.organization });
    
    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Role not found'
      });
    }
    
    // Don't allow deleting if not a custom role
    if (!role.isCustom) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete system-defined roles'
      });
    }

    // TODO: Check if any users have this role assigned
    // If yes, prevent deletion or update those users to a default role
    
    const before = role.toObject();
    await role.deleteOne();
    try { const { logAudit } = require('../utils/audit'); await logAudit({ req, action: 'role_delete', entityType: 'Role', entityId: role._id, before, after: null }); } catch(e) {}
    
    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    console.error(error);
    
    if (error.kind === 'ObjectId') {
      return res.status(404).json({
        success: false,
        message: 'Role not found'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * @desc    Add permissions to a role
 * @route   POST /api/roles/:id/permissions/add
 * @access  Private/Admin
 */
exports.addPermissions = async (req, res) => {
  try {
    const org = req.user.organization;
    const { permissions = [] } = req.body || {};
    const role = await Role.findOne({ _id: req.params.id, organization: org });
    if (!role) return res.status(404).json({ success: false, message: 'Role not found' });
    if (!role.isCustom) return res.status(400).json({ success: false, message: 'Cannot modify system-defined roles' });

    const registry = new Set(Object.values(PERMISSIONS));
    const before = role.toObject();
    const current = new Set(role.permissions || []);
    const validAdds = (permissions || []).filter(p => registry.has(p));
    validAdds.forEach(p => current.add(p));
    role.permissions = Array.from(current);
    await role.save();
    try { const { logAudit } = require('../utils/audit'); await logAudit({ req, action: 'role_permissions_add', entityType: 'Role', entityId: role._id, before, after: role.toObject(), meta: { added: validAdds } }); } catch (e) {}
    res.json({ success: true, data: role });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * @desc    Remove permissions from a role
 * @route   POST /api/roles/:id/permissions/remove
 * @access  Private/Admin
 */
exports.removePermissions = async (req, res) => {
  try {
    const org = req.user.organization;
    const { permissions = [] } = req.body || {};
    const role = await Role.findOne({ _id: req.params.id, organization: org });
    if (!role) return res.status(404).json({ success: false, message: 'Role not found' });
    if (!role.isCustom) return res.status(400).json({ success: false, message: 'Cannot modify system-defined roles' });

    const before = role.toObject();
    const removeSet = new Set(permissions || []);
    role.permissions = (role.permissions || []).filter(p => !removeSet.has(p));
    await role.save();
    try { const { logAudit } = require('../utils/audit'); await logAudit({ req, action: 'role_permissions_remove', entityType: 'Role', entityId: role._id, before, after: role.toObject(), meta: { removed: permissions } }); } catch (e) {}
    res.json({ success: true, data: role });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
