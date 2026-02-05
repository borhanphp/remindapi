const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Product = require('../models/Product');
const Warehouse = require('../models/Warehouse');
const StockAlert = require('../models/StockAlert');
const User = require('../models/User');
const Organization = require('../models/Organization');

// Load environment variables
dotenv.config();

const migrateToMultiTenancy = async () => {
  try {
    console.log('Starting multi-tenancy migration...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB');

    // Get all organizations
    const organizations = await Organization.find();
    console.log(`Found ${organizations.length} organizations`);

    if (organizations.length === 0) {
      console.log('No organizations found. Creating a default organization...');
      
      // Create a default organization for existing data
      const defaultOrg = await Organization.create({
        name: 'Default Organization',
        slug: 'default-organization',
        subscription: {
          plan: 'free',
          status: 'trial',
          trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
        }
      });
      
      console.log('Created default organization:', defaultOrg._id);
      
      // Update all users without organization to use the default organization
      const usersWithoutOrg = await User.find({ organization: { $exists: false } });
      console.log(`Found ${usersWithoutOrg.length} users without organization`);
      
      for (const user of usersWithoutOrg) {
        user.organization = defaultOrg._id;
        await user.save();
        console.log(`Updated user ${user.email} to use default organization`);
      }
      
      organizations.push(defaultOrg);
    }

    // For each organization, migrate their data
    for (const org of organizations) {
      console.log(`\nMigrating data for organization: ${org.name} (${org._id})`);
      
      // Get users in this organization
      const orgUsers = await User.find({ organization: org._id });
      console.log(`Found ${orgUsers.length} users in organization`);
      
      // Migrate products
      const productsWithoutOrg = await Product.find({ organization: { $exists: false } });
      console.log(`Found ${productsWithoutOrg.length} products without organization`);
      
      if (productsWithoutOrg.length > 0) {
        // Assign products to the first organization (or create them for each org if needed)
        for (const product of productsWithoutOrg) {
          product.organization = org._id;
          await product.save();
          console.log(`Updated product ${product.name} to use organization ${org.name}`);
        }
      }
      
      // Migrate warehouses
      const warehousesWithoutOrg = await Warehouse.find({ organization: { $exists: false } });
      console.log(`Found ${warehousesWithoutOrg.length} warehouses without organization`);
      
      if (warehousesWithoutOrg.length > 0) {
        for (const warehouse of warehousesWithoutOrg) {
          warehouse.organization = org._id;
          await warehouse.save();
          console.log(`Updated warehouse ${warehouse.name} to use organization ${org.name}`);
        }
      }
      
      // Migrate stock alerts
      const alertsWithoutOrg = await StockAlert.find({ organization: { $exists: false } });
      console.log(`Found ${alertsWithoutOrg.length} stock alerts without organization`);
      
      if (alertsWithoutOrg.length > 0) {
        for (const alert of alertsWithoutOrg) {
          alert.organization = org._id;
          await alert.save();
          console.log(`Updated stock alert for product ${alert.product} to use organization ${org.name}`);
        }
      }
    }

    // Verify migration
    console.log('\nVerifying migration...');
    
    const productsWithoutOrg = await Product.find({ organization: { $exists: false } });
    const warehousesWithoutOrg = await Warehouse.find({ organization: { $exists: false } });
    const alertsWithoutOrg = await StockAlert.find({ organization: { $exists: false } });
    
    console.log(`Products without organization: ${productsWithoutOrg.length}`);
    console.log(`Warehouses without organization: ${warehousesWithoutOrg.length}`);
    console.log(`Stock alerts without organization: ${alertsWithoutOrg.length}`);
    
    if (productsWithoutOrg.length === 0 && warehousesWithoutOrg.length === 0 && alertsWithoutOrg.length === 0) {
      console.log('✅ Migration completed successfully!');
    } else {
      console.log('⚠️  Some data still needs organization assignment');
    }

  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
};

// Run migration if this script is executed directly
if (require.main === module) {
  migrateToMultiTenancy();
}

module.exports = migrateToMultiTenancy; 