const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Import models
const User = require('../models/User');
const Role = require('../models/Role');
const Product = require('../models/Product');
const Category = require('../models/Category');
const Warehouse = require('../models/Warehouse');

// Import permissions
const { PERMISSIONS } = require('./permissions');
const { ROLE_PERMISSIONS } = require('./rolePermissions');

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB Connected...');
  } catch (err) {
    console.error('Database connection error:', err.message);
    process.exit(1);
  }
};

// Create default roles
const seedRoles = async () => {
  try {
    // Clear existing roles
    await Role.deleteMany({});
    console.log('Roles collection cleared');

    // Create default system roles
    const roles = [
      {
        name: 'admin',
        description: 'Full system access',
        permissions: ROLE_PERMISSIONS.admin,
        isCustom: false
      },
      {
        name: 'manager',
        description: 'Manage inventory, sales, and purchases',
        permissions: ROLE_PERMISSIONS.manager,
        isCustom: false
      },
      {
        name: 'accountant',
        description: 'Manage financial aspects',
        permissions: ROLE_PERMISSIONS.accountant,
        isCustom: false
      },
      {
        name: 'salesperson',
        description: 'Manage sales and view inventory',
        permissions: ROLE_PERMISSIONS.salesperson,
        isCustom: false
      },
      {
        name: 'staff',
        description: 'Basic staff access',
        permissions: ROLE_PERMISSIONS.staff,
        isCustom: false
      },
      {
        name: 'user',
        description: 'Standard User (SaaS)',
        permissions: ROLE_PERMISSIONS.user,
        isCustom: false
      }
    ];

    await Role.insertMany(roles);
    console.log('Default roles created successfully');
  } catch (error) {
    console.error('Error seeding roles:', error);
  }
};

// Create default admin user
const seedUsers = async () => {
  try {
    // Clear existing users
    await User.deleteMany({});
    console.log('Users collection cleared');

    // Get admin role
    const adminRole = await Role.findOne({ name: 'admin' });

    if (!adminRole) {
      throw new Error('Admin role not found. Run role seeder first.');
    }

    // Create a default admin user
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('admin123', salt);

    await User.create({
      name: 'Admin User',
      email: 'admin@example.com',
      password: hashedPassword,
      role: adminRole._id,
      isActive: true
    });

    console.log('Default admin user created successfully');
  } catch (error) {
    console.error('Error seeding users:', error);
  }
};

// Create default categories
const seedCategories = async () => {
  try {
    const Category = require('../models/Category');

    // Clear existing categories
    await Category.deleteMany({});
    console.log('Categories collection cleared');

    // Create default categories
    const categories = [
      { name: 'Electronics', description: 'Electronic devices and accessories' },
      { name: 'Clothing', description: 'Apparel and fashion items' },
      { name: 'Home & Kitchen', description: 'Home appliances and kitchenware' },
      { name: 'Office Supplies', description: 'Office equipment and stationery' },
      { name: 'Sports & Outdoors', description: 'Sporting goods and outdoor equipment' }
    ];

    await Category.insertMany(categories);
    console.log('Default categories created successfully');
  } catch (error) {
    console.error('Error seeding categories:', error);
  }
};

// Create default warehouse
const seedWarehouses = async () => {
  try {
    // Clear existing warehouses
    await Warehouse.deleteMany({});
    console.log('Warehouses collection cleared');

    // Create default warehouse
    await Warehouse.create({
      name: 'Main Warehouse',
      location: 'Headquarters',
      address: '123 Main Street, City',
      isDefault: true
    });

    console.log('Default warehouse created successfully');
  } catch (error) {
    console.error('Error seeding warehouses:', error);
  }
};

// Create sample products
const seedProducts = async () => {
  try {
    // Clear existing products
    await Product.deleteMany({});
    console.log('Products collection cleared');

    // Get categories and warehouse
    const categories = await Category.find();
    const warehouse = await Warehouse.findOne({ isDefault: true });

    if (!categories.length || !warehouse) {
      throw new Error('Categories or default warehouse not found. Run those seeders first.');
    }

    // Create sample products
    const products = [
      {
        name: 'Laptop',
        sku: 'ELEC-001',
        description: 'High performance laptop',
        category: categories.find(c => c.name === 'Electronics')._id,
        price: 1200,
        cost: 900,
        quantity: 50,
        warehouse: warehouse._id,
        minStock: 10,
        isActive: true
      },
      {
        name: 'T-Shirt',
        sku: 'CLO-001',
        description: 'Cotton t-shirt',
        category: categories.find(c => c.name === 'Clothing')._id,
        price: 25,
        cost: 10,
        quantity: 100,
        warehouse: warehouse._id,
        minStock: 20,
        isActive: true
      },
      {
        name: 'Coffee Maker',
        sku: 'HK-001',
        description: 'Automatic coffee maker',
        category: categories.find(c => c.name === 'Home & Kitchen')._id,
        price: 89.99,
        cost: 45,
        quantity: 30,
        warehouse: warehouse._id,
        minStock: 5,
        isActive: true
      },
      {
        name: 'Notebook',
        sku: 'OFF-001',
        description: 'Premium notebook',
        category: categories.find(c => c.name === 'Office Supplies')._id,
        price: 12.99,
        cost: 5,
        quantity: 200,
        warehouse: warehouse._id,
        minStock: 50,
        isActive: true
      },
      {
        name: 'Yoga Mat',
        sku: 'SPO-001',
        description: 'Non-slip yoga mat',
        category: categories.find(c => c.name === 'Sports & Outdoors')._id,
        price: 35.99,
        cost: 18,
        quantity: 75,
        warehouse: warehouse._id,
        minStock: 15,
        isActive: true
      }
    ];

    await Product.insertMany(products);
    console.log('Sample products created successfully');
  } catch (error) {
    console.error('Error seeding products:', error);
  }
};

// Run all seeders
const seedAllData = async () => {
  try {
    await connectDB();

    await seedRoles();
    await seedUsers();
    await seedCategories();
    await seedWarehouses();
    await seedProducts();

    console.log('All data seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error in seeding process:', error);
    process.exit(1);
  }
};

// Run specific seeder
const runSpecificSeeder = async (seederName) => {
  try {
    await connectDB();

    switch (seederName) {
      case 'roles':
        await seedRoles();
        break;
      case 'users':
        await seedUsers();
        break;
      case 'categories':
        await seedCategories();
        break;
      case 'warehouses':
        await seedWarehouses();
        break;
      case 'products':
        await seedProducts();
        break;
      default:
        console.log('Invalid seeder name. Available seeders: roles, users, categories, warehouses, products');
    }

    process.exit(0);
  } catch (error) {
    console.error(`Error running ${seederName} seeder:`, error);
    process.exit(1);
  }
};

// Check if a specific seeder is requested
if (process.argv[2]) {
  runSpecificSeeder(process.argv[2]);
} else {
  seedAllData();
} 