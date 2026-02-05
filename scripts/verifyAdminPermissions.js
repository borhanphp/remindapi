/**
 * Verification script to ensure Admin role gets ALL permissions
 * This script tests the permission system to confirm admin has complete access
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Role = require('../models/Role');
const { PERMISSIONS } = require('../utils/permissions');
const { ROLE_PERMISSIONS } = require('../utils/rolePermissions');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    process.exit(1);
  }
};

const verifyAdminPermissions = async () => {
  try {
    console.log('🔍 VERIFYING ADMIN PERMISSIONS\n');

    // Get all available permissions from the system
    const allPermissions = Object.values(PERMISSIONS);
    console.log(`📊 Total available permissions in system: ${allPermissions.length}`);

    // Get admin permissions from role definition
    const adminPermissionsFromConfig = ROLE_PERMISSIONS.admin;
    console.log(`📋 Admin permissions from config: ${adminPermissionsFromConfig.length}`);

    // Get admin role from database
    const adminRole = await Role.findOne({ name: 'admin' });
    
    if (!adminRole) {
      console.log('❌ CRITICAL ERROR: Admin role not found in database!');
      return false;
    }

    const adminPermissionsFromDb = adminRole.permissions;
    console.log(`💾 Admin permissions from database: ${adminPermissionsFromDb.length}`);

    // Check if admin has ALL permissions
    const hasAllPermissions = allPermissions.length === adminPermissionsFromConfig.length &&
                             allPermissions.length === adminPermissionsFromDb.length;

    console.log(`\n✅ VERIFICATION RESULTS:`);
    console.log(`- All permissions count: ${allPermissions.length}`);
    console.log(`- Admin config permissions: ${adminPermissionsFromConfig.length}`);
    console.log(`- Admin database permissions: ${adminPermissionsFromDb.length}`);
    console.log(`- Admin has ALL permissions: ${hasAllPermissions ? '✅ YES' : '❌ NO'}`);

    if (!hasAllPermissions) {
      // Find missing permissions
      const missingFromConfig = allPermissions.filter(p => !adminPermissionsFromConfig.includes(p));
      const missingFromDb = allPermissions.filter(p => !adminPermissionsFromDb.includes(p));

      if (missingFromConfig.length > 0) {
        console.log(`\n❌ Missing from config: ${missingFromConfig.join(', ')}`);
      }

      if (missingFromDb.length > 0) {
        console.log(`\n❌ Missing from database: ${missingFromDb.join(', ')}`);
      }

      return false;
    }

    // Sample verification of key permission categories
    const permissionCategories = {
      'User Management': allPermissions.filter(p => p.startsWith('users:')),
      'Role Management': allPermissions.filter(p => p.startsWith('roles:')),
      'Inventory': allPermissions.filter(p => p.startsWith('inventory:')),
      'Sales': allPermissions.filter(p => p.startsWith('sales:') || p.startsWith('sale-')),
      'Purchase': allPermissions.filter(p => p.startsWith('purchase')),
      'Reports': allPermissions.filter(p => p.includes('reports')),
      'Accounting': allPermissions.filter(p => p.startsWith('account') || p.startsWith('journal')),
      'System Admin': allPermissions.filter(p => p.startsWith('system:') || p.startsWith('backup:'))
    };

    console.log(`\n📋 PERMISSION CATEGORIES VERIFICATION:`);
    for (const [category, permissions] of Object.entries(permissionCategories)) {
      const hasAll = permissions.every(p => adminPermissionsFromDb.includes(p));
      console.log(`- ${category}: ${permissions.length} permissions ${hasAll ? '✅' : '❌'}`);
    }

    // Test some specific critical permissions
    const criticalPermissions = [
      'users:delete',
      'roles:delete', 
      'system:admin',
      'backup:create',
      'backup:restore',
      'settings:delete',
      'inventory:delete',
      'purchase:approve',
      'journal-entry:approve'
    ];

    console.log(`\n🔐 CRITICAL PERMISSIONS CHECK:`);
    const missingCritical = criticalPermissions.filter(p => !adminPermissionsFromDb.includes(p));
    
    if (missingCritical.length === 0) {
      console.log(`✅ Admin has all ${criticalPermissions.length} critical permissions`);
    } else {
      console.log(`❌ Admin missing critical permissions: ${missingCritical.join(', ')}`);
    }

    return hasAllPermissions && missingCritical.length === 0;

  } catch (error) {
    console.error('Error verifying admin permissions:', error);
    return false;
  }
};

const showPermissionSummary = async () => {
  try {
    console.log(`\n📊 PERMISSION SYSTEM SUMMARY:`);
    
    // Get all permissions organized by module
    const allPermissions = Object.entries(PERMISSIONS);
    const moduleGroups = {};
    
    allPermissions.forEach(([key, value]) => {
      const module = value.split(':')[0];
      if (!moduleGroups[module]) {
        moduleGroups[module] = [];
      }
      moduleGroups[module].push(value);
    });

    console.log(`Total permissions: ${allPermissions.length}`);
    console.log(`Permission modules: ${Object.keys(moduleGroups).length}`);
    
    Object.entries(moduleGroups).forEach(([module, permissions]) => {
      console.log(`- ${module}: ${permissions.length} permissions`);
    });

    // Show role comparison
    console.log(`\n👥 ROLE PERMISSION COMPARISON:`);
    const roles = await Role.find();
    
    for (const role of roles) {
      const percentage = ((role.permissions.length / allPermissions.length) * 100).toFixed(1);
      console.log(`- ${role.name}: ${role.permissions.length}/${allPermissions.length} (${percentage}%)`);
    }

  } catch (error) {
    console.error('Error showing permission summary:', error);
  }
};

const runVerification = async () => {
  try {
    console.log('=== ADMIN PERMISSIONS VERIFICATION ===\n');
    
    await connectDB();
    const isValid = await verifyAdminPermissions();
    await showPermissionSummary();
    
    console.log(`\n🎯 FINAL RESULT:`);
    if (isValid) {
      console.log('✅ ADMIN ROLE IS CORRECTLY CONFIGURED');
      console.log('✅ Admin has ALL available permissions');
      console.log('✅ Permission system is working correctly');
    } else {
      console.log('❌ ADMIN ROLE CONFIGURATION ERROR');
      console.log('❌ Admin does not have all permissions');
      console.log('❌ Manual intervention required');
    }
    
  } catch (error) {
    console.error('\n❌ Verification failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\nDatabase connection closed.');
  }
};

// Run verification if this script is executed directly
if (require.main === module) {
  runVerification();
}

module.exports = {
  verifyAdminPermissions,
  showPermissionSummary,
  runVerification
}; 