const mongoose = require('mongoose');

const journalLineSchema = new mongoose.Schema({
  account: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChartOfAccount',
    required: true
  },
  description: {
    type: String,
    trim: true
  },
  debitAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  creditAmount: {
    type: Number,
    default: 0,
    min: 0
  }
});

const journalEntrySchema = new mongoose.Schema({
  entryNumber: {
    type: String,
    required: true,
    unique: true
  },
  entryDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  reference: {
    type: String,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  // Multi-currency context (amounts on lines are stored in base currency)
  currency: {
    type: String,
    trim: true
  },
  baseCurrency: {
    type: String,
    trim: true
  },
  exchangeRate: {
    type: Number,
    default: 1
  },
  journalLines: [journalLineSchema],
  totalDebit: {
    type: Number,
    default: 0,
    min: 0
  },
  totalCredit: {
    type: Number,
    default: 0,
    min: 0
  },
  status: {
    type: String,
    enum: ['Draft', 'Posted', 'Reversed'],
    default: 'Draft'
  },
  sourceDocument: {
    documentType: {
      type: String,
      enum: ['Manual', 'SaleInvoice', 'PurchaseInvoice', 'Payment', 'Receipt', 'StockAdjustment', 'StockTransfer']
    },
    documentId: {
      type: mongoose.Schema.Types.ObjectId
    }
  },
  reversalEntry: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'JournalEntry'
  },
  isReversal: {
    type: Boolean,
    default: false
  },
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: false
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  postedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  postedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Indexes
journalEntrySchema.index({ organization: 1, entryNumber: 1 });
journalEntrySchema.index({ entryDate: 1 });
journalEntrySchema.index({ status: 1 });
journalEntrySchema.index({ 'sourceDocument.documentType': 1, 'sourceDocument.documentId': 1 });

// Validation: Debit and Credit must balance
journalEntrySchema.pre('save', function(next) {
  // Calculate totals
  this.totalDebit = this.journalLines.reduce((sum, line) => sum + line.debitAmount, 0);
  this.totalCredit = this.journalLines.reduce((sum, line) => sum + line.creditAmount, 0);
  
  // Check if balanced (allow small floating point differences)
  const difference = Math.abs(this.totalDebit - this.totalCredit);
  if (difference > 0.01) {
    return next(new Error(`Journal entry must be balanced. Debit: ${this.totalDebit}, Credit: ${this.totalCredit}`));
  }
  
  // Validate that each line has either debit or credit, but not both
  for (let line of this.journalLines) {
    if ((line.debitAmount > 0 && line.creditAmount > 0) || (line.debitAmount === 0 && line.creditAmount === 0)) {
      return next(new Error('Each journal line must have either a debit or credit amount, but not both or neither'));
    }
  }
  
  next();
});

// Static method to generate entry number
journalEntrySchema.statics.generateEntryNumber = async function(organizationId) {
  const currentYear = new Date().getFullYear();
  const prefix = `JE${currentYear}`;
  
  const query = { entryNumber: { $regex: `^${prefix}` } };
  if (organizationId) {
    query.organization = organizationId;
  }
  
  const lastEntry = await this.findOne(query).sort({ entryNumber: -1 });
  
  let nextNumber = 1;
  if (lastEntry) {
    const lastNumber = parseInt(lastEntry.entryNumber.replace(prefix, ''));
    nextNumber = lastNumber + 1;
  }
  
  return `${prefix}${nextNumber.toString().padStart(6, '0')}`;
};

// Instance method to post the entry
journalEntrySchema.methods.post = function(userId) {
  this.status = 'Posted';
  this.postedBy = userId;
  this.postedAt = new Date();
  return this.save();
};

// Instance method to create reversal entry
journalEntrySchema.methods.reverse = function(userId, description) {
  const reversalLines = this.journalLines.map(line => ({
    account: line.account,
    description: description || `Reversal of ${this.entryNumber}`,
    debitAmount: line.creditAmount, // Swap debit and credit
    creditAmount: line.debitAmount
  }));
  
  const JournalEntry = this.constructor;
  return JournalEntry.generateEntryNumber(this.organization || null).then(entryNumber => {
    const reversalEntry = new JournalEntry({
      entryNumber,
      entryDate: new Date(),
      reference: this.entryNumber,
      description: description || `Reversal of ${this.entryNumber}`,
      journalLines: reversalLines,
      organization: this.organization,
      createdBy: userId,
      isReversal: true,
      sourceDocument: {
        documentType: 'Manual',
        documentId: this._id
      }
    });
    
    // Update original entry
    this.reversalEntry = reversalEntry._id;
    this.status = 'Reversed';
    
    return Promise.all([this.save(), reversalEntry.save()]);
  });
};

module.exports = mongoose.model('JournalEntry', journalEntrySchema); 