const User = require('../models/User');
const Organization = require('../models/Organization');

exports.getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('name email phone avatar timezone uiPreferences');
    res.json({ success: true, data: user });
  } catch (err) { next(err); }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const { name, phone, timezone, avatar, uiPreferences } = req.body;
    const updates = {};
    if (name) updates.name = name;
    if (phone) updates.phone = phone;
    if (timezone) updates.timezone = timezone;
    if (avatar) updates.avatar = avatar;
    if (uiPreferences && typeof uiPreferences === 'object') updates.uiPreferences = uiPreferences;
    
    // Update and return full user with role and organization populated
    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true })
      .populate('role')
      .populate('organization')
      .select('-password');
    
    res.json({ success: true, data: user });
  } catch (err) { next(err); }
};

exports.getOrganization = async (req, res, next) => {
  try {
    if (!req.user.organization) return res.status(400).json({ success: false, message: 'No organization' });
    const org = await Organization.findById(req.user.organization);
    res.json({ success: true, data: org });
  } catch (err) { next(err); }
};

exports.updateOrganization = async (req, res, next) => {
  try {
    if (!req.user.organization) return res.status(400).json({ success: false, message: 'No organization' });
    
    const { 
      name, 
      logo, 
      email, 
      phone, 
      website, 
      address, 
      taxId, 
      registrationNumber, 
      vatNumber,
      bankDetails,
      invoiceFooter,
      signature,
      termsAndConditions,
      settings 
    } = req.body;
    
    const updates = {};
    if (name) updates.name = name;
    if (logo !== undefined) updates.logo = logo;
    if (email !== undefined) updates.email = email;
    if (phone !== undefined) updates.phone = phone;
    if (website !== undefined) updates.website = website;
    if (address && typeof address === 'object') updates.address = address;
    if (taxId !== undefined) updates.taxId = taxId;
    if (registrationNumber !== undefined) updates.registrationNumber = registrationNumber;
    if (vatNumber !== undefined) updates.vatNumber = vatNumber;
    if (bankDetails && typeof bankDetails === 'object') updates.bankDetails = bankDetails;
    if (invoiceFooter !== undefined) updates.invoiceFooter = invoiceFooter;
    if (signature !== undefined) updates.signature = signature;
    if (termsAndConditions !== undefined) updates.termsAndConditions = termsAndConditions;
    if (settings && typeof settings === 'object') updates.settings = settings;
    
    const org = await Organization.findByIdAndUpdate(req.user.organization, updates, { new: true });
    res.json({ success: true, data: org });
  } catch (err) { next(err); }
};

exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Validation
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long'
      });
    }

    // Get user with password field
    const user = await User.findById(req.user._id).select('+password');

    // Verify current password
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (err) {
    next(err);
  }
};


