const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');
const RecurringInvoice = require('../models/RecurringInvoice');

// @desc    Get all recurring invoices
// @route   GET /api/custom-invoicing/recurring
// @access  Private
exports.getRecurringInvoices = asyncHandler(async (req, res, next) => {
  const {
    page = 1,
    limit = 20,
    status,
    customer,
    frequency,
    sortBy = '-createdAt'
  } = req.query;

  const query = { organization: req.user.organization };

  if (status) {
    query.status = status;
  }
  if (customer) {
    query.customer = customer;
  }
  if (frequency) {
    query.frequency = frequency;
  }

  const skip = (page - 1) * limit;

  const [recurringInvoices, total] = await Promise.all([
    RecurringInvoice.find(query)
      .populate('customer', 'name email phone')
      .populate('template', 'name type')
      .populate('createdBy', 'name')
      .sort(sortBy)
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    RecurringInvoice.countDocuments(query)
  ]);

  res.status(200).json({
    success: true,
    data: recurringInvoices,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit)
    }
  });
});

// @desc    Get single recurring invoice
// @route   GET /api/custom-invoicing/recurring/:id
// @access  Private
exports.getRecurringInvoice = asyncHandler(async (req, res, next) => {
  const recurringInvoice = await RecurringInvoice.findOne({
    _id: req.params.id,
    organization: req.user.organization
  })
    .populate('customer')
    .populate('template')
    .populate('createdBy', 'name email')
    .populate({
      path: 'generationHistory.invoice',
      select: 'invoiceNumber status totalAmount'
    });

  if (!recurringInvoice) {
    return next(new ErrorResponse('Recurring invoice not found', 404));
  }

  res.status(200).json({
    success: true,
    data: recurringInvoice
  });
});

// @desc    Create new recurring invoice
// @route   POST /api/custom-invoicing/recurring
// @access  Private
exports.createRecurringInvoice = asyncHandler(async (req, res, next) => {
  // Set organization and creator
  req.body.organization = req.user.organization;
  req.body.createdBy = req.user._id;

  // Calculate totals if not provided
  if (!req.body.subtotal && req.body.lineItems) {
    req.body.subtotal = req.body.lineItems.reduce((sum, item) => sum + item.totalAmount, 0);
  }
  if (!req.body.totalAmount) {
    req.body.totalAmount = req.body.subtotal + (req.body.totalTax || 0) - (req.body.totalDiscount || 0) + (req.body.shippingCost || 0);
  }

  // Set next generation date to start date if not provided
  if (!req.body.nextGenerationDate) {
    req.body.nextGenerationDate = req.body.startDate;
  }

  const recurringInvoice = await RecurringInvoice.create(req.body);

  const populatedRecurringInvoice = await RecurringInvoice.findById(recurringInvoice._id)
    .populate('customer', 'name email')
    .populate('template', 'name type');

  res.status(201).json({
    success: true,
    data: populatedRecurringInvoice
  });
});

// @desc    Update recurring invoice
// @route   PUT /api/custom-invoicing/recurring/:id
// @access  Private
exports.updateRecurringInvoice = asyncHandler(async (req, res, next) => {
  let recurringInvoice = await RecurringInvoice.findOne({
    _id: req.params.id,
    organization: req.user.organization
  });

  if (!recurringInvoice) {
    return next(new ErrorResponse('Recurring invoice not found', 404));
  }

  // Update recurring invoice
  req.body.updatedBy = req.user._id;
  
  // Recalculate totals if line items changed
  if (req.body.lineItems) {
    req.body.subtotal = req.body.lineItems.reduce((sum, item) => sum + item.totalAmount, 0);
    req.body.totalAmount = req.body.subtotal + (req.body.totalTax || 0) - (req.body.totalDiscount || 0) + (req.body.shippingCost || 0);
  }

  recurringInvoice = await RecurringInvoice.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  })
    .populate('customer', 'name email')
    .populate('template', 'name type');

  res.status(200).json({
    success: true,
    data: recurringInvoice
  });
});

// @desc    Delete recurring invoice
// @route   DELETE /api/custom-invoicing/recurring/:id
// @access  Private
exports.deleteRecurringInvoice = asyncHandler(async (req, res, next) => {
  const recurringInvoice = await RecurringInvoice.findOne({
    _id: req.params.id,
    organization: req.user.organization
  });

  if (!recurringInvoice) {
    return next(new ErrorResponse('Recurring invoice not found', 404));
  }

  await recurringInvoice.deleteOne();

  res.status(200).json({
    success: true,
    data: {}
  });
});

// @desc    Pause recurring invoice
// @route   POST /api/custom-invoicing/recurring/:id/pause
// @access  Private
exports.pauseRecurringInvoice = asyncHandler(async (req, res, next) => {
  const recurringInvoice = await RecurringInvoice.findOne({
    _id: req.params.id,
    organization: req.user.organization
  });

  if (!recurringInvoice) {
    return next(new ErrorResponse('Recurring invoice not found', 404));
  }

  if (recurringInvoice.status !== 'active') {
    return next(new ErrorResponse('Can only pause active recurring invoices', 400));
  }

  recurringInvoice.status = 'paused';
  await recurringInvoice.save();

  res.status(200).json({
    success: true,
    data: recurringInvoice
  });
});

// @desc    Resume recurring invoice
// @route   POST /api/custom-invoicing/recurring/:id/resume
// @access  Private
exports.resumeRecurringInvoice = asyncHandler(async (req, res, next) => {
  const recurringInvoice = await RecurringInvoice.findOne({
    _id: req.params.id,
    organization: req.user.organization
  });

  if (!recurringInvoice) {
    return next(new ErrorResponse('Recurring invoice not found', 404));
  }

  if (recurringInvoice.status !== 'paused') {
    return next(new ErrorResponse('Can only resume paused recurring invoices', 400));
  }

  recurringInvoice.status = 'active';
  await recurringInvoice.save();

  res.status(200).json({
    success: true,
    data: recurringInvoice
  });
});

// @desc    Cancel recurring invoice
// @route   POST /api/custom-invoicing/recurring/:id/cancel
// @access  Private
exports.cancelRecurringInvoice = asyncHandler(async (req, res, next) => {
  const recurringInvoice = await RecurringInvoice.findOne({
    _id: req.params.id,
    organization: req.user.organization
  });

  if (!recurringInvoice) {
    return next(new ErrorResponse('Recurring invoice not found', 404));
  }

  if (recurringInvoice.status === 'cancelled' || recurringInvoice.status === 'completed') {
    return next(new ErrorResponse('Recurring invoice is already cancelled or completed', 400));
  }

  recurringInvoice.status = 'cancelled';
  await recurringInvoice.save();

  res.status(200).json({
    success: true,
    data: recurringInvoice
  });
});

