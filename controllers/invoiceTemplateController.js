const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');
const InvoiceTemplate = require('../models/InvoiceTemplate');

// @desc    Get all templates
// @route   GET /api/custom-invoicing/templates
// @access  Private
exports.getTemplates = asyncHandler(async (req, res, next) => {
  const { status, type } = req.query;

  const query = {
    $or: [
      { organization: req.user.organization },
      { isSystem: true }
    ]
  };

  if (status) {
    query.status = status;
  }
  if (type) {
    query.type = type;
  }

  const templates = await InvoiceTemplate.find(query)
    .sort({ isSystem: -1, createdAt: -1 })
    .lean();

  res.status(200).json({
    success: true,
    data: templates
  });
});

// @desc    Get single template
// @route   GET /api/custom-invoicing/templates/:id
// @access  Private
exports.getTemplate = asyncHandler(async (req, res, next) => {
  const template = await InvoiceTemplate.findOne({
    _id: req.params.id,
    $or: [
      { organization: req.user.organization },
      { isSystem: true }
    ]
  });

  if (!template) {
    return next(new ErrorResponse('Template not found', 404));
  }

  res.status(200).json({
    success: true,
    data: template
  });
});

// @desc    Create custom template (copy from system template)
// @route   POST /api/custom-invoicing/templates
// @access  Private
exports.createTemplate = asyncHandler(async (req, res, next) => {
  // Set organization and creator
  req.body.organization = req.user.organization;
  req.body.createdBy = req.user._id;
  req.body.isSystem = false;

  const template = await InvoiceTemplate.create(req.body);

  res.status(201).json({
    success: true,
    data: template
  });
});

// @desc    Update template
// @route   PUT /api/custom-invoicing/templates/:id
// @access  Private
exports.updateTemplate = asyncHandler(async (req, res, next) => {
  let template = await InvoiceTemplate.findOne({
    _id: req.params.id,
    organization: req.user.organization
  });

  if (!template) {
    return next(new ErrorResponse('Template not found', 404));
  }

  // Don't allow editing system templates
  if (template.isSystem) {
    return next(new ErrorResponse('Cannot edit system templates', 400));
  }

  template = await InvoiceTemplate.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  res.status(200).json({
    success: true,
    data: template
  });
});

// @desc    Delete template
// @route   DELETE /api/custom-invoicing/templates/:id
// @access  Private
exports.deleteTemplate = asyncHandler(async (req, res, next) => {
  const template = await InvoiceTemplate.findOne({
    _id: req.params.id,
    organization: req.user.organization
  });

  if (!template) {
    return next(new ErrorResponse('Template not found', 404));
  }

  // Don't allow deleting system templates
  if (template.isSystem) {
    return next(new ErrorResponse('Cannot delete system templates', 400));
  }

  await template.deleteOne();

  res.status(200).json({
    success: true,
    data: {}
  });
});

