/**
 * Migration script to transition users from legacy role system to new role-based system
 * This script will:
 * 1. Ensure all default roles exist in the database with COMPLETE permissions
 * 2. Migrate existing users to use role references instead of string roles
 * 3. Preserve legacy roles for backward compatibility during transition
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Role = require('../models/Role');
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

// Create default roles if they don't exist
const createDefaultRoles = async () => {
  try {
    console.log('Creating/updating default roles with comprehensive permissions...');

    const defaultRoles = [
      {
        name: 'admin',
        description: 'Full system access - ALL PERMISSIONS automatically assigned',
        permissions: ROLE_PERMISSIONS.admin, // This will get ALL permissions via Object.values(PERMISSIONS)
        isCustom: false
      },
      {
        name: 'manager',
        description: 'Comprehensive management access with limited system admin functions',
        permissions: ROLE_PERMISSIONS.manager,
        isCustom: false
      },
      {
        name: 'accountant',
        description: 'Financial management, accounting, and comprehensive reporting access',
        permissions: ROLE_PERMISSIONS.accountant,
        isCustom: false
      },
      {
        name: 'salesperson',
        description: 'Sales management, customer relations, and inventory viewing',
        permissions: ROLE_PERMISSIONS.salesperson,
        isCustom: false
      },
      {
        name: 'staff',
        description: 'Basic staff access with essential viewing permissions',
        permissions: ROLE_PERMISSIONS.staff,
        isCustom: false
      },
      {
        name: 'warehouse_manager',
        description: 'Complete warehouse and inventory management access',
        permissions: ROLE_PERMISSIONS.warehouse_manager,
        isCustom: false
      }
    ];

    console.log('\nRole permission counts:');
    for (const roleData of defaultRoles) {
      const existingRole = await Role.findOne({ name: roleData.name });
      
      if (!existingRole) {
        await Role.create(roleData);
        console.log(`✓ Created role: ${roleData.name} (${roleData.permissions.length} permissions)`);
      } else {
        // Update existing role permissions and description to ensure they have latest permissions
        await Role.findByIdAndUpdate(existingRole._id, {
          description: roleData.description,
          permissions: roleData.permissions,
          isCustom: false
        });
        console.log(`✓ Updated role: ${roleData.name} (${roleData.permissions.length} permissions)`);
      }
      
      // Show first few permissions for verification
      if (roleData.name === 'admin') {
        console.log(`  Admin permissions sample: ${roleData.permissions.slice(0, 5).join(', ')}... (${roleData.permissions.length} total)`);
      }
    }

    console.log('\nDefault roles setup completed with comprehensive permissions');
    
    // Verify admin has all permissions
    const adminRole = await Role.findOne({ name: 'admin' });
    if (adminRole) {
      console.log(`\n🎯 ADMIN VERIFICATION: Admin role has ${adminRole.permissions.length} permissions`);
      console.log(`   Sample admin permissions: ${adminRole.permissions.slice(0, 10).join(', ')}...`);
    }
    
  } catch (error) {
    console.error('Error creating default roles:', error);
    throw error;
  }
};

// Migrate users from legacy string roles to role references
const migrateUsers = async () => {
  try {
    console.log('\nStarting user migration...');

    // Get all roles for mapping
    const roles = await Role.find();
    const roleMap = {};
    roles.forEach(role => {
      roleMap[role.name] = role._id;
    });

    console.log(`Available roles for mapping: ${Object.keys(roleMap).join(', ')}`);

    // Find users that need migration (have string role or no role reference)
    const usersToMigrate = await User.find({
      $or: [
        { role: { $type: 'string' } },
        { role: { $exists: false } },
        { role: null }
      ]
    });

    console.log(`Found ${usersToMigrate.length} users to migrate`);

    let migratedCount = 0;
    let errorCount = 0;

    for (const user of usersToMigrate) {
      try {
        let targetRoleName;
        
        // Determine target role
        if (typeof user.role === 'string') {
          targetRoleName = user.role;
        } else {
          // Default to staff if no role is set
          targetRoleName = 'staff';
        }

        const targetRoleId = roleMap[targetRoleName];
        
        if (!targetRoleId) {
          console.error(`❌ Role "${targetRoleName}" not found for user ${user.email}`);
          errorCount++;
          continue;
        }

        // Update user with role reference and preserve legacy role
        await User.findByIdAndUpdate(user._id, {
          role: targetRoleId,
          legacyRole: targetRoleName
        });

        console.log(`✓ Migrated user ${user.email} to role: ${targetRoleName}`);
        migratedCount++;
      } catch (userError) {
        console.error(`❌ Error migrating user ${user.email}:`, userError);
        errorCount++;
      }
    }

    console.log(`\nMigration completed:`);
    console.log(`- Successfully migrated: ${migratedCount} users`);
    console.log(`- Errors: ${errorCount} users`);
    
    return { migratedCount, errorCount };
  } catch (error) {
    console.error('Error during user migration:', error);
    throw error;
  }
};

// Verify migration results
const verifyMigration = async () => {
  try {
    console.log('\nVerifying migration...');

    // Check for users without role references
    const usersWithoutRoles = await User.countDocuments({
      $or: [
        { role: { $exists: false } },
        { role: null }
      ]
    });

    // Check for users with string roles
    const usersWithStringRoles = await User.countDocuments({
      role: { $type: 'string' }
    });

    // Get role distribution with permission counts
    const roleDistribution = await User.aggregate([
      {
        $lookup: {
          from: 'roles',
          localField: 'role',
          foreignField: '_id',
          as: 'roleInfo'
        }
      },
      {
        $unwind: '$roleInfo'
      },
      {
        $group: {
          _id: '$roleInfo.name',
          count: { $sum: 1 },
          permissionCount: { $first: { $size: '$roleInfo.permissions' } }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    // Get admin users specifically
    const adminUsers = await User.aggregate([
      {
        $lookup: {
          from: 'roles',
          localField: 'role',
          foreignField: '_id',
          as: 'roleInfo'
        }
      },
      {
        $unwind: '$roleInfo'
      },
      {
        $match: { 'roleInfo.name': 'admin' }
      },
      {
        $project: {
          email: 1,
          name: 1,
          'roleInfo.name': 1,
          'roleInfo.permissions': 1
        }
      }
    ]);

    console.log('Verification Results:');
    console.log(`- Users without role references: ${usersWithoutRoles}`);
    console.log(`- Users with string roles: ${usersWithStringRoles}`);
    console.log('\nRole Distribution:');
    roleDistribution.forEach(item => {
      console.log(`  ${item._id}: ${item.count} users (${item.permissionCount} permissions)`);
    });

    if (adminUsers.length > 0) {
      console.log('\n👑 Admin Users:');
      adminUsers.forEach(admin => {
        console.log(`  ${admin.email} (${admin.name}) - ${admin.roleInfo.permissions.length} permissions`);
      });
    }

    const isSuccess = usersWithoutRoles === 0 && usersWithStringRoles === 0;
    console.log(`\nMigration verification: ${isSuccess ? '✅ SUCCESS' : '❌ FAILED'}`);
    
    return isSuccess;
  } catch (error) {
    console.error('Error during verification:', error);
    throw error;
  }
};

// Test admin permissions specifically
const testAdminPermissions = async () => {
  try {
    console.log('\n🔍 Testing Admin Permissions...');
    
    const adminRole = await Role.findOne({ name: 'admin' });
    if (!adminRole) {
      console.log('❌ Admin role not found!');
      return false;
    }
    
    console.log(`✅ Admin role found with ${adminRole.permissions.length} permissions`);
    
    // Sample some permissions to verify variety
    const samplePermissions = [
      'users:view', 'users:create', 'users:edit', 'users:delete',
      'roles:view', 'roles:create', 'roles:edit', 'roles:delete',
      'inventory:view', 'inventory:create', 'inventory:edit', 'inventory:delete',
      'sales:view', 'sales:create', 'sales:edit', 'sales:delete',
      'purchase:view', 'purchase:create', 'purchase:edit', 'purchase:delete',
      'reports:view', 'reports:export',
      'settings:view', 'settings:edit',
      'system:admin', 'backup:create'
    ];
    
    const missingPermissions = samplePermissions.filter(perm => !adminRole.permissions.includes(perm));
    
    if (missingPermissions.length === 0) {
      console.log('✅ Admin has all expected key permissions');
    } else {
      console.log(`❌ Admin missing permissions: ${missingPermissions.join(', ')}`);
    }
    
    return missingPermissions.length === 0;
  } catch (error) {
    console.error('Error testing admin permissions:', error);
    return false;
  }
};

// Main migration function
const runMigration = async () => {
  try {
    console.log('=== User Role Migration Script ===');
    console.log('🎯 ENSURING ADMIN GETS ALL PERMISSIONS BY DEFAULT\n');
    
    await connectDB();
    await createDefaultRoles();
    const migrationResult = await migrateUsers();
    const verificationResult = await verifyMigration();
    const adminTestResult = await testAdminPermissions();
    
    if (verificationResult && adminTestResult) {
      console.log('\n🎉 Migration completed successfully!');
      console.log('✅ Admin role has comprehensive permissions');
      console.log('✅ Users migrated to new role-based system');
      console.log('✅ Legacy roles preserved for compatibility');
    } else {
      console.log('\n⚠️  Migration completed with issues:');
      if (!verificationResult) console.log('   - User migration verification failed');
      if (!adminTestResult) console.log('   - Admin permissions verification failed');
    }
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\nDatabase connection closed.');
  }
};

// Run the migration if this script is executed directly
if (require.main === module) {
  runMigration();
}

module.exports = {
  createDefaultRoles,
  migrateUsers,
  verifyMigration,
  testAdminPermissions,
  runMigration
}; 