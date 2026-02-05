const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Load models
require('../models');

const User = require('../models/User');
const Organization = require('../models/Organization');

async function fixUserOrganizations() {
  try {
    console.log('Starting user organization fix...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');
    
    // Get all organizations
    const organizations = await Organization.find();
    console.log(`Found ${organizations.length} organizations`);
    
    // Get all users without organization
    const usersWithoutOrg = await User.find({ organization: { $exists: false } });
    console.log(`Found ${usersWithoutOrg.length} users without organization`);
    
    if (usersWithoutOrg.length === 0) {
      console.log('No users need organization assignment');
      return;
    }
    
    // For each user, assign them to the first organization (or create a default one)
    let defaultOrg = organizations[0];
    
    if (!defaultOrg) {
      console.log('No organizations found, creating default organization...');
      defaultOrg = await Organization.create({
        name: 'Default Organization',
        description: 'Default organization for migrated users'
      });
      console.log(`Created default organization: ${defaultOrg.name}`);
    }
    
    // Update all users without organization
    const updateResult = await User.updateMany(
      { organization: { $exists: false } },
      { organization: defaultOrg._id }
    );
    
    console.log(`Updated ${updateResult.modifiedCount} users with organization: ${defaultOrg.name}`);
    
    // Verify migration
    const remainingUsersWithoutOrg = await User.find({ organization: { $exists: false } });
    console.log(`Users without organization after migration: ${remainingUsersWithoutOrg.length}`);
    
    if (remainingUsersWithoutOrg.length === 0) {
      console.log('✅ User organization fix completed successfully!');
    } else {
      console.log('⚠️ Some users still lack organization');
    }
    
    // Show updated users
    const updatedUsers = await User.find({ organization: defaultOrg._id }).select('name email organization');
    console.log('\nUpdated users:');
    updatedUsers.forEach(user => {
      console.log(`- ${user.name} (${user.email}) -> ${defaultOrg.name}`);
    });
    
  } catch (error) {
    console.error('Fix failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run fix
fixUserOrganizations(); 