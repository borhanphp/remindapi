const mongoose = require('mongoose');

const purchaseRequisitionSchema = new mongoose.Schema({
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: false
  },
  requisitionNumber: {
    type: String,
    required: true,
    unique: true
  },
  department: {
    type: String,
    required: true
  },
  requester: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['draft', 'pending', 'approved', 'rejected', 'converted'],
    default: 'draft'
  },
  items: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    requiredDate: Date,
    notes: String
  }],
  attachments: [{
    filename: String,
    path: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  notes: String,
  approver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvalDate: Date,
  rejectionReason: String,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Auto-generate requisition number
purchaseRequisitionSchema.pre('validate', async function(next) {
  try {
    if (!this.requisitionNumber) {
      // Get the current year
      const currentYear = new Date().getFullYear();
      
      // Find the latest requisition number for the current year
      const latestRequisition = await mongoose.model('PurchaseRequisition')
        .findOne({ 
          requisitionNumber: new RegExp(`^REQ-${currentYear}-`) 
        })
        .sort({ requisitionNumber: -1 });
      
      let nextNumber = 1;
      if (latestRequisition) {
        // Extract the number from the latest requisition number
        const lastNumber = parseInt(latestRequisition.requisitionNumber.split('-')[2]);
        nextNumber = lastNumber + 1;
      }
      
      // Generate the new requisition number
      this.requisitionNumber = `REQ-${currentYear}-${String(nextNumber).padStart(5, '0')}`;
    }
    next();
  } catch (error) {
    next(error);
  }
});

// Update timestamps
purchaseRequisitionSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

const PurchaseRequisition = mongoose.model('PurchaseRequisition', purchaseRequisitionSchema);

module.exports = PurchaseRequisition; 