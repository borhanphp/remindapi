const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Role = require('../models/Role');
const { PERMISSIONS } = require('../utils/permissions');

// Load env vars
dotenv.config();

// Connect to DB
mongoose.connect(process.env.MONGO_URI);

const syncRolePermissions = async () => {
  try {
    console.log('🔄 Syncing role permissions...\n');
    
    // Get all permissions from the code
    const allCodePermissions = Object.values(PERMISSIONS);
    console.log(`📋 Code defines ${allCodePermissions.length} permissions\n`);
    
    // Get all roles from database
    const roles = await Role.find({});
    console.log(`👥 Found ${roles.length} roles in database\n`);
    
    if (roles.length === 0) {
      console.log('⚠️  No roles found in database!');
      console.log('You may need to create roles first or run a migration script.');
      process.exit(1);
    }
    
    for (const role of roles) {
      console.log(`\n🔍 Checking role: ${role.name}`);
      console.log(`   Current permissions: ${role.permissions.length}`);
      
      // Find missing permissions
      const missingPermissions = allCodePermissions.filter(p => !role.permissions.includes(p));
      
      if (missingPermissions.length > 0) {
        console.log(`   ⚠️  Missing ${missingPermissions.length} permissions:`);
        missingPermissions.slice(0, 10).forEach(p => console.log(`      - ${p}`));
        if (missingPermissions.length > 10) {
          console.log(`      ... and ${missingPermissions.length - 10} more`);
        }
        
        // Add missing permissions (merge with existing)
        role.permissions = [...new Set([...role.permissions, ...allCodePermissions])];
        await role.save();
        console.log(`   ✅ Updated - now has ${role.permissions.length} permissions`);
      } else {
        console.log(`   ✅ All permissions present`);
      }
    }
    
    // Special handling for admin/owner roles - ensure they have ALL permissions
    const adminRoleNames = ['admin', 'owner', 'super-admin', 'Super Admin', 'Admin', 'Owner'];
    
    console.log('\n🔐 Ensuring admin/owner roles have ALL permissions...');
    for (const roleName of adminRoleNames) {
      const adminRole = await Role.findOne({ name: { $regex: new RegExp(`^${roleName}$`, 'i') } });
      
      if (adminRole) {
        console.log(`   Updating ${adminRole.name}...`);
        adminRole.permissions = allCodePermissions;
        await adminRole.save();
        console.log(`   ✅ ${adminRole.name} updated with ${allCodePermissions.length} permissions`);
      }
    }
    
    console.log('\n✅ Role permissions sync completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`   Total roles updated: ${roles.length}`);
    console.log(`   Total permissions in code: ${allCodePermissions.length}`);
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error syncing role permissions:', err);
    process.exit(1);
  }
};

syncRolePermissions();

