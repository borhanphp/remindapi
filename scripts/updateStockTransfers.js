/**
 * Script to update existing stock transfers with organization field and status history
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
const StockTransferSchema = new mongoose.Schema({
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization'
  },
  sourceWarehouse: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Warehouse',
    required: true
  },
  destinationWarehouse: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Warehouse',
    required: true
  },
  status: String,
  statusHistory: Array,
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

const StockTransfer = mongoose.model('StockTransfer', StockTransferSchema);
const Warehouse = mongoose.model('Warehouse', WarehouseSchema);
const User = mongoose.model('User', UserSchema);

async function updateStockTransfers() {
  try {
    console.log('Starting stock transfer updates...');
    
    // Find all stock transfers without organization field or status history
    const transfers = await StockTransfer.find({
      $or: [
        { organization: { $exists: false } },
        { organization: null },
        { statusHistory: { $exists: false } },
        { statusHistory: { $size: 0 } }
      ]
    }).populate('sourceWarehouse').populate('destinationWarehouse').populate('createdBy');
    
    console.log(`Found ${transfers.length} stock transfers to update`);
    
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const transfer of transfers) {
      try {
        let organizationId = null;
        const updateData = {};
        
        // Try to get organization from source warehouse
        if (transfer.sourceWarehouse?.organization) {
          organizationId = transfer.sourceWarehouse.organization;
          console.log(`Using source warehouse org for transfer ${transfer._id}`);
        }
        // Try to get organization from destination warehouse
        else if (transfer.destinationWarehouse?.organization) {
          organizationId = transfer.destinationWarehouse.organization;
          console.log(`Using destination warehouse org for transfer ${transfer._id}`);
        }
        // Try to get organization from createdBy user
        else if (transfer.createdBy?.organization) {
          organizationId = transfer.createdBy.organization;
          console.log(`Using user org for transfer ${transfer._id}`);
        }
        
        // Add organization if found
        if (organizationId) {
          updateData.organization = organizationId;
        }
        
        // Add status history if missing
        if (!transfer.statusHistory || transfer.statusHistory.length === 0) {
          updateData.statusHistory = [{
            status: transfer.status || 'pending',
            updatedBy: transfer.createdBy?._id,
            updatedAt: transfer.createdAt || new Date(),
            notes: 'Initial status'
          }];
          
          // If completed, add completion entry
          if (transfer.status === 'completed' && transfer.completedBy) {
            updateData.statusHistory.push({
              status: 'completed',
              updatedBy: transfer.completedBy,
              updatedAt: transfer.completedAt || transfer.updatedAt || new Date(),
              notes: 'Transfer completed'
            });
          }
        }
        
        // Update if we have changes
        if (Object.keys(updateData).length > 0) {
          await StockTransfer.updateOne(
            { _id: transfer._id },
            { $set: updateData }
          );
          updated++;
          console.log(`✓ Updated transfer ${transfer._id} with:`, Object.keys(updateData).join(', '));
        } else {
          skipped++;
          console.log(`⚠ Skipped transfer ${transfer._id} - no updates needed`);
        }
      } catch (error) {
        errors++;
        console.error(`✗ Error updating transfer ${transfer._id}:`, error.message);
      }
    }
    
    console.log('\n=== Summary ===');
    console.log(`Total transfers processed: ${transfers.length}`);
    console.log(`Successfully updated: ${updated}`);
    console.log(`Skipped (no updates needed): ${skipped}`);
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
updateStockTransfers();

