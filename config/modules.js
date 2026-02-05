const moduleConfig = {
  // Core module is always enabled
  core: {
    enabled: true,
    name: 'Core',
    description: 'Core functionality including authentication and user management'
  },
  
  // Inventory module configuration (always enabled)
  inventory: {
    enabled: true,
    name: 'Inventory Management',
    description: 'Complete inventory management system with products, warehouses, stock tracking'
  },
  
  // Accounting module configuration (always enabled)
  accounting: {
    enabled: true,
    name: 'Accounting',
    description: 'Full featured accounting system with double-entry bookkeeping, financial statements'
  },
  
  // CRM module configuration (always enabled)
  crm: {
    enabled: true,
    name: 'CRM',
    description: 'Customer Relationship Management: leads, deals, activities, segments, proposals'
  },
  
  // HRM module configuration (always enabled)
  hrm: {
    enabled: true,
    name: 'Human Resources & Payroll',
    description: 'Employees, recruitment, attendance, leave, payroll, performance reviews'
  },
  
  // Projects module configuration (always enabled)
  projects: {
    enabled: true,
    name: 'Projects',
    description: 'Project management, tasks, milestones, time tracking, task automation'
  },
  
  // Custom Invoicing module configuration (always enabled)
  'custom-invoicing': {
    enabled: true,
    name: 'Custom Invoicing',
    description: 'Custom invoices, estimates, recurring billing, PDF generation, email sending, client portal'
  }
};

// Get enabled modules
const getEnabledModules = () => {
  return Object.keys(moduleConfig).filter(module => moduleConfig[module].enabled);
};

// Check if module is enabled
const isModuleEnabled = (moduleName) => {
  return moduleConfig[moduleName] && moduleConfig[moduleName].enabled;
};

// Get module info
const getModuleInfo = (moduleName) => {
  return moduleConfig[moduleName] || null;
};

// Get all modules info
const getAllModules = () => {
  return moduleConfig;
};

module.exports = {
  moduleConfig,
  getEnabledModules,
  isModuleEnabled,
  getModuleInfo,
  getAllModules
}; 