/**
 * Script to update existing stock alerts with organization field, priority, and status history
 * Run this once to fix old data
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
const StockAlertSchema = new mongoose.Schema({
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization'
  },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  warehouse: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Warehouse',
    required: true
  },
  currentQuantity: Number,
  reorderLevel: Number,
  priority: String,
  status: String,
  statusHistory: Array
}, { timestamps: true, strict: false });

const WarehouseSchema = new mongoose.Schema({
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  }
}, { timestamps: true, strict: false });

const ProductSchema = new mongoose.Schema({
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization'
  }
}, { timestamps: true, strict: false });

const StockAlert = mongoose.model('StockAlert', StockAlertSchema);
const Warehouse = mongoose.model('Warehouse', WarehouseSchema);
const Product = mongoose.model('Product', ProductSchema);

async function updateStockAlerts() {
  try {
    console.log('Starting stock alert updates...');
    
    // Find all stock alerts needing updates
    const alerts = await StockAlert.find({
      $or: [
        { organization: { $exists: false } },
        { organization: null },
        { priority: { $exists: false } },
        { statusHistory: { $exists: false } },
        { statusHistory: { $size: 0 } }
      ]
    }).populate('warehouse').populate('product');
    
    console.log(`Found ${alerts.length} stock alerts to update`);
    
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const alert of alerts) {
      try {
        let organizationId = null;
        const updateData = {};
        
        // Try to get organization from warehouse
        if (alert.warehouse?.organization) {
          organizationId = alert.warehouse.organization;
          console.log(`Using warehouse org for alert ${alert._id}`);
        }
        // Try to get organization from product
        else if (alert.product?.organization) {
          organizationId = alert.product.organization;
          console.log(`Using product org for alert ${alert._id}`);
        }
        
        // Add organization if found
        if (organizationId) {
          updateData.organization = organizationId;
        }
        
        // Calculate and add priority if missing
        if (!alert.priority) {
          const stockPercentage = (alert.currentQuantity / alert.reorderLevel) * 100;
          
          if (stockPercentage <= 0) {
            updateData.priority = 'critical';
          } else if (stockPercentage <= 25) {
            updateData.priority = 'high';
          } else if (stockPercentage <= 50) {
            updateData.priority = 'medium';
          } else {
            updateData.priority = 'low';
          }
        }
        
        // Add status history if missing
        if (!alert.statusHistory || alert.statusHistory.length === 0) {
          updateData.statusHistory = [{
            status: alert.status || 'new',
            updatedAt: alert.createdAt || new Date(),
            notes: 'Initial status'
          }];
          
          // If acknowledged, add entry
          if (alert.status === 'acknowledged' && alert.acknowledgedBy) {
            updateData.statusHistory.push({
              status: 'acknowledged',
              updatedBy: alert.acknowledgedBy,
              updatedAt: alert.acknowledgedAt || new Date(),
              notes: 'Alert acknowledged'
            });
          }
          
          // If resolved, add entry
          if (alert.status === 'resolved' && alert.resolvedBy) {
            updateData.statusHistory.push({
              status: 'resolved',
              updatedBy: alert.resolvedBy,
              updatedAt: alert.resolvedAt || new Date(),
              notes: 'Alert resolved'
            });
          }
        }
        
        // Update if we have changes
        if (Object.keys(updateData).length > 0) {
          await StockAlert.updateOne(
            { _id: alert._id },
            { $set: updateData }
          );
          updated++;
          console.log(`✓ Updated alert ${alert._id} with:`, Object.keys(updateData).join(', '));
        } else {
          skipped++;
          console.log(`⚠ Skipped alert ${alert._id} - no updates needed`);
        }
      } catch (error) {
        errors++;
        console.error(`✗ Error updating alert ${alert._id}:`, error.message);
      }
    }
    
    console.log('\n=== Summary ===');
    console.log(`Total alerts processed: ${alerts.length}`);
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
updateStockAlerts();

