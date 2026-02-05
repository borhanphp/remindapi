const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Role = require('../models/Role');
const { PERMISSIONS } = require('../utils/permissions');
const { ROLE_PERMISSIONS } = require('../utils/rolePermissions');

// Load env vars
dotenv.config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const updateRolePermissions = async () => {
  try {
    console.log('Starting role permissions update...');
    
    // Update built-in roles
    for (const [roleName, permissions] of Object.entries(ROLE_PERMISSIONS)) {
      console.log(`Updating ${roleName} role...`);
      
      // Find or create role
      let role = await Role.findOne({ name: roleName });
      
      if (!role) {
        console.log(`Creating new ${roleName} role...`);
        role = new Role({ name: roleName });
      }
      
      // Update permissions
      role.permissions = permissions;
      await role.save();
      
      console.log(`${roleName} role updated with ${permissions.length} permissions`);
    }
    
    console.log('Role permissions update completed successfully');
  } catch (error) {
    console.error('Error updating role permissions:', error);
  } finally {
    mongoose.disconnect();
  }
};

// Run the update
updateRolePermissions(); 