const mongoose = require('mongoose');

const goodsReceivedNoteSchema = new mongoose.Schema({
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: false
  },
  grnNumber: {
    type: String,
    required: true,
    unique: true
  },
  purchaseOrder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PurchaseOrder',
    required: true
  },
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier',
    required: true
  },
  warehouse: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Warehouse',
    required: true
  },
  receivedDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  deliveryNoteNumber: String,
  items: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    orderedQuantity: {
      type: Number,
      required: true
    },
    receivedQuantity: {
      type: Number,
      required: true
    },
    acceptedQuantity: {
      type: Number,
      required: true
    },
    rejectedQuantity: {
      type: Number,
      default: 0
    },
    unitPrice: {
      type: Number,
      required: true
    },
    batchNumber: String,
    expiryDate: Date,
    rejectionReason: String,
    notes: String
  }],
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  qualityCheck: {
    performed: {
      type: Boolean,
      default: false
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    performedAt: Date,
    notes: String
  },
  attachments: [{
    filename: String,
    path: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  notes: String,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  approvedBy: {
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

// Auto-generate GRN number
goodsReceivedNoteSchema.pre('validate', async function(next) {
  try {
    if (!this.grnNumber) {
      // Get the current year
      const currentYear = new Date().getFullYear();
      
      // Find the latest GRN number for the current year
      const latestGrn = await mongoose.model('GoodsReceivedNote')
        .findOne({ 
          grnNumber: new RegExp(`^GRN-${currentYear}-`) 
        })
        .sort({ grnNumber: -1 });
      
      let nextNumber = 1;
      if (latestGrn) {
        // Extract the number from the latest GRN number
        const lastNumber = parseInt(latestGrn.grnNumber.split('-')[2]);
        nextNumber = lastNumber + 1;
      }
      
      // Generate the new GRN number
      this.grnNumber = `GRN-${currentYear}-${String(nextNumber).padStart(5, '0')}`;
    }
    next();
  } catch (error) {
    next(error);
  }
});

// Update inventory stock levels when GRN is approved
goodsReceivedNoteSchema.post('save', async function(doc) {
  if (doc.status === 'approved' && doc.isModified('status')) {
    const Product = mongoose.model('Product');
    const InventoryTransaction = mongoose.model('InventoryTransaction');

    for (const item of doc.items) {
      // Update product stock
      await Product.findByIdAndUpdate(item.product, {
        $inc: { 'stock.quantity': item.acceptedQuantity }
      });

      // Create inventory transaction
      await InventoryTransaction.create({
        product: item.product,
        warehouse: doc.warehouse,
        type: 'received',
        quantity: item.acceptedQuantity,
        reference: {
          type: 'grn',
          id: doc._id
        },
        notes: `Received from PO: ${doc.purchaseOrder}`
      });
    }
  }
});

const GoodsReceivedNote = mongoose.model('GoodsReceivedNote', goodsReceivedNoteSchema);

module.exports = GoodsReceivedNote; 