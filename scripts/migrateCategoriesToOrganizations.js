const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Load models
require('../models');

const Category = require('../models/Category');
const User = require('../models/User');
const Organization = require('../models/Organization');

async function migrateCategoriesToOrganizations() {
  try {
    console.log('Starting category organization migration...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');
    
    // Get all organizations
    const organizations = await Organization.find();
    console.log(`Found ${organizations.length} organizations`);
    
    // Get all categories without organization
    const categoriesWithoutOrg = await Category.find({ organization: { $exists: false } });
    console.log(`Found ${categoriesWithoutOrg.length} categories without organization`);
    
    if (categoriesWithoutOrg.length === 0) {
      console.log('No categories need migration');
      return;
    }
    
    // For each category, assign it to the first organization (or create a default one)
    let defaultOrg = organizations[0];
    
    if (!defaultOrg) {
      console.log('No organizations found, creating default organization...');
      defaultOrg = await Organization.create({
        name: 'Default Organization',
        description: 'Default organization for migrated data'
      });
      console.log(`Created default organization: ${defaultOrg.name}`);
    }
    
    // Update all categories without organization
    const updateResult = await Category.updateMany(
      { organization: { $exists: false } },
      { organization: defaultOrg._id }
    );
    
    console.log(`Updated ${updateResult.modifiedCount} categories with organization: ${defaultOrg.name}`);
    
    // Verify migration
    const remainingCategoriesWithoutOrg = await Category.find({ organization: { $exists: false } });
    console.log(`Categories without organization after migration: ${remainingCategoriesWithoutOrg.length}`);
    
    if (remainingCategoriesWithoutOrg.length === 0) {
      console.log('✅ Category organization migration completed successfully!');
    } else {
      console.log('⚠️ Some categories still lack organization');
    }
    
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run migration
migrateCategoriesToOrganizations(); 