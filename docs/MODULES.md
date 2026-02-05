# Modular System Documentation

## Overview

This inventory management system has been designed with a modular architecture that allows you to enable or disable specific functionality based on your needs.

## Available Modules

### 1. Core Module
- **Always Enabled**: Yes
- **Description**: Essential functionality including authentication, user management, and organization management
- **Components**: Users, Roles, Organizations, Authentication

### 2. Inventory Module
- **Default**: Enabled
- **Environment Variable**: `ENABLE_INVENTORY_MODULE`
- **Description**: Complete inventory management system
- **Components**:
  - Products and Categories
  - Warehouses and Stock Management
  - Purchase Orders and Receipts
  - Sales Orders and Invoices
  - Stock Adjustments and Transfers
  - Suppliers and Customers
  - Reports and Analytics

### 3. Accounting Module
- **Default**: Disabled
- **Environment Variable**: `ENABLE_ACCOUNTING_MODULE`
- **Description**: Full-featured accounting system with double-entry bookkeeping
- **Components**:
  - Chart of Accounts
  - Journal Entries and Ledgers
  - Financial Statements (Balance Sheet, Income Statement, Cash Flow)
  - Trial Balance
  - Integration with Inventory for automatic entries

## Configuration

### Environment Variables

Add these to your `.env` file:

```bash
# Module Configuration
ENABLE_INVENTORY_MODULE=true    # Set to 'false' to disable
ENABLE_ACCOUNTING_MODULE=true   # Set to 'true' to enable
```

### Usage Scenarios

#### 1. Inventory Only (Default)
```bash
ENABLE_INVENTORY_MODULE=true
ENABLE_ACCOUNTING_MODULE=false
```
Perfect for businesses that only need inventory management.

#### 2. Accounting Only
```bash
ENABLE_INVENTORY_MODULE=false
ENABLE_ACCOUNTING_MODULE=true
```
Ideal for service businesses that need accounting without inventory.

#### 3. Full System (Inventory + Accounting)
```bash
ENABLE_INVENTORY_MODULE=true
ENABLE_ACCOUNTING_MODULE=true
```
Complete solution with automatic integration between modules.

## API Endpoints

### Core Endpoints (Always Available)
- `/api/auth/*` - Authentication
- `/api/users/*` - User management
- `/api/roles/*` - Role management
- `/api/modules` - Module configuration info

### Inventory Module Endpoints
Available when `ENABLE_INVENTORY_MODULE=true`:
- `/api/products/*`
- `/api/categories/*`
- `/api/warehouses/*`
- `/api/customers/*`
- `/api/suppliers/*`
- `/api/sales/*`
- `/api/purchase-*/*`
- `/api/stock-*/*`

### Accounting Module Endpoints
Available when `ENABLE_ACCOUNTING_MODULE=true`:
- `/api/accounting/accounts/*` - Chart of Accounts
- `/api/accounting/journal-entries/*` - Journal Entries
- `/api/accounting/reports/*` - Financial Reports

## Integration Features

When both modules are enabled:

### 1. Automatic Journal Entries
- Sales transactions create revenue and COGS entries
- Purchase transactions create inventory and payable entries
- Stock adjustments create inventory adjustment entries

### 2. Financial Reporting
- Inventory valuation included in balance sheet
- Cost of goods sold properly calculated
- Integrated profit and loss statements

### 3. Real-time Synchronization
- Inventory changes immediately reflected in accounting
- Financial reports include latest inventory values

## Database Collections

### Core Collections (Always Created)
- `users`
- `roles`
- `organizations`

### Inventory Collections (When Enabled)
- `products`, `categories`, `warehouses`
- `customers`, `suppliers`
- `saleorders`, `saleinvoices`, `purchaseorders`
- `stockadjustments`, `stocktransfers`
- And more...

### Accounting Collections (When Enabled)
- `accounts` - Chart of Accounts
- `journalentries` - All accounting transactions
- `ledgers` - Account balances and history

## Development

### Adding New Modules

1. Create module configuration in `config/modules.js`
2. Add models with conditional loading in `models/index.js`
3. Create controllers with module check middleware
4. Add routes with conditional loading in `server.js`
5. Update frontend with module-aware components

### Module Check Middleware

```javascript
const { checkAccountingModule } = require('../controllers/accountController');

router.use(checkAccountingModule); // Returns 403 if module disabled
```

## Deployment

### Docker Configuration
Use different environment files for different deployments:
- `.env.inventory-only`
- `.env.accounting-only`
- `.env.full-system`

### Performance Considerations
- Disabled modules don't load models or routes
- Reduced memory usage and faster startup
- Smaller bundle size when modules are excluded

## Troubleshooting

### Module Not Available Error
```json
{
  "success": false,
  "message": "Accounting module is not enabled"
}
```
**Solution**: Set `ENABLE_ACCOUNTING_MODULE=true` in environment variables.

### Missing Routes
If endpoints return 404, check:
1. Module is enabled in environment
2. Server was restarted after config change
3. Route is properly defined for the module

### Database Issues
When switching modules:
1. Backup database before major changes
2. Run migrations if needed
3. Clear cache and restart application

## Future Modules

Planned modules for future releases:
- **CRM Module**: Customer relationship management
- **HR Module**: Human resources and payroll
- **Reporting Module**: Advanced analytics and reporting
- **E-commerce Module**: Online store integration 