const mongoose = require('mongoose');
const Product = require('./models/Product');
const InventoryBalance = require('./models/InventoryBalance');
const StockAlert = require('./models/StockAlert');
const dotenv = require('dotenv');

dotenv.config();

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI);
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
};

const debugStock = async () => {
    await connectDB();

    try {
        console.log('--- Checking Products and Inventory ---');

        // Get first 5 products with reorderLevel
        const products = await Product.find({
            reorderLevel: { $exists: true, $gt: 0 }
        }).limit(5);

        if (products.length === 0) {
            console.log('No products found with reorderLevel > 0');
            return;
        }

        console.log(`Found ${products.length} products with reorder levels.`);

        for (const product of products) {
            console.log(`\nProduct: ${product.name} (ID: ${product._id})`);
            console.log(`  Reorder Level: ${product.reorderLevel}`);

            // Check Inventory Balances
            const balances = await InventoryBalance.find({ product: product._id });
            console.log(`  Inventory Balances Found: ${balances.length}`);

            if (balances.length === 0) {
                console.log('  -> NO INVENTORY RECORDS FOUND (Default quantity 0)');
            }

            for (const bal of balances) {
                console.log(`    Warehouse: ${bal.warehouse}, Quantity: ${bal.quantity}`);
            }

            // Check Alerts
            const alerts = await StockAlert.find({ product: product._id });
            console.log(`  Stock Alerts Found: ${alerts.length}`);
            for (const alert of alerts) {
                console.log(`    Status: ${alert.status}, Priority: ${alert.priority}, CurrentQty: ${alert.currentQuantity}`);
            }
        }

    } catch (error) {
        console.error('Debug script error:', error);
    } finally {
        await mongoose.disconnect();
        process.exit();
    }
};

debugStock();
