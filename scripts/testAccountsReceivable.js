const mongoose = require('mongoose');
const Customer = require('../models/Customer');
const SaleInvoice = require('../models/SaleInvoice');
const SalePayment = require('../models/SalePayment');
const Account = require('../models/Account');
const { isModuleEnabled } = require('../config/modules');

async function testAccountsReceivable() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/inventory', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('🔗 Connected to MongoDB');
    
    // Check if accounting module is enabled
    console.log('📊 Accounting Module Enabled:', isModuleEnabled('accounting'));
    console.log('📦 Inventory Module Enabled:', isModuleEnabled('inventory'));
    
    // Test 1: Get AR Summary
    console.log('\n=== TEST 1: AR Summary ===');
    const arSummary = await getARSummary();
    console.log('Total Outstanding:', arSummary.totalOutstanding);
    console.log('Total Overdue:', arSummary.totalOverdue);
    console.log('Total Customers with Outstanding:', arSummary.totalCustomers);
    
    // Test 2: Customer Aging Report
    console.log('\n=== TEST 2: Customer Aging Report ===');
    const agingReport = await getCustomerAging();
    console.log('Customers in aging report:', agingReport.length);
    if (agingReport.length > 0) {
      const sample = agingReport[0];
      console.log('Sample customer:', {
        name: sample.customer.name,
        totalOutstanding: sample.totalOutstanding,
        current: sample.currentAmount,
        thirtyDays: sample.thirtyDaysAmount,
        overNinety: sample.overNinetyDaysAmount
      });
    }
    
    // Test 3: Check AR Account Balance
    if (isModuleEnabled('accounting')) {
      console.log('\n=== TEST 3: AR Account Balance ===');
      const arAccount = await Account.findOne({ accountCode: '1200' });
      if (arAccount) {
        console.log('AR Account found:', arAccount.accountName);
        
        // Get ledger entries for AR account
        const Ledger = require('../models/Ledger');
        const arEntries = await Ledger.find({ account: arAccount._id })
          .sort({ entryDate: -1 })
          .limit(5);
        
        console.log('Recent AR entries:', arEntries.length);
        if (arEntries.length > 0) {
          console.log('Sample entry:', {
            date: arEntries[0].entryDate,
            debit: arEntries[0].debitAmount,
            credit: arEntries[0].creditAmount,
            description: arEntries[0].description
          });
        }
      } else {
        console.log('AR Account not found - accounting may not be initialized');
      }
    }
    
    // Test 4: Recent Payments
    console.log('\n=== TEST 4: Recent Payments ===');
    const recentPayments = await SalePayment.find({ status: 'completed' })
      .populate('customer', 'name')
      .populate('invoice', 'invoiceNumber')
      .sort({ paymentDate: -1 })
      .limit(5);
      
    console.log('Recent payments found:', recentPayments.length);
    if (recentPayments.length > 0) {
      recentPayments.forEach((payment, index) => {
        console.log(`Payment ${index + 1}:`, {
          amount: payment.amount,
          method: payment.paymentMethod,
          customer: payment.customer?.name,
          invoice: payment.invoice?.invoiceNumber,
          date: payment.paymentDate
        });
      });
    }
    
    console.log('\n✅ Accounts Receivable test completed successfully!');
    
  } catch (error) {
    console.error('❌ Error testing Accounts Receivable:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

async function getARSummary() {
  const outstandingInvoices = await SaleInvoice.aggregate([
    {
      $match: {
        status: { $in: ['pending', 'partially_paid', 'overdue'] },
        balanceAmount: { $gt: 0 }
      }
    },
    {
      $lookup: {
        from: 'customers',
        localField: 'customer',
        foreignField: '_id',
        as: 'customerDetails'
      }
    },
    {
      $unwind: '$customerDetails'
    },
    {
      $project: {
        balanceAmount: 1,
        dueDate: 1,
        customer: '$customerDetails'
      }
    }
  ]);

  const summary = {
    totalOutstanding: 0,
    totalOverdue: 0,
    totalCustomers: 0
  };

  const customerMap = new Set();
  const today = new Date();

  outstandingInvoices.forEach(invoice => {
    summary.totalOutstanding += invoice.balanceAmount;
    customerMap.add(invoice.customer._id.toString());

    if (invoice.dueDate < today) {
      summary.totalOverdue += invoice.balanceAmount;
    }
  });

  summary.totalCustomers = customerMap.size;
  return summary;
}

async function getCustomerAging() {
  const endDate = new Date();
  
  return await SaleInvoice.aggregate([
    {
      $match: {
        status: { $in: ['pending', 'partially_paid', 'overdue'] },
        balanceAmount: { $gt: 0 },
        invoiceDate: { $lte: endDate }
      }
    },
    {
      $lookup: {
        from: 'customers',
        localField: 'customer',
        foreignField: '_id',
        as: 'customerDetails'
      }
    },
    {
      $unwind: '$customerDetails'
    },
    {
      $addFields: {
        daysOverdue: {
          $cond: {
            if: { $gt: [endDate, '$dueDate'] },
            then: { $divide: [{ $subtract: [endDate, '$dueDate'] }, 86400000] },
            else: 0
          }
        }
      }
    },
    {
      $group: {
        _id: '$customer',
        customer: { $first: '$customerDetails' },
        totalOutstanding: { $sum: '$balanceAmount' },
        invoiceCount: { $sum: 1 },
        currentAmount: {
          $sum: {
            $cond: [{ $lte: ['$daysOverdue', 0] }, '$balanceAmount', 0]
          }
        },
        thirtyDaysAmount: {
          $sum: {
            $cond: [
              { $and: [{ $gt: ['$daysOverdue', 0] }, { $lte: ['$daysOverdue', 30] }] },
              '$balanceAmount',
              0
            ]
          }
        },
        overNinetyDaysAmount: {
          $sum: {
            $cond: [{ $gt: ['$daysOverdue', 90] }, '$balanceAmount', 0]
          }
        }
      }
    },
    {
      $sort: { totalOutstanding: -1 }
    },
    {
      $limit: 10
    }
  ]);
}

// Run the test
if (require.main === module) {
  testAccountsReceivable();
}

module.exports = { testAccountsReceivable }; 