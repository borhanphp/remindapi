const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Load models
require('../models');

// List of models that need organization fields
const modelsToUpdate = [
  'PurchaseReceipt',
  'SaleInvoice', 
  'PurchaseInvoice',
  'GoodsReceivedNote',
  'PurchaseRequisition',
  'StockTransfer',
  'StockAdjustment',
  'InventoryTransaction',
  'SalePayment',
  'Invoice',
  'Payment',
  'Quotation',
  'SaleReturn',
  'Delivery'
];

const addOrganizationToModels = async () => {
  try {
    console.log('Starting to add organization fields to all models...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB');

    // Get all organizations
    const Organization = mongoose.model('Organization');
    const organizations = await Organization.find();
    
    if (organizations.length === 0) {
      console.log('No organizations found. Creating a default organization...');
      const defaultOrg = await Organization.create({
        name: 'Default Organization',
        slug: 'default-organization',
        subscription: {
          plan: 'free',
          status: 'trial',
          trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
        }
      });
      organizations.push(defaultOrg);
    }

    const defaultOrg = organizations[0];
    console.log(`Using organization: ${defaultOrg.name} (${defaultOrg._id})`);

    // Update each model
    for (const modelName of modelsToUpdate) {
      try {
        const Model = mongoose.model(modelName);
        console.log(`\nProcessing ${modelName}...`);
        
        // Find documents without organization field
        const docsWithoutOrg = await Model.find({ organization: { $exists: false } });
        console.log(`Found ${docsWithoutOrg.length} ${modelName} documents without organization`);
        
        if (docsWithoutOrg.length > 0) {
          // Update all documents to have the default organization
          const result = await Model.updateMany(
            { organization: { $exists: false } },
            { $set: { organization: defaultOrg._id } }
          );
          console.log(`Updated ${result.modifiedCount} ${modelName} documents`);
        }
        
      } catch (error) {
        console.error(`Error processing ${modelName}:`, error.message);
      }
    }

    console.log('\n✅ Organization field addition completed!');

  } catch (error) {
    console.error('Script failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
};

// Run script if executed directly
if (require.main === module) {
  addOrganizationToModels();
}

module.exports = addOrganizationToModels; 