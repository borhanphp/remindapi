const mongoose = require('mongoose');
const User = require('../models/User');
const Role = require('../models/Role');

async function fixUserRole() {
  try {
    console.log('🔧 Fixing user role assignment...\n');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/inventory');
    console.log('✅ Connected to MongoDB');

    // Find your user
    const userEmail = 'borhanidb@gmail.com';
    let user = await User.findOne({ email: userEmail });
    
    if (!user) {
      console.log(`⚠️ User with email ${userEmail} not found in the new system`);
      console.log('Checking for users with legacy string roles...');
      
      // Try to find user with legacy string role
      const users = await User.find({});
      console.log(`Found ${users.length} total users:`);
      
      users.forEach(u => {
        console.log(`- ${u.email}: role=${u.role}, legacyRole=${u.legacyRole || 'none'}`);
      });
      
      // Find user by checking all users
      user = users.find(u => u.email === userEmail);
      
      if (!user) {
        console.error(`❌ User with email ${userEmail} not found at all`);
        return;
      }
    }

    console.log(`\n📋 Current user state:`);
    console.log(`- Email: ${user.email}`);
    console.log(`- Current role: ${user.role}`);
    console.log(`- Role type: ${typeof user.role}`);
    console.log(`- Legacy role: ${user.legacyRole || 'none'}`);

    // Find admin role
    const adminRole = await Role.findOne({ name: 'admin' });
    
    if (!adminRole) {
      console.error('❌ Admin role not found! Please run createAdminUser script first.');
      return;
    }

    console.log(`\n🎯 Admin role found:`);
    console.log(`- ID: ${adminRole._id}`);
    console.log(`- Permissions: ${adminRole.permissions.length}`);

    // Update user to have admin role
    user.role = adminRole._id;
    user.legacyRole = 'admin'; // Preserve legacy role
    await user.save();

    console.log(`\n✅ Successfully updated user role!`);

    // Verify the update
    const updatedUser = await User.findOne({ email: userEmail }).populate('role');
    console.log(`\n🔍 Verification:`);
    console.log(`- Role type: ${typeof updatedUser.role}`);
    console.log(`- Role name: ${updatedUser.role.name}`);
    console.log(`- Permissions count: ${updatedUser.role.permissions.length}`);
    console.log(`- Legacy role: ${updatedUser.legacyRole}`);

    // Test permission check
    const hasUserViewPermission = updatedUser.role.permissions.includes('users:view');
    const hasRoleCreatePermission = updatedUser.role.permissions.includes('roles:create');
    
    console.log(`\n🧪 Permission test:`);
    console.log(`- Has users:view: ${hasUserViewPermission}`);
    console.log(`- Has roles:create: ${hasRoleCreatePermission}`);

    if (hasUserViewPermission && hasRoleCreatePermission) {
      console.log(`\n🎉 SUCCESS! User now has admin permissions!`);
    } else {
      console.log(`\n⚠️ WARNING: Admin role might not have all permissions`);
    }

    await mongoose.disconnect();
    console.log('\n✅ Database connection closed');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixUserRole(); 