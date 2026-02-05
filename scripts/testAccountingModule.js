const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Force enable accounting module for testing
process.env.ENABLE_ACCOUNTING_MODULE = 'true';

const Account = require('../models/Account');
const JournalEntry = require('../models/JournalEntry');
const Ledger = require('../models/Ledger');
const AccountingService = require('../services/accountingService');

async function testAccountingModule() {
  try {
    console.log('🚀 Starting Accounting Module Test...\n');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');
    
    // Mock organization and user IDs (replace with real ones from your DB)
    const organizationId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();
    
    console.log(`📊 Using Organization ID: ${organizationId}`);
    console.log(`👤 Using User ID: ${userId}\n`);
    
    // Test 1: Initialize Chart of Accounts
    console.log('📋 Test 1: Initializing Chart of Accounts...');
    const accounts = await AccountingService.initializeChartOfAccounts(organizationId, userId);
    console.log(`✅ Created ${accounts.length} accounts`);
    
    // Display some accounts
    accounts.slice(0, 5).forEach(account => {
      console.log(`   ${account.accountCode} - ${account.accountName} (${account.accountType})`);
    });
    console.log('   ...\n');
    
    // Test 2: Create a Journal Entry
    console.log('📝 Test 2: Creating Journal Entry...');
    const entryData = {
      entryDate: new Date(),
      description: 'Test journal entry',
      journalLines: [
        {
          account: accounts.find(a => a.accountCode === '1000')._id, // Cash
          description: 'Test debit entry',
          debitAmount: 1000,
          creditAmount: 0
        },
        {
          account: accounts.find(a => a.accountCode === '4000')._id, // Sales Revenue
          description: 'Test credit entry',
          debitAmount: 0,
          creditAmount: 1000
        }
      ],
      organization: organizationId
    };
    
    const journalEntry = await AccountingService.createJournalEntry(entryData, userId);
    console.log(`✅ Created Journal Entry: ${journalEntry.entryNumber}`);
    console.log(`   Status: ${journalEntry.status}`);
    console.log(`   Total Debit: $${journalEntry.totalDebit}`);
    console.log(`   Total Credit: $${journalEntry.totalCredit}\n`);
    
    // Test 3: Get Trial Balance
    console.log('⚖️  Test 3: Generating Trial Balance...');
    const trialBalance = await Ledger.getTrialBalance(organizationId);
    console.log(`✅ Trial Balance generated with ${trialBalance.length} accounts`);
    
    trialBalance.slice(0, 5).forEach(item => {
      console.log(`   ${item.account.accountCode} - ${item.account.accountName}: $${item.balance}`);
    });
    if (trialBalance.length > 5) console.log('   ...');
    console.log('');
    
    // Test 4: Get Financial Statements
    console.log('📊 Test 4: Generating Financial Statements...');
    const statements = await AccountingService.getFinancialStatements(organizationId);
    console.log('✅ Financial Statements generated');
    console.log(`   Total Assets: $${statements.balanceSheet.totalAssets}`);
    console.log(`   Total Liabilities: $${statements.balanceSheet.totalLiabilities}`);
    console.log(`   Total Equity: $${statements.balanceSheet.totalEquity}`);
    console.log(`   Total Revenue: $${statements.incomeStatement.totalRevenue}`);
    console.log(`   Total Expenses: $${statements.incomeStatement.totalExpenses}`);
    console.log(`   Net Income: $${statements.incomeStatement.netIncome}\n`);
    
    // Test 5: Test Inventory Integration
    console.log('🔄 Test 5: Testing Inventory Integration...');
    const saleTransactionData = {
      type: 'sale',
      productId: 'TEST_PRODUCT_001',
      quantity: 5,
      unitCost: 50,
      documentType: 'SaleInvoice',
      documentId: new mongoose.Types.ObjectId()
    };
    
    const inventoryEntry = await AccountingService.createInventoryJournalEntry(
      saleTransactionData, 
      organizationId, 
      userId
    );
    
    console.log(`✅ Created inventory journal entry: ${inventoryEntry.entryNumber}`);
    console.log(`   Description: ${inventoryEntry.description}`);
    console.log(`   Lines: ${inventoryEntry.journalLines.length}\n`);
    
    // Test 6: Account Ledger
    console.log('📖 Test 6: Getting Account Ledger...');
    const cashAccount = accounts.find(a => a.accountCode === '1000');
    const ledgerData = await AccountingService.getAccountLedger(cashAccount._id);
    
    console.log(`✅ Account Ledger for ${cashAccount.accountName}`);
    console.log(`   Entries: ${ledgerData.entries.length}`);
    if (ledgerData.balance) {
      console.log(`   Current Balance: $${ledgerData.balance.balance}`);
    }
    console.log('');
    
    console.log('🎉 All tests completed successfully!');
    console.log('\n📋 Summary:');
    console.log(`   • ${accounts.length} accounts created`);
    console.log(`   • Journal entries working correctly`);
    console.log(`   • Trial balance generation working`);
    console.log(`   • Financial statements generation working`);
    console.log(`   • Inventory integration working`);
    console.log(`   • Account ledger working`);
    
    // Cleanup (optional - comment out if you want to keep test data)
    console.log('\n🧹 Cleaning up test data...');
    await JournalEntry.deleteMany({ organization: organizationId });
    await Ledger.deleteMany({ organization: organizationId });
    await Account.deleteMany({ organization: organizationId });
    console.log('✅ Test data cleaned up');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error);
  } finally {
    await mongoose.connection.close();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

// Run the test
if (require.main === module) {
  testAccountingModule();
}

module.exports = { testAccountingModule }; 