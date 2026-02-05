const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');
const Role = require('../models/Role');
const { ROLE_PERMISSIONS } = require('../utils/rolePermissions');

// Load env vars
dotenv.config();

// Connect to DB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const checkAndFixUsers = async () => {
  try {
    console.log('Checking users and roles...');
    
    // 1. Get all users
    const users = await User.find();
    console.log(`Found ${users.length} users in the database`);
    
    // 2. Get all roles
    const roles = await Role.find();
    console.log(`Found ${roles.length} roles in the database`);
    
    // 3. Create a map of valid roles
    const validRoles = roles.reduce((acc, role) => {
      acc[role.name] = role;
      return acc;
    }, {});
    
    console.log('Valid roles in database:', Object.keys(validRoles));
    
    // 4. Check each user's role
    let fixedCount = 0;
    
    for (const user of users) {
      console.log(`\nChecking user ${user.name} (${user.email}), current role: ${user.role}`);
      
      // If user role doesn't exist in our valid roles
      if (!validRoles[user.role.toLowerCase()]) {
        console.log(`  - Invalid role ${user.role} for user ${user.email}`);
        
        // Set to admin if email has 'admin' in it, otherwise staff
        const newRole = user.email.includes('admin') ? 'admin' : 'staff';
        
        console.log(`  - Fixing: changing role from ${user.role} to ${newRole}`);
        user.role = newRole;
        await user.save();
        fixedCount++;
      } else {
        console.log(`  - Role ${user.role} is valid`);
      }
    }
    
    // Show summary
    if (fixedCount === 0) {
      console.log('\nAll users have valid roles. No fixes needed!');
    } else {
      console.log(`\nFixed roles for ${fixedCount} users`);
    }
    
    // Check if admin exists
    const adminUsers = users.filter(user => user.role === 'admin');
    if (adminUsers.length === 0) {
      console.log('\nWARNING: No admin users found in the system!');
      
      // Check if we need to create an admin user
      const createAdmin = process.env.CREATE_ADMIN === 'true';
      if (createAdmin) {
        const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
        const adminPassword = process.env.ADMIN_PASSWORD || 'password123';
        
        console.log(`Creating admin user with email: ${adminEmail}`);
        
        // Check if user exists
        let adminUser = await User.findOne({ email: adminEmail });
        
        if (adminUser) {
          console.log('Admin user already exists, updating role to admin');
          adminUser.role = 'admin';
          await adminUser.save();
        } else {
          // Create admin user
          adminUser = new User({
            name: 'Administrator',
            email: adminEmail,
            password: adminPassword,
            role: 'admin'
          });
          
          await adminUser.save();
          console.log('Admin user created successfully');
        }
      }
    } else {
      console.log(`\nFound ${adminUsers.length} admin users in the system:`);
      adminUsers.forEach(admin => console.log(`  - ${admin.name} (${admin.email})`));
    }
    
    // Print all users and their roles for verification
    console.log('\nCurrent user roles:');
    users.forEach(user => {
      console.log(`  - ${user.name} (${user.email}): ${user.role}`);
    });
    
    console.log('\nUser and role verification complete!');
    process.exit(0);
  } catch (err) {
    console.error('Error checking users and roles:', err);
    process.exit(1);
  }
};

checkAndFixUsers(); 