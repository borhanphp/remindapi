const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Role = require('../models/Role');

const testLoginFlow = async () => {
  try {
    console.log('🔍 Testing login flow with role population...\n');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/inventory');
    console.log('✅ Connected to MongoDB');

    // Test login flow
    console.log('\n📋 === TESTING LOGIN FLOW ===');
    
    const email = 'admin@inventory.com';
    const password = 'admin123';

    // Step 1: Find user and populate role (simulate login controller)
    console.log(`\n1. Finding user: ${email}`);
    const user = await User.findOne({ email }).populate('role');
    
    if (!user) {
      console.log('❌ User not found');
      return;
    }
    
    console.log('✅ User found');
    console.log(`   - Name: ${user.name}`);
    console.log(`   - Email: ${user.email}`);
    console.log(`   - Role populated: ${user.role ? 'Yes' : 'No'}`);
    
    if (user.role) {
      console.log(`   - Role name: ${user.role.name}`);
      console.log(`   - Role permissions count: ${user.role.permissions.length}`);
    }

    // Step 2: Verify password
    console.log('\n2. Verifying password...');
    const isMatch = await user.matchPassword(password);
    
    if (!isMatch) {
      console.log('❌ Password does not match');
      return;
    }
    
    console.log('✅ Password verified');

    // Step 3: Generate token
    console.log('\n3. Generating JWT token...');
    const generateToken = (id) => {
      return jwt.sign({ id }, process.env.JWT_SECRET || 'inventory-management-secret-key', {
        expiresIn: '30d',
      });
    };
    
    const token = generateToken(user._id);
    console.log(`✅ Token generated: ${token.substring(0, 50)}...`);

    // Step 4: Create response (simulate what controller returns)
    console.log('\n4. Creating login response...');
    const response = {
      success: true,
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        legacyRole: user.legacyRole,
        isActive: user.isActive,
      },
    };

    console.log('✅ Login response created');
    console.log('\n📋 === RESPONSE STRUCTURE ===');
    console.log(`- User ID: ${response.user._id}`);
    console.log(`- Name: ${response.user.name}`);
    console.log(`- Email: ${response.user.email}`);
    console.log(`- Role type: ${typeof response.user.role}`);
    console.log(`- Role name: ${response.user.role?.name}`);
    console.log(`- Role permissions: ${response.user.role?.permissions?.length || 0} permissions`);
    console.log(`- Legacy role: ${response.user.legacyRole}`);
    console.log(`- Is active: ${response.user.isActive}`);

    // Step 5: Test permission checking (simulate frontend logic)
    console.log('\n5. Testing permission checking...');
    
    const testPermissions = [
      'users:view',
      'users:create',
      'roles:view',
      'inventory:view',
      'products:view',
      'sales:view',
      'purchase:view'
    ];

    console.log('\nPermission checks:');
    testPermissions.forEach(permission => {
      let hasPermission = false;
      
      // Simulate frontend hasPermission function logic
      if (response.user.role && typeof response.user.role === 'object' && response.user.role.permissions) {
        hasPermission = response.user.role.permissions.includes(permission);
      }
      
      console.log(`${hasPermission ? '✅' : '❌'} ${permission}`);
    });

    console.log('\n🎉 === TEST RESULTS ===');
    if (response.user.role && response.user.role.permissions && response.user.role.permissions.length > 0) {
      console.log('✅ SUCCESS! Role is properly populated with permissions');
      console.log('✅ Frontend should now show navigation routes for admin users');
    } else {
      console.log('❌ FAILURE! Role is not properly populated');
    }

    await mongoose.disconnect();
    console.log('\n✅ Database connection closed');

  } catch (error) {
    console.error('❌ Error testing login flow:', error);
    await mongoose.disconnect();
  }
};

testLoginFlow(); 