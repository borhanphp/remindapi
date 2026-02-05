/**
 * Permission constants for the backend
 * These should match the frontend permissions
 */

exports.PERMISSIONS = {
  // User management permissions
  USERS_VIEW: 'users:view',
  USERS_CREATE: 'users:create',
  USERS_EDIT: 'users:edit',
  USERS_DELETE: 'users:delete',

  // Role management permissions
  ROLES_VIEW: 'roles:view',
  ROLES_CREATE: 'roles:create',
  ROLES_EDIT: 'roles:edit',
  ROLES_DELETE: 'roles:delete',

  // Inventory permissions
  INVENTORY_VIEW: 'inventory:view',
  INVENTORY_CREATE: 'inventory:create',
  INVENTORY_EDIT: 'inventory:edit',
  INVENTORY_DELETE: 'inventory:delete',

  // Warehouse permissions
  WAREHOUSE_VIEW: 'warehouse:view',
  WAREHOUSE_CREATE: 'warehouse:create',
  WAREHOUSE_EDIT: 'warehouse:edit',
  WAREHOUSE_DELETE: 'warehouse:delete',

  // Product permissions
  PRODUCTS_VIEW: 'products:view',
  PRODUCTS_CREATE: 'products:create',
  PRODUCTS_EDIT: 'products:edit',
  PRODUCTS_DELETE: 'products:delete',

  // Category permissions
  CATEGORIES_VIEW: 'categories:view',
  CATEGORIES_CREATE: 'categories:create',
  CATEGORIES_EDIT: 'categories:edit',
  CATEGORIES_DELETE: 'categories:delete',

  // Brand permissions
  BRANDS_VIEW: 'brands:view',
  BRANDS_CREATE: 'brands:create',
  BRANDS_EDIT: 'brands:edit',
  BRANDS_DELETE: 'brands:delete',

  // Stock adjustment permissions
  STOCK_ADJUSTMENT_VIEW: 'stock-adjustment:view',
  STOCK_ADJUSTMENT_CREATE: 'stock-adjustment:create',
  STOCK_ADJUSTMENT_EDIT: 'stock-adjustment:edit',
  STOCK_ADJUSTMENT_DELETE: 'stock-adjustment:delete',

  // Stock transfer permissions
  STOCK_TRANSFER_VIEW: 'stock-transfer:view',
  STOCK_TRANSFER_CREATE: 'stock-transfer:create',
  STOCK_TRANSFER_EDIT: 'stock-transfer:edit',
  STOCK_TRANSFER_DELETE: 'stock-transfer:delete',

  // Stock alert permissions
  STOCK_ALERT_VIEW: 'stock-alert:view',
  STOCK_ALERT_CREATE: 'stock-alert:create',
  STOCK_ALERT_EDIT: 'stock-alert:edit',
  STOCK_ALERT_MANAGE: 'stock-alert:manage',
  STOCK_ALERT_DELETE: 'stock-alert:delete',

  // Sales permissions
  SALES_VIEW: 'sales:view',
  SALES_CREATE: 'sales:create',
  SALES_EDIT: 'sales:edit',
  SALES_DELETE: 'sales:delete',
  SALES_APPROVE: 'sales:approve',

  // Purchase permissions
  PURCHASE_VIEW: 'purchase:view',
  PURCHASE_CREATE: 'purchase:create',
  PURCHASE_EDIT: 'purchase:edit',
  PURCHASE_DELETE: 'purchase:delete',
  PURCHASE_APPROVE: 'purchase:approve',

  // Purchase Order permissions
  PURCHASE_ORDER_VIEW: 'purchase-order:view',
  PURCHASE_ORDER_CREATE: 'purchase-order:create',
  PURCHASE_ORDER_EDIT: 'purchase-order:edit',
  PURCHASE_ORDER_DELETE: 'purchase-order:delete',
  PURCHASE_ORDER_APPROVE: 'purchase-order:approve',

  // Purchase Invoice permissions
  PURCHASE_INVOICE_VIEW: 'purchase-invoice:view',
  PURCHASE_INVOICE_CREATE: 'purchase-invoice:create',
  PURCHASE_INVOICE_EDIT: 'purchase-invoice:edit',
  PURCHASE_INVOICE_DELETE: 'purchase-invoice:delete',
  PURCHASE_INVOICE_APPROVE: 'purchase-invoice:approve',

  // Purchase Requisition permissions
  PURCHASE_REQUISITION_VIEW: 'purchase-requisition:view',
  PURCHASE_REQUISITION_CREATE: 'purchase-requisition:create',
  PURCHASE_REQUISITION_EDIT: 'purchase-requisition:edit',
  PURCHASE_REQUISITION_DELETE: 'purchase-requisition:delete',
  PURCHASE_REQUISITION_APPROVE: 'purchase-requisition:approve',

  // Purchase Receipt permissions
  PURCHASE_RECEIPT_VIEW: 'purchase-receipt:view',
  PURCHASE_RECEIPT_CREATE: 'purchase-receipt:create',
  PURCHASE_RECEIPT_EDIT: 'purchase-receipt:edit',
  PURCHASE_RECEIPT_DELETE: 'purchase-receipt:delete',
  PURCHASE_RECEIPT_APPROVE: 'purchase-receipt:approve',

  // GRN (Goods Received Note) permissions
  GRN_VIEW: 'grn:view',
  GRN_CREATE: 'grn:create',
  GRN_EDIT: 'grn:edit',
  GRN_DELETE: 'grn:delete',
  GRN_APPROVE: 'grn:approve',

  // Sale Order permissions
  SALE_ORDER_VIEW: 'sale-order:view',
  SALE_ORDER_CREATE: 'sale-order:create',
  SALE_ORDER_EDIT: 'sale-order:edit',
  SALE_ORDER_DELETE: 'sale-order:delete',
  SALE_ORDER_APPROVE: 'sale-order:approve',

  // Sale Invoice permissions
  SALE_INVOICE_VIEW: 'sale-invoice:view',
  SALE_INVOICE_CREATE: 'sale-invoice:create',
  SALE_INVOICE_EDIT: 'sale-invoice:edit',
  SALE_INVOICE_DELETE: 'sale-invoice:delete',
  SALE_INVOICE_APPROVE: 'sale-invoice:approve',

  // Sale Payment permissions
  SALE_PAYMENT_VIEW: 'sale-payment:view',
  SALE_PAYMENT_CREATE: 'sale-payment:create',
  SALE_PAYMENT_EDIT: 'sale-payment:edit',
  SALE_PAYMENT_DELETE: 'sale-payment:delete',

  // Sale Return permissions
  SALE_RETURN_VIEW: 'sale-return:view',
  SALE_RETURN_CREATE: 'sale-return:create',
  SALE_RETURN_EDIT: 'sale-return:edit',
  SALE_RETURN_DELETE: 'sale-return:delete',
  SALE_RETURN_APPROVE: 'sale-return:approve',

  // Delivery permissions
  DELIVERY_VIEW: 'delivery:view',
  DELIVERY_CREATE: 'delivery:create',
  DELIVERY_EDIT: 'delivery:edit',
  DELIVERY_DELETE: 'delivery:delete',
  DELIVERY_APPROVE: 'delivery:approve',

  // Quotation permissions
  QUOTATION_VIEW: 'quotation:view',
  QUOTATION_CREATE: 'quotation:create',
  QUOTATION_EDIT: 'quotation:edit',
  QUOTATION_DELETE: 'quotation:delete',
  QUOTATION_APPROVE: 'quotation:approve',

  // Customer permissions
  CUSTOMERS_VIEW: 'customers:view',
  CUSTOMERS_CREATE: 'customers:create',
  CUSTOMERS_EDIT: 'customers:edit',
  CUSTOMERS_DELETE: 'customers:delete',

  // Supplier permissions
  SUPPLIERS_VIEW: 'suppliers:view',
  SUPPLIERS_CREATE: 'suppliers:create',
  SUPPLIERS_EDIT: 'suppliers:edit',
  SUPPLIERS_DELETE: 'suppliers:delete',

  // Reports permissions
  REPORTS_VIEW: 'reports:view',
  REPORTS_CREATE: 'reports:create',
  REPORTS_EDIT: 'reports:edit',
  REPORTS_DELETE: 'reports:delete',
  REPORTS_EXPORT: 'reports:export',
  REPORTS_IMPORT: 'reports:import',

  // CRM permissions
  CRM_VIEW: 'crm:view',
  CRM_EDIT: 'crm:edit',
  CRM_SEND: 'crm:send',

  // Financial Reports permissions
  FINANCIAL_REPORTS_VIEW: 'financial-reports:view',
  FINANCIAL_REPORTS_CREATE: 'financial-reports:create',
  FINANCIAL_REPORTS_EXPORT: 'financial-reports:export',

  // Sales Reports permissions
  SALES_REPORTS_VIEW: 'sales-reports:view',
  SALES_REPORTS_CREATE: 'sales-reports:create',
  SALES_REPORTS_EXPORT: 'sales-reports:export',

  // Purchase Reports permissions
  PURCHASE_REPORTS_VIEW: 'purchase-reports:view',
  PURCHASE_REPORTS_CREATE: 'purchase-reports:create',
  PURCHASE_REPORTS_EXPORT: 'purchase-reports:export',

  // Accounting permissions
  ACCOUNTING_VIEW: 'accounting:view',
  ACCOUNTING_CREATE: 'accounting:create',
  ACCOUNTING_EDIT: 'accounting:edit',
  ACCOUNTING_DELETE: 'accounting:delete',

  // Accounts Payable permissions
  ACCOUNTS_PAYABLE_VIEW: 'accounts-payable:view',
  ACCOUNTS_PAYABLE_CREATE: 'accounts-payable:create',
  ACCOUNTS_PAYABLE_EDIT: 'accounts-payable:edit',
  ACCOUNTS_PAYABLE_DELETE: 'accounts-payable:delete',

  // Accounts Receivable permissions
  ACCOUNTS_RECEIVABLE_VIEW: 'accounts-receivable:view',
  ACCOUNTS_RECEIVABLE_CREATE: 'accounts-receivable:create',
  ACCOUNTS_RECEIVABLE_EDIT: 'accounts-receivable:edit',
  ACCOUNTS_RECEIVABLE_DELETE: 'accounts-receivable:delete',

  // Journal Entry permissions
  JOURNAL_ENTRY_VIEW: 'journal-entry:view',
  JOURNAL_ENTRY_CREATE: 'journal-entry:create',
  JOURNAL_ENTRY_EDIT: 'journal-entry:edit',
  JOURNAL_ENTRY_DELETE: 'journal-entry:delete',
  JOURNAL_ENTRY_APPROVE: 'journal-entry:approve',

  // Settings permissions
  SETTINGS_VIEW: 'settings:view',
  SETTINGS_EDIT: 'settings:edit',
  SETTINGS_CREATE: 'settings:create',
  SETTINGS_DELETE: 'settings:delete',

  // Organization permissions
  ORGANIZATION_VIEW: 'organization:view',
  ORGANIZATION_EDIT: 'organization:edit',
  ORGANIZATION_CREATE: 'organization:create',
  ORGANIZATION_DELETE: 'organization:delete',

  // Integration permissions
  INTEGRATION_VIEW: 'integration:view',
  INTEGRATION_CREATE: 'integration:create',
  INTEGRATION_EDIT: 'integration:edit',
  INTEGRATION_DELETE: 'integration:delete',
  INTEGRATION_CONFIGURE: 'integration:configure',

  // Backup and restore permissions
  BACKUP_CREATE: 'backup:create',
  BACKUP_RESTORE: 'backup:restore',
  BACKUP_VIEW: 'backup:view',
  BACKUP_DELETE: 'backup:delete',

  // Audit permissions
  AUDIT_VIEW: 'audit:view',
  AUDIT_CREATE: 'audit:create',
  AUDIT_EXPORT: 'audit:export',

  // System administration permissions
  SYSTEM_ADMIN: 'system:admin',
  SYSTEM_MAINTENANCE: 'system:maintenance',
  SYSTEM_MONITORING: 'system:monitoring',

  // Projects module permissions
  PROJECTS_VIEW: 'projects:view',
  PROJECTS_CREATE: 'projects:create',
  PROJECTS_EDIT: 'projects:edit',
  PROJECTS_DELETE: 'projects:delete',
  TASKS_VIEW: 'tasks:view',
  TASKS_CREATE: 'tasks:create',
  TASKS_EDIT: 'tasks:edit',
  TASKS_DELETE: 'tasks:delete',
  TIME_VIEW: 'time:view',
  TIME_CREATE: 'time:create',
  TIME_EDIT: 'time:edit',
  TIME_DELETE: 'time:delete'
  ,

  // HRM permissions (to align with HRM routes)
  HRM_VIEW: 'hrm:view',
  HRM_EDIT: 'hrm:edit',
  HRM_RECRUIT: 'hrm:recruit',
  HRM_ATTENDANCE: 'hrm:attendance',
  HRM_LEAVE: 'hrm:leave',
  HRM_PAYROLL: 'hrm:payroll',
  HRM_PERFORMANCE: 'hrm:performance',

  // Self-service leave (narrow permission)
  LEAVE_SELF: 'leave:self',

  // Custom Invoicing module permissions
  CUSTOM_INVOICE_VIEW: 'custom-invoice:view',
  CUSTOM_INVOICE_CREATE: 'custom-invoice:create',
  CUSTOM_INVOICE_EDIT: 'custom-invoice:edit',
  CUSTOM_INVOICE_DELETE: 'custom-invoice:delete',
  CUSTOM_INVOICE_SEND: 'custom-invoice:send',
  ESTIMATE_VIEW: 'estimate:view',
  ESTIMATE_CREATE: 'estimate:create',
  RECURRING_INVOICE_MANAGE: 'recurring-invoice:manage',
  INVOICE_SETTINGS_EDIT: 'invoice-settings:edit'
};
