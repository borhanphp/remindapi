const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Role = require('../models/Role');
const User = require('../models/User');

// Load env vars
dotenv.config();

// Connect to DB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const fixAdminPermissions = async () => {
  try {
    console.log('Starting admin permissions fix...');
    
    // Define all required permissions
    const allPermissions = [
      // User permissions
      'users:view', 'users:create', 'users:edit', 'users:delete',
      
      // Inventory permissions
      'inventory:view', 'inventory:create', 'inventory:edit', 'inventory:delete',
      
      // Warehouse permissions
      'warehouse:view', 'warehouse:create', 'warehouse:edit', 'warehouse:delete',
      
      // Stock adjustment permissions
      'stock-adjustment:view', 'stock-adjustment:create', 'stock-adjustment:delete',
      
      // Stock transfer permissions
      'stock-transfer:view', 'stock-transfer:create', 'stock-transfer:edit', 'stock-transfer:delete',
      
      // Stock alert permissions
      'stock-alert:view', 'stock-alert:manage',
      
      // Sales permissions
      'sales:view', 'sales:create', 'sales:edit', 'sales:delete',
      
      // Purchase permissions
      'purchase:view', 'purchase:create', 'purchase:edit', 'purchase:delete',
      
      // Reports permissions
      'reports:view', 'reports:export',
      
      // Settings permissions
      'settings:view', 'settings:edit',
    ];
    
    console.log(`Total required permissions: ${allPermissions.length}`);
    
    // Find admin role
    let adminRole = await Role.findOne({ name: 'admin' });
    
    if (!adminRole) {
      console.log('Admin role not found. Creating it...');
      
      adminRole = new Role({
        name: 'admin',
        description: 'Administrator role with all permissions',
        permissions: allPermissions,
        isCustom: false
      });
      
      await adminRole.save();
      console.log('Admin role created successfully');
    } else {
      console.log(`Found admin role with ${adminRole.permissions.length} permissions`);
      
      // Update admin role with all permissions
      adminRole.permissions = allPermissions;
      await adminRole.save();
      
      console.log(`Updated admin role - now has ${adminRole.permissions.length} permissions`);
    }
    
    // Find admin users
    const adminUsers = await User.find({ role: 'admin' });
    console.log(`Found ${adminUsers.length} admin users`);
    
    // Log admin users
    if (adminUsers.length > 0) {
      console.log('\nAdmin users:');
      adminUsers.forEach(user => {
        console.log(`  - ${user.name} (${user.email})`);
      });
    }
    
    console.log('\nAdmin permissions fixed successfully!');
    console.log('\nPlease restart your server and clear browser cookies to apply these changes.');
    process.exit(0);
  } catch (err) {
    console.error('Error fixing admin permissions:', err);
    process.exit(1);
  }
};

fixAdminPermissions(); 