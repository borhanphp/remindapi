const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');
const Role = require('../models/Role');
const { PERMISSIONS } = require('../utils/permissions');
const { ROLE_PERMISSIONS } = require('../utils/rolePermissions');

// Load env vars
dotenv.config();

// Connect to DB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const checkUserPermissions = async () => {
  try {
    console.log('Checking user permissions...');
    
    // 1. Get all admin users
    const adminUsers = await User.find({ role: 'admin' });
    console.log(`Found ${adminUsers.length} admin users in the database`);
    
    // 2. Get the admin role from the database
    const adminRole = await Role.findOne({ name: 'admin' });
    
    if (!adminRole) {
      console.log('Admin role not found in the database!');
      console.log('This is a serious issue - make sure to run updateRolePermissions.js first');
      process.exit(1);
    }
    
    console.log(`Admin role has ${adminRole.permissions.length} permissions`);
    
    // 3. Get all permissions from the code
    const allCodePermissions = Object.values(PERMISSIONS);
    console.log(`Code defines ${allCodePermissions.length} permissions`);
    
    // 4. Find missing permissions
    const missingPermissions = allCodePermissions.filter(p => !adminRole.permissions.includes(p));
    
    if (missingPermissions.length > 0) {
      console.log('\nWARNING: Admin role is missing these permissions:');
      missingPermissions.forEach(p => console.log(`  - ${p}`));
      
      // Add missing permissions
      console.log('\nUpdating admin role with all permissions...');
      adminRole.permissions = allCodePermissions;
      await adminRole.save();
      console.log(`Updated admin role - now has ${adminRole.permissions.length} permissions`);
    } else {
      console.log('Admin role has all required permissions');
    }
    
    // 5. Find permissions in DB that aren't in the code (shouldn't happen, but good to check)
    const extraPermissions = adminRole.permissions.filter(p => !allCodePermissions.includes(p));
    if (extraPermissions.length > 0) {
      console.log('\nWARNING: Admin role has these extra permissions not defined in code:');
      extraPermissions.forEach(p => console.log(`  - ${p}`));
    }
    
    // 6. Print all permissions for verification
    console.log('\nCurrent admin role permissions:');
    adminRole.permissions.forEach(permission => {
      console.log(`  - ${permission}`);
    });
    
    console.log('\nUser permissions verification complete!');
    process.exit(0);
  } catch (err) {
    console.error('Error checking user permissions:', err);
    process.exit(1);
  }
};

checkUserPermissions(); 