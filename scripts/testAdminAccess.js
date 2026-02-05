const mongoose = require('mongoose');
const User = require('../models/User');
const Role = require('../models/Role');
const { PERMISSIONS } = require('../utils/permissions');
const jwt = require('jsonwebtoken');

async function testAdminAccess() {
  try {
    console.log('🧪 Testing admin access flow...\n');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/inventory');
    console.log('✅ Connected to MongoDB');

    // Test 1: Find admin user
    console.log('\n📋 === STEP 1: Find Admin User ===');
    const adminUser = await User.findOne({ email: 'admin@inventory.com' }).populate('role');
    
    if (!adminUser) {
      console.log('❌ Admin user not found');
      process.exit(1);
    }

    console.log(`✅ Found admin user: ${adminUser.email}`);
    console.log(`✅ Role populated: ${adminUser.role ? 'Yes' : 'No'}`);
    console.log(`✅ Role name: ${adminUser.role.name}`);
    console.log(`✅ Permissions: ${adminUser.role.permissions.length}`);

    // Test 2: Generate JWT token (simulate login)
    console.log('\n🔑 === STEP 2: Generate JWT Token ===');
    const JWT_SECRET = process.env.JWT_SECRET || 'inventory-management-secret-key';
    
    const token = jwt.sign(
      { 
        id: adminUser._id,
        email: adminUser.email
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    console.log(`✅ JWT Token generated: ${token.substring(0, 50)}...`);

    // Test 3: Verify token (simulate middleware)
    console.log('\n🔓 === STEP 3: Verify Token (Auth Middleware Simulation) ===');
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      console.log(`✅ Token decoded successfully`);
      console.log(`✅ User ID: ${decoded.id}`);
      
      // Simulate the protect middleware
      const userFromToken = await User.findById(decoded.id)
        .populate('role')
        .select('-password');
      
      if (!userFromToken) {
        console.log('❌ User not found from token');
        process.exit(1);
      }

      console.log(`✅ User loaded from token: ${userFromToken.email}`);
      console.log(`✅ Role populated: ${userFromToken.role ? 'Yes' : 'No'}`);
      
      if (userFromToken.role) {
        console.log(`✅ Role type: ${typeof userFromToken.role}`);
        console.log(`✅ Has permissions array: ${Array.isArray(userFromToken.role.permissions)}`);
      }

    } catch (tokenError) {
      console.log(`❌ Token verification failed: ${tokenError.message}`);
      process.exit(1);
    }

    // Test 4: Permission checking (simulate authorize middleware)
    console.log('\n🔐 === STEP 4: Permission Checking ===');
    
    const testPermissions = [
      'users:view',
      'users:create',
      'roles:view', 
      'roles:create',
      'products:view',
      'sales:view',
      'purchase:view',
      'inventory:view',
      'stock_alerts:view',
      'stock_alerts:manage'
    ];

    console.log('Testing key permissions:');
    let allPermissionsPass = true;
    
    testPermissions.forEach(permission => {
      const hasPermission = adminUser.role.permissions.includes(permission);
      console.log(`${hasPermission ? '✅' : '❌'} ${permission}`);
      if (!hasPermission) allPermissionsPass = false;
    });

    // Test 5: Admin should have ALL permissions
    console.log('\n🎯 === STEP 5: Admin Complete Access Test ===');
    const allPermissions = Object.values(PERMISSIONS);
    const adminPermissions = adminUser.role.permissions;
    
    console.log(`Total permissions in system: ${allPermissions.length}`);
    console.log(`Admin has permissions: ${adminPermissions.length}`);
    
    const missingPermissions = allPermissions.filter(p => !adminPermissions.includes(p));
    
    if (missingPermissions.length === 0) {
      console.log('✅ Admin has ALL permissions!');
    } else {
      console.log(`❌ Admin missing ${missingPermissions.length} permissions:`);
      missingPermissions.slice(0, 5).forEach(p => console.log(`   - ${p}`));
      if (missingPermissions.length > 5) {
        console.log(`   ... and ${missingPermissions.length - 5} more`);
      }
    }

    // Test 6: Full authentication flow test
    console.log('\n🔄 === STEP 6: Full Auth Flow Test ===');
    
    // Simulate the exact flow from the protect middleware
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await User.findById(decoded.id)
        .populate('role')
        .select('-password');

      if (!user) {
        throw new Error('User not found');
      }

      if (!user.isActive) {
        throw new Error('User account is deactivated');
      }

      // Test authorization for a specific permission
      const testPermission = 'users:view';
      let hasPermission = false;
      
      if (user.role && typeof user.role === 'object') {
        hasPermission = user.role.permissions.includes(testPermission);
      }

      console.log(`✅ Auth flow completed successfully`);
      console.log(`✅ User: ${user.email}`);
      console.log(`✅ Has '${testPermission}' permission: ${hasPermission}`);

      if (!hasPermission) {
        console.log('❌ CRITICAL: Admin should have all permissions!');
        allPermissionsPass = false;
      }

    } catch (flowError) {
      console.log(`❌ Auth flow failed: ${flowError.message}`);
      allPermissionsPass = false;
    }

    // Final result
    console.log('\n🎉 === FINAL RESULT ===');
    if (allPermissionsPass) {
      console.log('🎉 SUCCESS! Admin authentication and authorization working correctly!');
      console.log('\n📝 Next steps:');
      console.log('1. ✅ Admin user is properly configured');
      console.log('2. ✅ JWT token generation works');
      console.log('3. ✅ Role population works');
      console.log('4. ✅ Permission checking works');
      console.log('5. 🔧 Make sure frontend sends proper Authorization headers');
      console.log('6. 🔧 Check your login response includes the token');
    } else {
      console.log('❌ ISSUES FOUND! Please check the errors above.');
    }

    await mongoose.disconnect();
    console.log('\n✅ Test completed');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testAdminAccess(); 