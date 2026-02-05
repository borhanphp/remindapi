const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Load models
require('../models');

const User = require('../models/User');
const Organization = require('../models/Organization');

async function checkUserOrganizations() {
  try {
    console.log('Checking user organizations...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');
    
    // Get all users with their organizations
    const users = await User.find().populate('organization', 'name');
    console.log(`Found ${users.length} total users`);
    
    console.log('\nUser Organization Status:');
    console.log('========================');
    
    users.forEach(user => {
      const orgName = user.organization ? user.organization.name : 'NO ORGANIZATION';
      const status = user.organization ? '✅' : '❌';
      console.log(`${status} ${user.name} (${user.email}) -> ${orgName}`);
    });
    
    // Check for users without organization
    const usersWithoutOrg = users.filter(user => !user.organization);
    if (usersWithoutOrg.length > 0) {
      console.log(`\n⚠️ Found ${usersWithoutOrg.length} users without organization:`);
      usersWithoutOrg.forEach(user => {
        console.log(`- ${user.name} (${user.email})`);
      });
    } else {
      console.log('\n✅ All users have organizations assigned!');
    }
    
    // Group users by organization
    const usersByOrg = {};
    users.forEach(user => {
      const orgName = user.organization ? user.organization.name : 'NO ORGANIZATION';
      if (!usersByOrg[orgName]) {
        usersByOrg[orgName] = [];
      }
      usersByOrg[orgName].push(user);
    });
    
    console.log('\nUsers by Organization:');
    console.log('=====================');
    Object.keys(usersByOrg).forEach(orgName => {
      console.log(`\n${orgName} (${usersByOrg[orgName].length} users):`);
      usersByOrg[orgName].forEach(user => {
        console.log(`  - ${user.name} (${user.email})`);
      });
    });
    
  } catch (error) {
    console.error('Check failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run check
checkUserOrganizations(); 