const mongoose = require('mongoose');
const Role = require('../models/Role');
const User = require('../models/User');
const { PERMISSIONS } = require('../utils/permissions');

// Load environment variables
require('dotenv').config();

const fixCategoryUserRole = async () => {
  try {
    console.log('🔧 Fixing roles with only category view permissions...\n');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/inventory');
    console.log('✅ Connected to MongoDB');

    // Find roles that have categories:view but not inventory:view
    const rolesWithCategoryOnly = await Role.find({
      permissions: { 
        $in: [PERMISSIONS.CATEGORIES_VIEW],
        $nin: [PERMISSIONS.INVENTORY_VIEW]
      }
    });

    console.log(`📋 Found ${rolesWithCategoryOnly.length} roles with categories:view but missing inventory:view`);

    for (const role of rolesWithCategoryOnly) {
      console.log(`\n🔄 Updating role: ${role.name}`);
      console.log(`   Current permissions: ${role.permissions.length}`);
      console.log(`   Permissions: ${role.permissions.join(', ')}`);

      // Add the necessary permissions for inventory navigation
      const updatedPermissions = [
        ...new Set([
          ...role.permissions,
          PERMISSIONS.INVENTORY_VIEW,  // Required for sidebar navigation
          PERMISSIONS.PRODUCTS_VIEW,   // Required for products page
          PERMISSIONS.WAREHOUSE_VIEW,  // Required for warehouse page
          PERMISSIONS.CATEGORIES_VIEW  // Keep existing permission
        ])
      ];

      await Role.findByIdAndUpdate(role._id, {
        permissions: updatedPermissions
      });

      console.log(`   ✅ Updated permissions: ${updatedPermissions.length}`);
      console.log(`   New permissions: ${updatedPermissions.join(', ')}`);
    }

    // Also check for users with only categories:view in legacy role field
    const usersWithCategoryRole = await User.find({
      $or: [
        { role: 'category_viewer' },
        { role: 'categories' }
      ]
    });

    if (usersWithCategoryRole.length > 0) {
      console.log(`\n👥 Found ${usersWithCategoryRole.length} users with legacy category roles`);
      
      // Create or update a role for category viewers
      let categoryViewerRole = await Role.findOne({ name: 'category_viewer' });
      
      if (!categoryViewerRole) {
        categoryViewerRole = await Role.create({
          name: 'category_viewer',
          description: 'Can view and manage categories and basic inventory',
          permissions: [
            PERMISSIONS.INVENTORY_VIEW,
            PERMISSIONS.CATEGORIES_VIEW,
            PERMISSIONS.CATEGORIES_CREATE,
            PERMISSIONS.CATEGORIES_EDIT,
            PERMISSIONS.PRODUCTS_VIEW,
            PERMISSIONS.WAREHOUSE_VIEW
          ],
          isCustom: true
        });
        console.log(`   ✅ Created new role: category_viewer`);
      } else {
        // Update existing role to ensure it has inventory:view
        const updatedPermissions = [
          ...new Set([
            ...categoryViewerRole.permissions,
            PERMISSIONS.INVENTORY_VIEW,
            PERMISSIONS.CATEGORIES_VIEW,
            PERMISSIONS.CATEGORIES_CREATE,
            PERMISSIONS.CATEGORIES_EDIT,
            PERMISSIONS.PRODUCTS_VIEW,
            PERMISSIONS.WAREHOUSE_VIEW
          ])
        ];

        await Role.findByIdAndUpdate(categoryViewerRole._id, {
          permissions: updatedPermissions
        });
        console.log(`   ✅ Updated existing category_viewer role`);
      }

      // Update users to use the proper role reference
      for (const user of usersWithCategoryRole) {
        await User.findByIdAndUpdate(user._id, {
          role: categoryViewerRole._id,
          legacyRole: user.role // Preserve legacy role
        });
        console.log(`   ✅ Updated user ${user.email} to use role reference`);
      }
    }

    console.log('\n🎉 Role fix completed successfully!');
    console.log('\n📝 Summary:');
    console.log(`   - Updated ${rolesWithCategoryOnly.length} roles with missing inventory:view`);
    console.log(`   - Updated ${usersWithCategoryRole.length} users with legacy category roles`);
    console.log('\n💡 Users should now be able to:');
    console.log('   - See the Inventory section in the sidebar');
    console.log('   - Access Categories page');
    console.log('   - View Products and Warehouses (read-only)');

  } catch (error) {
    console.error('❌ Error fixing category user role:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n📡 Disconnected from MongoDB');
    process.exit(0);
  }
};

// Run the script
fixCategoryUserRole(); 