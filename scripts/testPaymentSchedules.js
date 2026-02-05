const mongoose = require('mongoose');
const VendorBill = require('../models/VendorBill');
const PaymentSchedule = require('../models/PaymentSchedule');
const Supplier = require('../models/Supplier');
const Organization = require('../models/Organization');
const User = require('../models/User');

async function testPaymentSchedules() {
  try {
    // Connect to MongoDB
    await mongoose.connect('mongodb://localhost:27017/inventory-management', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('🔗 Connected to MongoDB');

    // Create test organization
    let organization = await Organization.findOne({ name: 'Test Organization' });
    if (!organization) {
      organization = new Organization({
        name: 'Test Organization',
        email: 'test@example.com',
        phone: '1234567890'
      });
      await organization.save();
      console.log('📊 Created test organization');
    }

    // Create test user
    let user = await User.findOne({ email: 'testuser@example.com' });
    if (!user) {
      user = new User({
        name: 'Test User',
        email: 'testuser@example.com',
        password: 'hashedpassword',
        organization: organization._id,
        role: 'admin'
      });
      await user.save();
      console.log('👤 Created test user');
    }

    // Create test supplier
    let supplier = await Supplier.findOne({ name: 'Test Supplier' });
    if (!supplier) {
      supplier = new Supplier({
        name: 'Test Supplier',
        email: 'supplier@example.com',
        phone: '9876543210',
        address: '123 Test Street',
        organization: organization._id
      });
      await supplier.save();
      console.log('🏢 Created test supplier');
    }

    // Create test vendor bill
    let vendorBill = await VendorBill.findOne({ billNumber: 'TEST-BILL-001' });
    if (!vendorBill) {
      vendorBill = new VendorBill({
        billNumber: 'TEST-BILL-001',
        vendorInvoiceNumber: 'INV-001',
        vendor: supplier._id,
        billDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        totalAmount: 1000,
        paidAmount: 0,
        balanceAmount: 1000,
        status: 'pending',
        organization: organization._id,
        createdBy: user._id,
        lineItems: [{
          description: 'Test Item',
          quantity: 1,
          unitPrice: 1000,
          totalPrice: 1000
        }]
      });
      await vendorBill.save();
      console.log('📄 Created test vendor bill');
    }

    console.log('\n=== TESTING PAYMENT SCHEDULE CRUD OPERATIONS ===');

    // Test 1: Create Payment Schedule
    console.log('\n=== TEST 1: Create Payment Schedule ===');
    const scheduleData = {
      bill: vendorBill._id,
      vendor: supplier._id,
      amount: 500,
      scheduledDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      paymentMethod: 'check',
      priority: 'medium',
      notes: 'Test payment schedule',
      status: 'pending',
      organization: organization._id,
      createdBy: user._id
    };

    const schedule = new PaymentSchedule(scheduleData);
    await schedule.save();
    console.log(`✅ Created payment schedule: ${schedule._id}`);
    console.log(`   Amount: $${schedule.amount}`);
    console.log(`   Scheduled Date: ${schedule.scheduledDate.toDateString()}`);
    console.log(`   Status: ${schedule.status}`);

    // Test 2: Get Payment Schedules
    console.log('\n=== TEST 2: Get Payment Schedules ===');
    const schedules = await PaymentSchedule.find({ organization: organization._id })
      .populate('vendor', 'name email')
      .populate('bill', 'billNumber vendorInvoiceNumber totalAmount balanceAmount')
      .sort({ scheduledDate: 1 });
    
    console.log(`✅ Found ${schedules.length} payment schedule(s)`);
    schedules.forEach((s, index) => {
      console.log(`   Schedule ${index + 1}:`);
      console.log(`     ID: ${s._id}`);
      console.log(`     Vendor: ${s.vendor?.name}`);
      console.log(`     Bill: ${s.bill?.billNumber}`);
      console.log(`     Amount: $${s.amount}`);
      console.log(`     Status: ${s.status}`);
      console.log(`     Scheduled: ${s.scheduledDate.toDateString()}`);
    });

    // Test 3: Update Payment Schedule
    console.log('\n=== TEST 3: Update Payment Schedule ===');
    schedule.amount = 750;
    schedule.status = 'approved';
    schedule.priority = 'high';
    schedule.updatedBy = user._id;
    schedule.updatedAt = new Date();
    await schedule.save();
    
    console.log(`✅ Updated payment schedule: ${schedule._id}`);
    console.log(`   New Amount: $${schedule.amount}`);
    console.log(`   New Status: ${schedule.status}`);
    console.log(`   New Priority: ${schedule.priority}`);

    // Test 4: Get Schedule by Status
    console.log('\n=== TEST 4: Get Schedules by Status ===');
    const approvedSchedules = await PaymentSchedule.find({ 
      organization: organization._id,
      status: 'approved'
    }).populate('vendor', 'name');
    
    console.log(`✅ Found ${approvedSchedules.length} approved schedule(s)`);
    approvedSchedules.forEach((s, index) => {
      console.log(`   Approved Schedule ${index + 1}: ${s.vendor?.name} - $${s.amount}`);
    });

    // Test 5: Get Schedules by Date Range
    console.log('\n=== TEST 5: Get Schedules by Date Range ===');
    const today = new Date();
    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    const weeklySchedules = await PaymentSchedule.find({
      organization: organization._id,
      scheduledDate: { $gte: today, $lte: nextWeek }
    }).populate('vendor', 'name');
    
    console.log(`✅ Found ${weeklySchedules.length} schedule(s) for next 7 days`);
    weeklySchedules.forEach((s, index) => {
      console.log(`   Weekly Schedule ${index + 1}: ${s.vendor?.name} - $${s.amount} on ${s.scheduledDate.toDateString()}`);
    });

    // Test 6: Test Validation (Amount exceeds bill balance)
    console.log('\n=== TEST 6: Test Validation ===');
    try {
      const invalidSchedule = new PaymentSchedule({
        bill: vendorBill._id,
        vendor: supplier._id,
        amount: 2000, // Exceeds bill balance of 1000
        scheduledDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        paymentMethod: 'check',
        priority: 'medium',
        status: 'pending',
        organization: organization._id,
        createdBy: user._id
      });
      await invalidSchedule.save();
      console.log('❌ Validation should have failed but didn\'t');
    } catch (error) {
      console.log('✅ Validation working - cannot exceed bill balance');
    }

    // Test 7: Delete Payment Schedule
    console.log('\n=== TEST 7: Delete Payment Schedule ===');
    const deleteResult = await PaymentSchedule.findByIdAndDelete(schedule._id);
    if (deleteResult) {
      console.log(`✅ Successfully deleted payment schedule: ${schedule._id}`);
    } else {
      console.log('❌ Failed to delete payment schedule');
    }

    // Verify deletion
    const deletedSchedule = await PaymentSchedule.findById(schedule._id);
    if (!deletedSchedule) {
      console.log('✅ Confirmed schedule was deleted');
    } else {
      console.log('❌ Schedule still exists after deletion');
    }

    console.log('\n✅ Payment Schedule CRUD test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the test
testPaymentSchedules(); 