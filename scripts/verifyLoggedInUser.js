const mongoose = require('mongoose');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Role = require('../models/Role');
const { PERMISSIONS } = require('../utils/permissions');

// Load env vars
dotenv.config();

// Connect to DB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// Function to verify a JWT token
const verifyToken = async (token) => {
  try {
    if (!token) {
      console.log('No token provided');
      return null;
    }
    
    // Remove Bearer if present
    if (token.startsWith('Bearer ')) {
      token = token.slice(7, token.length);
    }
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded;
  } catch (error) {
    console.error('Token verification error:', error.message);
    return null;
  }
};

const verifyLoggedInUser = async () => {
  if (process.argv.length < 3) {
    console.log('Usage: node verifyLoggedInUser.js <JWT-TOKEN>');
    process.exit(1);
  }
  
  const token = process.argv[2];
  
  try {
    console.log('Verifying user token...');
    
    // 1. Verify the token
    const decoded = await verifyToken(token);
    
    if (!decoded) {
      console.log('Invalid or expired token');
      process.exit(1);
    }
    
    console.log('Token is valid');
    console.log('User ID:', decoded.id);
    
    // 2. Get the user from the database
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      console.log('User not found in database');
      process.exit(1);
    }
    
    console.log(`\nUser details:`);
    console.log(`  Name: ${user.name}`);
    console.log(`  Email: ${user.email}`);
    console.log(`  Role: ${user.role}`);
    console.log(`  Active: ${user.isActive ? 'Yes' : 'No'}`);
    
    // 3. Get the role permissions
    const role = await Role.findOne({ name: user.role });
    
    if (!role) {
      console.log(`\nWARNING: Role '${user.role}' not found in database!`);
      console.log('This user has an invalid role. Please fix this in the database.');
      process.exit(1);
    }
    
    console.log(`\nRole '${role.name}' has ${role.permissions.length} permissions:`);
    
    // 4. Check if role has inventory permissions
    const hasInventoryView = role.permissions.includes(PERMISSIONS.INVENTORY_VIEW);
    const hasInventoryEdit = role.permissions.includes(PERMISSIONS.INVENTORY_EDIT);
    
    console.log(`  Inventory View permission: ${hasInventoryView ? 'Yes' : 'No'}`);
    console.log(`  Inventory Edit permission: ${hasInventoryEdit ? 'Yes' : 'No'}`);
    
    if (!hasInventoryView || !hasInventoryEdit) {
      console.log('\nWARNING: User is missing essential inventory permissions!');
      console.log('Please update the role permissions using updateRolePermissions.js');
    } else {
      console.log('\nUser has proper inventory permissions');
    }
    
    // 5. Generate a new token for the user (for testing)
    const newToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: '30d',
    });
    
    console.log('\n===== SOLUTION =====');
    console.log('1. Log out from the frontend application');
    console.log('2. Clear your browser cache and cookies');
    console.log('3. Log in again with your credentials');
    console.log('\nAlternatively, you can use this fresh token for testing (valid for 30 days):');
    console.log(newToken);
    
    process.exit(0);
  } catch (err) {
    console.error('Error verifying user:', err);
    process.exit(1);
  }
};

verifyLoggedInUser(); 