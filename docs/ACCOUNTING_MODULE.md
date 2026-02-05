# Accounting Module Documentation

## Overview

The Accounting Module provides a comprehensive double-entry bookkeeping system that can work independently or integrate seamlessly with the Inventory Module. It follows standard accounting principles and supports multiple organizations.

## Features

### ✅ Core Accounting Features
- **Chart of Accounts** - Hierarchical account structure with 5 main types
- **Double-Entry Bookkeeping** - Automatic balance validation
- **Journal Entries** - Manual and automatic entry creation
- **General Ledger** - Complete transaction history by account
- **Trial Balance** - Real-time balance verification
- **Financial Statements** - Balance Sheet, Income Statement, Cash Flow

### 🔄 Integration Features
- **Inventory Integration** - Automatic COGS and inventory valuation
- **Modular Design** - Enable/disable independently
- **Real-time Sync** - Immediate reflection of inventory changes

## Quick Start

### 1. Enable the Module

Add to your `.env` file:
```bash
ENABLE_ACCOUNTING_MODULE=true
```

### 2. Initialize Chart of Accounts

```bash
POST /api/accounting/accounts/initialize
```

### 3. Start Creating Transactions

```javascript
// Create a journal entry
const entryData = {
  description: "Sale of products",
  journalLines: [
    {
      account: "1200", // Accounts Receivable
      debitAmount: 1000,
      creditAmount: 0
    },
    {
      account: "4000", // Sales Revenue
      debitAmount: 0,
      creditAmount: 1000
    }
  ]
};
```

## API Reference

### Chart of Accounts

#### Get All Accounts
```http
GET /api/accounting/accounts
```

**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 50)
- `accountType` - Filter by account type
- `isActive` - Filter by active status

**Response:**
```json
{
  "success": true,
  "data": {
    "accounts": [...],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 100,
      "pages": 2
    }
  }
}
```

#### Create Account
```http
POST /api/accounting/accounts
```

**Request Body:**
```json
{
  "accountCode": "1400",
  "accountName": "Prepaid Expenses",
  "accountType": "Asset",
  "accountSubType": "Current Asset",
  "normalBalance": "Debit",
  "description": "Expenses paid in advance"
}
```

#### Get Account Types
```http
GET /api/accounting/accounts/types
```

### Journal Entries

#### Get All Journal Entries
```http
GET /api/accounting/journal-entries
```

**Query Parameters:**
- `status` - Filter by status (Draft, Posted, Reversed)
- `startDate` - Filter from date
- `endDate` - Filter to date
- `documentType` - Filter by source document type

#### Create Journal Entry
```http
POST /api/accounting/journal-entries
```

**Request Body:**
```json
{
  "description": "Monthly rent payment",
  "journalLines": [
    {
      "account": "6100",
      "description": "Office rent expense",
      "debitAmount": 2000,
      "creditAmount": 0
    },
    {
      "account": "1000",
      "description": "Cash payment",
      "debitAmount": 0,
      "creditAmount": 2000
    }
  ]
}
```

#### Post Journal Entry
```http
PATCH /api/accounting/journal-entries/{id}/post
```

#### Reverse Journal Entry
```http
POST /api/accounting/journal-entries/{id}/reverse
```

### Financial Reports

#### Trial Balance
```http
GET /api/accounting/reports/trial-balance?asOfDate=2024-12-31
```

#### Balance Sheet
```http
GET /api/accounting/reports/balance-sheet?asOfDate=2024-12-31
```

#### Income Statement
```http
GET /api/accounting/reports/income-statement?startDate=2024-01-01&endDate=2024-12-31
```

#### Account Ledger
```http
GET /api/accounting/reports/account-ledger/{accountId}
```

## Default Chart of Accounts

### Assets (1000-1999)
- **1000** - Cash
- **1010** - Bank Account
- **1200** - Accounts Receivable
- **1300** - Inventory (System Account)
- **1500** - Equipment

### Liabilities (2000-2999)
- **2000** - Accounts Payable
- **2100** - Sales Tax Payable

### Equity (3000-3999)
- **3000** - Owner Equity
- **3900** - Retained Earnings

### Revenue (4000-4999)
- **4000** - Sales Revenue (System Account)

### Expenses (5000-6999)
- **5000** - Cost of Goods Sold (System Account)
- **6000** - Operating Expenses
- **6100** - Rent Expense
- **6200** - Utilities Expense

## Integration with Inventory

When both modules are enabled, the system automatically creates accounting entries for:

### Sales Transactions
```
Dr. Cost of Goods Sold    xxx
    Cr. Inventory             xxx

Dr. Accounts Receivable   xxx
    Cr. Sales Revenue         xxx
```

### Purchase Transactions
```
Dr. Inventory            xxx
    Cr. Accounts Payable     xxx
```

### Stock Adjustments
```
Dr. Inventory            xxx
    Cr. Owner Equity         xxx
```

## Testing

Run the accounting module test:
```bash
npm run test:accounting
```

This will:
1. Initialize chart of accounts
2. Create sample journal entries
3. Generate trial balance
4. Create financial statements
5. Test inventory integration
6. Verify account ledgers

## Configuration

### Environment Variables

```bash
# Required
ENABLE_ACCOUNTING_MODULE=true
MONGO_URI=mongodb://localhost:27017/yourdb

# Optional
ENABLE_INVENTORY_MODULE=true  # For integration features
```

### Module Status Check

```http
GET /api/integration/status
```

**Response:**
```json
{
  "success": true,
  "data": {
    "modules": {
      "inventory": true,
      "accounting": true
    },
    "integration": {
      "enabled": true,
      "accountingInitialized": true
    }
  }
}
```

## Advanced Features

### Account Hierarchies
Accounts can have parent-child relationships for better organization:

```json
{
  "accountCode": "1200",
  "accountName": "Accounts Receivable",
  "parentAccount": "1000" // Cash account ID
}
```

### Automatic Entry Generation
The system can automatically create journal entries from business transactions:

```javascript
const IntegrationService = require('./services/integrationService');

// Automatically create entries for a sale
await IntegrationService.handleSaleTransaction({
  items: [
    { productId: "123", quantity: 5, unitCost: 10 }
  ],
  organizationId: "org123",
  saleId: "sale456"
}, userId);
```

### Entry Reversal
Any posted journal entry can be reversed:

```http
POST /api/accounting/journal-entries/{id}/reverse
{
  "description": "Reversal due to error"
}
```

## Best Practices

### 1. Account Numbering
- Follow standard numbering: 1000s=Assets, 2000s=Liabilities, etc.
- Leave gaps for future accounts (1000, 1010, 1020...)
- Use descriptive account names

### 2. Journal Entry Guidelines
- Always include meaningful descriptions
- Verify debits equal credits before posting
- Use draft status for entries under review
- Include reference numbers for traceability

### 3. Integration Considerations
- Initialize accounting before enabling integration
- Sync existing inventory before going live
- Monitor automatic entries for accuracy
- Set up proper account mappings

### 4. Reporting
- Run trial balance regularly to ensure accuracy
- Generate monthly financial statements
- Monitor account balances for anomalies
- Back up accounting data regularly

## Troubleshooting

### Common Issues

#### 1. Module Not Enabled
**Error:** "Accounting module is not enabled"
**Solution:** Set `ENABLE_ACCOUNTING_MODULE=true` and restart server

#### 2. Unbalanced Journal Entry
**Error:** "Journal entry must be balanced"
**Solution:** Ensure total debits equal total credits

#### 3. Account Not Found
**Error:** "Account not found"
**Solution:** Verify account exists and is active

#### 4. Integration Issues
**Error:** Various integration errors
**Solution:** Check both modules are enabled and accounting is initialized

### Debug Mode
Enable detailed logging by setting:
```bash
NODE_ENV=development
DEBUG=accounting:*
```

## Schema Reference

### Account Schema
```javascript
{
  accountCode: String,        // Unique account code
  accountName: String,        // Account display name
  accountType: String,        // Asset|Liability|Equity|Revenue|Expense
  accountSubType: String,     // Specific category
  parentAccount: ObjectId,    // Parent account reference
  normalBalance: String,      // Debit|Credit
  currentBalance: Number,     // Current account balance
  isActive: Boolean,          // Account status
  isSystemAccount: Boolean,   // Protected system account
  organization: ObjectId,     // Organization reference
  createdBy: ObjectId,        // User who created
  timestamps: true
}
```

### Journal Entry Schema
```javascript
{
  entryNumber: String,        // Auto-generated entry number
  entryDate: Date,           // Transaction date
  description: String,        // Entry description
  journalLines: [{           // Array of journal lines
    account: ObjectId,        // Account reference
    description: String,      // Line description
    debitAmount: Number,      // Debit amount
    creditAmount: Number      // Credit amount
  }],
  totalDebit: Number,        // Total of all debits
  totalCredit: Number,       // Total of all credits
  status: String,            // Draft|Posted|Reversed
  sourceDocument: {          // Source document reference
    documentType: String,
    documentId: ObjectId
  },
  organization: ObjectId,
  createdBy: ObjectId,
  timestamps: true
}
```

### Ledger Schema
```javascript
{
  account: ObjectId,         // Account reference
  journalEntry: ObjectId,    // Journal entry reference
  entryDate: Date,          // Transaction date
  description: String,       // Transaction description
  debitAmount: Number,       // Debit amount
  creditAmount: Number,      // Credit amount
  runningBalance: Number,    // Running account balance
  organization: ObjectId,
  timestamps: true
}
``` 