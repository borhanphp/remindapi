const mongoose = require('mongoose');
const Product = require('../models/Product');
const Organization = require('../models/Organization');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const categories = ['Electronics', 'Clothing', 'Home & Garden', 'Books', 'Sports', 'Toys'];
const images = [
    'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=500&q=80', // Watch
    'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=500&q=80', // Headphones
    'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=500&q=80', // Shoes
    'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=500&q=80', // Camera
    'https://images.unsplash.com/photo-1491553895911-0055eca6402d?auto=format&fit=crop&w=500&q=80', // Sneakers
    'https://images.unsplash.com/photo-1572635196237-14b3f281503f?auto=format&fit=crop&w=500&q=80', // Sunglasses
    'https://images.unsplash.com/photo-1581235720704-06d3acfcb36f?auto=format&fit=crop&w=500&q=80', // Chair
];

const generateProducts = (orgId) => {
    const products = [];
    for (let i = 1; i <= 100; i++) {
        const category = categories[Math.floor(Math.random() * categories.length)];
        const image = images[Math.floor(Math.random() * images.length)];
        const price = (Math.random() * 1000 + 10).toFixed(2);
        const hasSale = Math.random() > 0.7;

        products.push({
            organization: orgId, // Assign to organization
            name: `Premium ${category} Item ${i}`,
            sku: `SKU-DUMMY-${i}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
            description: `This is a high-quality description for product ${i}. It creates a premium feel for the ${category} category. Perfect for your needs.`,
            category: category,
            brand: 'ViroxBrand',
            price: parseFloat(price),
            costPrice: parseFloat((price * 0.6).toFixed(2)),
            quantity: Math.floor(Math.random() * 100),
            images: [{ url: image, isPrimary: true }],
            isActive: true,
            // Randomly assign sale price to some items
            // schema doesn't seem to explicitly have salePrice in root, 
            // but based on HomeScreen code `item.salePrice` was used.
            // Checking Schema... It DOES NOT have salePrice. 
            // Wait, the Schema I read:
            // price: { type: Number, ... }
            // It does NOT have salePrice.
            // However, the HomeScreen logic uses it.
            // I will put it in attributes or just rely on price for now, 
            // OR I should double check if I missed it? 
            // Re-reading Step 169...
            // It has `price`, `costPrice`, `tax`... No `salePrice`.
            // The mobile app might be using a transformed field or I missed it.
            // Ah, the mobile app code: `item.salePrice || item.price`.
            // If the backend doesn't support it, the mobile app won't show "SALE".
            // I'll stick to 'price'.
            unit: 'piece',
            tags: ['dummy', category.toLowerCase()]
        });
    }
    return products;
};

const seedDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/crm_db');
        console.log('Connected to MongoDB');

        // Find an organization
        let org = await Organization.findOne();

        // Create default org if not exists (fallback)
        if (!org) {
            console.log('No organization found. Creating default one...');
            org = await Organization.create({
                name: 'Default Org',
                slug: 'default-org',
                email: 'admin@example.com'
            });
        }
        console.log(`Seeding products for Organization: ${org.name} (${org._id})`);

        // Optional: Clear existing dummy products for this org
        await Product.deleteMany({ sku: { $regex: /^SKU-DUMMY-/ }, organization: org._id });
        console.log('Cleared old dummy products');

        const products = generateProducts(org._id);
        await Product.insertMany(products);

        console.log(`Successfully seeded ${products.length} products!`);
        process.exit(0);
    } catch (err) {
        console.error('Seeding failed:', err);
        process.exit(1);
    }
};

seedDB();
