const mongoose = require('mongoose');

const paymentScheduleSchema = new mongoose.Schema({
  // Schedule identification
  scheduleNumber: {
    type: String,
    required: true,
    unique: true
  },
  
  // Bill reference
  bill: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'VendorBill',
    required: true
  },
  vendor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier',
    required: true
  },
  
  // Schedule details
  scheduledDate: {
    type: Date,
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  
  // Status
  status: {
    type: String,
    enum: ['scheduled', 'paid', 'overdue', 'cancelled', 'pending_approval'],
    default: 'scheduled'
  },
  
  // Schedule type
  scheduleType: {
    type: String,
    enum: ['full_payment', 'partial_payment', 'installment'],
    default: 'full_payment'
  },
  
  // Installment details (if applicable)
  installmentNumber: {
    type: Number,
    min: 1
  },
  totalInstallments: {
    type: Number,
    min: 1
  },
  
  // Payment reference when paid
  payment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'VendorPayment'
  },
  
  // Approval workflow
  requiresApproval: {
    type: Boolean,
    default: false
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: {
    type: Date
  },
  
  // Notes and reminders
  notes: {
    type: String,
    trim: true
  },
  reminderSent: {
    type: Boolean,
    default: false
  },
  reminderDate: {
    type: Date
  },
  
  // Organization
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },
  
  // Audit fields
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes for performance
paymentScheduleSchema.index({ bill: 1 });
paymentScheduleSchema.index({ vendor: 1, scheduledDate: 1 });
paymentScheduleSchema.index({ scheduledDate: 1, status: 1 });
paymentScheduleSchema.index({ organization: 1 });
paymentScheduleSchema.index({ status: 1 });

// Virtual for days until due
paymentScheduleSchema.virtual('daysUntilDue').get(function() {
  const today = new Date();
  const diffTime = this.scheduledDate - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
});

// Virtual for overdue status
paymentScheduleSchema.virtual('isOverdue').get(function() {
  return this.scheduledDate < new Date() && this.status === 'scheduled';
});

// Pre-save middleware to update status
paymentScheduleSchema.pre('save', function(next) {
  if (this.scheduledDate < new Date() && this.status === 'scheduled') {
    this.status = 'overdue';
  }
  next();
});

// Static method to generate schedule number
paymentScheduleSchema.statics.generateScheduleNumber = async function(organizationId) {
  const currentYear = new Date().getFullYear();
  const prefix = `SCH-${currentYear}-`;
  
  const lastSchedule = await this.findOne({
    organization: organizationId,
    scheduleNumber: { $regex: `^${prefix}` }
  }).sort({ scheduleNumber: -1 });
  
  let nextNumber = 1;
  if (lastSchedule) {
    const lastNumber = parseInt(lastSchedule.scheduleNumber.split('-').pop());
    nextNumber = lastNumber + 1;
  }
  
  return `${prefix}${nextNumber.toString().padStart(4, '0')}`;
};

// Static method to create payment schedules based on payment terms
paymentScheduleSchema.statics.createSchedulesForBill = async function(billId, paymentTerms, organizationId, userId) {
  const VendorBill = require('./VendorBill');
  const bill = await VendorBill.findById(billId);
  
  if (!bill) throw new Error('Bill not found');
  
  const schedules = [];
  
  switch (paymentTerms) {
    case 'net_15':
    case 'net_30':
    case 'net_45':
    case 'net_60':
    case 'due_on_receipt':
      // Single payment schedule
      const scheduleNumber = await this.generateScheduleNumber(organizationId);
      schedules.push({
        scheduleNumber,
        bill: billId,
        vendor: bill.vendor,
        scheduledDate: bill.dueDate,
        amount: bill.totalAmount,
        scheduleType: 'full_payment',
        organization: organizationId,
        createdBy: userId
      });
      break;
      
    default:
      // Custom terms - create single schedule for now
      const customScheduleNumber = await this.generateScheduleNumber(organizationId);
      schedules.push({
        scheduleNumber: customScheduleNumber,
        bill: billId,
        vendor: bill.vendor,
        scheduledDate: bill.dueDate,
        amount: bill.totalAmount,
        scheduleType: 'full_payment',
        organization: organizationId,
        createdBy: userId
      });
  }
  
  return await this.insertMany(schedules);
};

module.exports = mongoose.model('PaymentSchedule', paymentScheduleSchema); 