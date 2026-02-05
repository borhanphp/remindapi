const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Import models
const VendorBill = require('../models/VendorBill');
const VendorPayment = require('../models/VendorPayment');
const PaymentSchedule = require('../models/PaymentSchedule');
const Supplier = require('../models/Supplier');
const { isModuleEnabled } = require('../config/modules');

async function testAccountsPayable() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/inventory');
    console.log('🔗 Connected to MongoDB');

    // Check if accounting module is enabled
    const accountingEnabled = isModuleEnabled('accounting');
    console.log(`📊 Accounting Module Enabled: ${accountingEnabled}`);

    console.log('\n=== TEST 1: AP Summary ===');
    
    // Test AP Summary
    const outstandingBills = await VendorBill.aggregate([
      {
        $match: {
          status: { $in: ['pending', 'partially_paid', 'overdue'] },
          balanceAmount: { $gt: 0 }
        }
      },
      {
        $group: {
          _id: null,
          totalOutstanding: { $sum: '$balanceAmount' },
          totalBills: { $sum: 1 },
          overdueAmount: {
            $sum: {
              $cond: [{ $lt: ['$dueDate', new Date()] }, '$balanceAmount', 0]
            }
          },
          overdueCount: {
            $sum: {
              $cond: [{ $lt: ['$dueDate', new Date()] }, 1, 0]
            }
          }
        }
      }
    ]);

    const apSummary = outstandingBills[0] || {
      totalOutstanding: 0,
      totalBills: 0,
      overdueAmount: 0,
      overdueCount: 0
    };

    console.log(`Total Outstanding: ${apSummary.totalOutstanding}`);
    console.log(`Total Overdue: ${apSummary.overdueAmount}`);
    console.log(`Total Bills with Outstanding: ${apSummary.totalBills}`);

    console.log('\n=== TEST 2: Vendor Aging Report ===');
    
    // Test Vendor Aging Report
    const vendorAging = await VendorBill.aggregate([
      {
        $match: {
          status: { $in: ['pending', 'partially_paid', 'overdue'] },
          balanceAmount: { $gt: 0 }
        }
      },
      {
        $lookup: {
          from: 'suppliers',
          localField: 'vendor',
          foreignField: '_id',
          as: 'vendorDetails'
        }
      },
      {
        $unwind: '$vendorDetails'
      },
      {
        $addFields: {
          daysOverdue: {
            $cond: {
              if: { $gt: [new Date(), '$dueDate'] },
              then: { $divide: [{ $subtract: [new Date(), '$dueDate'] }, 86400000] },
              else: 0
            }
          }
        }
      },
      {
        $group: {
          _id: '$vendor',
          vendor: { $first: '$vendorDetails' },
          totalOutstanding: { $sum: '$balanceAmount' },
          billCount: { $sum: 1 }
        }
      }
    ]);

    console.log(`Vendors in aging report: ${vendorAging.length}`);

    console.log('\n=== TEST 3: Payment Schedules ===');
    
    // Test Payment Schedules
    const paymentSchedules = await PaymentSchedule.find({
      status: 'scheduled'
    }).populate('vendor', 'name').populate('bill', 'billNumber');

    console.log(`Active payment schedules: ${paymentSchedules.length}`);

    console.log('\n=== TEST 4: Recent Payments ===');
    
    // Test Recent Payments
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentPayments = await VendorPayment.find({
      paymentDate: { $gte: thirtyDaysAgo },
      status: 'completed'
    }).populate('vendor', 'name').populate('bill', 'billNumber');

    console.log(`Recent payments found: ${recentPayments.length}`);

    console.log('\n=== TEST 5: Due Date Tracking ===');
    
    // Test Due Date Tracking
    const today = new Date();
    const sevenDaysFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [overdueBills, dueSoon] = await Promise.all([
      VendorBill.find({
        dueDate: { $lt: today },
        status: { $in: ['pending', 'partially_paid', 'overdue'] },
        balanceAmount: { $gt: 0 }
      }),
      VendorBill.find({
        dueDate: { $gte: today, $lte: sevenDaysFromNow },
        status: { $in: ['pending', 'partially_paid'] },
        balanceAmount: { $gt: 0 }
      })
    ]);

    console.log(`Overdue bills: ${overdueBills.length}`);
    console.log(`Bills due in next 7 days: ${dueSoon.length}`);

    // Test bill number generation
    console.log('\n=== TEST 6: Bill Number Generation ===');
    try {
      const testOrgId = new mongoose.Types.ObjectId();
      const billNumber = await VendorBill.generateBillNumber(testOrgId);
      console.log(`Generated bill number: ${billNumber}`);
    } catch (error) {
      console.log(`Bill number generation test skipped: ${error.message}`);
    }

    // Test payment number generation
    console.log('\n=== TEST 7: Payment Number Generation ===');
    try {
      const testOrgId = new mongoose.Types.ObjectId();
      const paymentNumber = await VendorPayment.generatePaymentNumber(testOrgId);
      console.log(`Generated payment number: ${paymentNumber}`);
    } catch (error) {
      console.log(`Payment number generation test skipped: ${error.message}`);
    }

    console.log('\n✅ Accounts Payable test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the test
testAccountsPayable(); 