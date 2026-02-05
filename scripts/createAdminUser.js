const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Role = require('../models/Role');

async function createAdminUser() {
  try {
    console.log('👤 Creating admin user...\n');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/inventory');
    console.log('✅ Connected to MongoDB');

    // Find or create admin role first
    let adminRole = await Role.findOne({ name: 'admin' });
    
    if (!adminRole) {
      console.log('🔧 Admin role not found, creating it...');
      
      // Get all permissions from the permissions file
      const { PERMISSIONS } = require('../utils/permissions');
      const allPermissions = Object.values(PERMISSIONS);
      
      adminRole = new Role({
        name: 'admin',
        description: 'Full system administrator with all permissions',
        permissions: allPermissions,
        isActive: true
      });
      
      await adminRole.save();
      console.log(`✅ Created admin role with ${allPermissions.length} permissions`);
    } else {
      console.log(`✅ Found existing admin role with ${adminRole.permissions.length} permissions`);
    }

    // User details
    const userData = {
      name: 'Admin User',
      email: 'admin@inventory.com',
      password: 'admin123', // You should change this!
      role: adminRole._id,
      legacyRole: 'admin',
      isActive: true
    };

    // Check if user already exists
    const existingUser = await User.findOne({ email: userData.email });
    if (existingUser) {
      console.log(`\n⚠️ User with email ${userData.email} already exists`);
      console.log('Updating existing user to admin role...');
      
      existingUser.role = adminRole._id;
      existingUser.legacyRole = 'admin';
      await existingUser.save();
      
      console.log('✅ Updated existing user to admin role');
    } else {
      // Hash password
      const salt = await bcrypt.genSalt(10);
      userData.password = await bcrypt.hash(userData.password, salt);

      // Create new user
      const newUser = new User(userData);
      await newUser.save();
      
      console.log(`✅ Created new admin user: ${userData.email}`);
    }

    // Verify the user
    const verifyUser = await User.findOne({ email: userData.email }).populate('role');
    
    console.log(`\n🔍 User verification:`);
    console.log(`- Email: ${verifyUser.email}`);
    console.log(`- Name: ${verifyUser.name}`);
    console.log(`- Role type: ${typeof verifyUser.role}`);
    console.log(`- Role name: ${verifyUser.role.name}`);
    console.log(`- Permissions count: ${verifyUser.role.permissions.length}`);
    console.log(`- Legacy role: ${verifyUser.legacyRole}`);
    console.log(`- Is active: ${verifyUser.isActive}`);

    // Test some key admin permissions
    const keyPermissions = ['users:view', 'users:create', 'roles:create', 'products:create', 'sales:create'];
    console.log(`\n🧪 Key permission checks:`);
    
    keyPermissions.forEach(permission => {
      const hasPermission = verifyUser.role.permissions.includes(permission);
      console.log(`- ${permission}: ${hasPermission ? '✅' : '❌'}`);
    });

    console.log(`\n🎉 SUCCESS! Admin user is ready to use!`);
    console.log(`\n📋 Login credentials:`);
    console.log(`- Email: ${userData.email}`);
    console.log(`- Password: admin123 (please change this!)`);

    await mongoose.disconnect();
    console.log('\n✅ Database connection closed');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

createAdminUser(); 