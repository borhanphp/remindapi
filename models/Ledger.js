const mongoose = require('mongoose');

const ledgerEntrySchema = new mongoose.Schema({
  account: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChartOfAccount',
    required: true
  },
  journalEntry: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'JournalEntry',
    required: true
  },
  entryDate: {
    type: Date,
    required: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  reference: {
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
  },
  // Optional transaction currency capture for analytics
  transactionCurrency: {
    type: String,
    trim: true
  },
  transactionDebit: { type: Number, default: 0 },
  transactionCredit: { type: Number, default: 0 },
  runningBalance: {
    type: Number,
    default: 0
  },
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: false
  }
}, {
  timestamps: true
});

// Indexes
ledgerEntrySchema.index({ account: 1, entryDate: 1 });
ledgerEntrySchema.index({ journalEntry: 1 });
ledgerEntrySchema.index({ organization: 1 });
ledgerEntrySchema.index({ entryDate: 1 });

// Static method to get account balance as of a specific date
ledgerEntrySchema.statics.getAccountBalance = async function(accountId, asOfDate = new Date()) {
  const pipeline = [
    {
      $match: {
        account: new mongoose.Types.ObjectId(accountId),
        entryDate: { $lte: asOfDate }
      }
    },
    {
      $group: {
        _id: null,
        totalDebit: { $sum: '$debitAmount' },
        totalCredit: { $sum: '$creditAmount' }
      }
    }
  ];
  
  const result = await this.aggregate(pipeline);
  if (result.length === 0) {
    return { balance: 0, totalDebit: 0, totalCredit: 0 };
  }
  
  const { totalDebit, totalCredit } = result[0];
  
  // Get account to determine normal balance
  const ChartOfAccount = mongoose.model('ChartOfAccount');
  const account = await ChartOfAccount.findById(accountId);
  
  let balance;
  if (account.normalBalance === 'Debit') {
    balance = totalDebit - totalCredit;
  } else {
    balance = totalCredit - totalDebit;
  }
  
  return { balance, totalDebit, totalCredit };
};

// Static method to get trial balance
ledgerEntrySchema.statics.getTrialBalance = async function(organizationId, asOfDate = new Date(), options = {}) {
  const matchQuery = {
    entryDate: { $lte: asOfDate }
  };
  
  if (organizationId) {
    matchQuery.organization = new mongoose.Types.ObjectId(organizationId);
  } else {
    matchQuery.organization = { $exists: false };
  }
  
  const pipeline = [
    {
      $match: matchQuery
    },
    {
      $group: {
        _id: '$account',
        totalDebit: { $sum: '$debitAmount' },
        totalCredit: { $sum: '$creditAmount' }
      }
    },
    {
      $lookup: {
        from: 'chartofaccounts',
        localField: '_id',
        foreignField: '_id',
        as: 'account'
      }
    },
    {
      $unwind: '$account'
    },
    {
      $project: {
        account: '$account',
        totalDebit: 1,
        totalCredit: 1,
        balance: {
          $cond: {
            if: { $eq: ['$account.normalBalance', 'Debit'] },
            then: { $subtract: ['$totalDebit', '$totalCredit'] },
            else: { $subtract: ['$totalCredit', '$totalDebit'] }
          }
        },
        // Add sorting keys for better organization
        accountTypeSort: {
          $switch: {
            branches: [
              { case: { $eq: ['$account.accountType', 'Asset'] }, then: 1 },
              { case: { $eq: ['$account.accountType', 'Liability'] }, then: 2 },
              { case: { $eq: ['$account.accountType', 'Equity'] }, then: 3 },
              { case: { $eq: ['$account.accountType', 'Revenue'] }, then: 4 },
              { case: { $eq: ['$account.accountType', 'Expense'] }, then: 5 }
            ],
            default: 6
          }
        }
      }
    },
    {
      $sort: { 
        accountTypeSort: 1,
        'account.accountCode': 1 
      }
    }
  ];
  
  return await this.aggregate(pipeline);
};

// Static method to update running balances after a journal entry
ledgerEntrySchema.statics.updateRunningBalances = async function(accountId, fromDate = new Date('1900-01-01')) {
  const entries = await this.find({
    account: accountId,
    entryDate: { $gte: fromDate }
  }).sort({ entryDate: 1, createdAt: 1 });
  
  let runningBalance = 0;
  
  // Get account to determine normal balance
  const ChartOfAccount = mongoose.model('ChartOfAccount');
  const account = await ChartOfAccount.findById(accountId);
  
  // Get balance before fromDate
  if (fromDate > new Date('1900-01-01')) {
    const beforeBalance = await this.getAccountBalance(accountId, new Date(fromDate.getTime() - 1));
    runningBalance = beforeBalance.balance;
  }
  
  for (let entry of entries) {
    if (account.normalBalance === 'Debit') {
      runningBalance += entry.debitAmount - entry.creditAmount;
    } else {
      runningBalance += entry.creditAmount - entry.debitAmount;
    }
    
    entry.runningBalance = runningBalance;
    await entry.save();
  }
  
  // Update account current balance
  account.currentBalance = runningBalance;
  await account.save();
};

module.exports = mongoose.model('Ledger', ledgerEntrySchema); 