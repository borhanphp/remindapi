const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');
const InvoiceSettings = require('../models/InvoiceSettings');

// @desc    Get invoice settings
// @route   GET /api/custom-invoicing/settings
// @access  Private
exports.getSettings = asyncHandler(async (req, res, next) => {
  let settings = await InvoiceSettings.findOne({
    organization: req.user.organization
  }).populate('defaultTemplate', 'name type');

  // Create default settings if they don't exist
  if (!settings) {
    settings = await InvoiceSettings.create({
      organization: req.user.organization,
      updatedBy: req.user._id
    });
  }

  res.status(200).json({
    success: true,
    data: settings
  });
});

// @desc    Update invoice settings
// @route   PUT /api/custom-invoicing/settings
// @access  Private
exports.updateSettings = asyncHandler(async (req, res, next) => {
  req.body.updatedBy = req.user._id;

  let settings = await InvoiceSettings.findOne({
    organization: req.user.organization
  });

  if (!settings) {
    // Create new settings
    req.body.organization = req.user.organization;
    settings = await InvoiceSettings.create(req.body);
  } else {
    // Update existing settings
    settings = await InvoiceSettings.findOneAndUpdate(
      { organization: req.user.organization },
      req.body,
      {
        new: true,
        runValidators: true
      }
    );
  }

  settings = await InvoiceSettings.findById(settings._id)
    .populate('defaultTemplate', 'name type');

  res.status(200).json({
    success: true,
    data: settings
  });
});

// @desc    Reset invoice counter
// @route   POST /api/custom-invoicing/settings/reset-counter
// @access  Private (Admin only)
exports.resetCounter = asyncHandler(async (req, res, next) => {
  const { type, nextNumber } = req.body;

  if (!['invoice', 'estimate'].includes(type)) {
    return next(new ErrorResponse('Invalid counter type', 400));
  }

  if (!nextNumber || nextNumber < 1) {
    return next(new ErrorResponse('Next number must be greater than 0', 400));
  }

  const settings = await InvoiceSettings.findOne({
    organization: req.user.organization
  });

  if (!settings) {
    return next(new ErrorResponse('Settings not found', 404));
  }

  if (type === 'invoice') {
    settings.invoiceNumbering.nextNumber = nextNumber;
  } else {
    settings.estimateNumbering.nextNumber = nextNumber;
  }

  await settings.save();

  res.status(200).json({
    success: true,
    data: settings
  });
});

