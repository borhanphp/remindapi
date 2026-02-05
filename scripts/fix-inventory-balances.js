const mongoose = require('mongoose');
const Product = require('../models/Product');
const InventoryBalance = require('../models/InventoryBalance');
const Warehouse = require('../models/Warehouse');
const StockAlert = require('../models/StockAlert');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI);
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
};

const fixInventoryBalances = async () => {
    await connectDB();

    try {
        console.log('--- Starting Inventory Balance Fix ---');

        // Get all products
        const products = await Product.find({});
        console.log(`Found ${products.length} products.`);

        let createdCount = 0;
        let skippedCount = 0;

        for (const product of products) {
            if (!product.warehouse) {
                console.log(`Skipping product ${product.name} (no default warehouse assigned)`);
                skippedCount++;
                continue;
            }

            // Check if balance exists
            const existingBalance = await InventoryBalance.findOne({
                product: product._id,
                warehouse: product.warehouse
            });

            if (!existingBalance) {
                console.log(`Creating balance for ${product.name}: Qty ${product.quantity || 0}`);

                await InventoryBalance.create({
                    organization: product.organization,
                    product: product._id,
                    warehouse: product.warehouse,
                    quantity: product.quantity || 0,
                    location: 'Receiving' // Default location
                });
                createdCount++;
            } else {
                // Optional: Sync quantity if needed, but for now just skip if exists
                // console.log(`Balance exists for ${product.name}, skipping.`);
                skippedCount++;
            }
        }

        console.log(`\nResults:`);
        console.log(`Created: ${createdCount}`);
        console.log(`Skipped: ${skippedCount}`);

        // Re-run the alert generation logic (optional, or just waiting for cron)
        console.log('\nYou may need to manually resolve existing false alerts or wait for the next update cycle.');

    } catch (error) {
        console.error('Migration error:', error);
    } finally {
        await mongoose.disconnect();
        process.exit();
    }
};

fixInventoryBalances();
