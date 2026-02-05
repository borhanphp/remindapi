/**
 * Script to update existing stock adjustments with organization field
 * Run this once to fix old data that doesn't have the organization field
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/zeeventory')
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// Define schemas (simplified versions)
const StockAdjustmentSchema = new mongoose.Schema({
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization'
  },
  warehouse: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Warehouse',
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, { timestamps: true, strict: false });

const WarehouseSchema = new mongoose.Schema({
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  }
}, { timestamps: true, strict: false });

const UserSchema = new mongoose.Schema({
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization'
  }
}, { timestamps: true, strict: false });

const StockAdjustment = mongoose.model('StockAdjustment', StockAdjustmentSchema);
const Warehouse = mongoose.model('Warehouse', WarehouseSchema);
const User = mongoose.model('User', UserSchema);

async function updateStockAdjustments() {
  try {
    console.log('Starting stock adjustment updates...');
    
    // Find all stock adjustments without organization field
    const adjustments = await StockAdjustment.find({
      $or: [
        { organization: { $exists: false } },
        { organization: null }
      ]
    }).populate('warehouse').populate('createdBy');
    
    console.log(`Found ${adjustments.length} stock adjustments without organization`);
    
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const adjustment of adjustments) {
      try {
        let organizationId = null;
        
        // Try to get organization from warehouse
        if (adjustment.warehouse?.organization) {
          organizationId = adjustment.warehouse.organization;
          console.log(`Using warehouse org for adjustment ${adjustment._id}`);
        }
        // Try to get organization from createdBy user
        else if (adjustment.createdBy?.organization) {
          organizationId = adjustment.createdBy.organization;
          console.log(`Using user org for adjustment ${adjustment._id}`);
        }
        
        if (organizationId) {
          await StockAdjustment.updateOne(
            { _id: adjustment._id },
            { $set: { organization: organizationId } }
          );
          updated++;
          console.log(`✓ Updated adjustment ${adjustment._id} with organization ${organizationId}`);
        } else {
          skipped++;
          console.log(`⚠ Skipped adjustment ${adjustment._id} - no organization found`);
        }
      } catch (error) {
        errors++;
        console.error(`✗ Error updating adjustment ${adjustment._id}:`, error.message);
      }
    }
    
    console.log('\n=== Summary ===');
    console.log(`Total adjustments processed: ${adjustments.length}`);
    console.log(`Successfully updated: ${updated}`);
    console.log(`Skipped (no org found): ${skipped}`);
    console.log(`Errors: ${errors}`);
    
    console.log('\nClosing database connection...');
    await mongoose.connection.close();
    console.log('Done!');
    process.exit(0);
  } catch (error) {
    console.error('Fatal error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Run the update
updateStockAdjustments();

