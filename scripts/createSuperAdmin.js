// Script to create a super admin user
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MONGODB_URI = process.env.MONGO_URI;

const userSchema = new mongoose.Schema({
    name: String,
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    isSuperAdmin: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    isEmailVerified: { type: Boolean, default: true },
    role: { type: String, default: 'admin' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

async function createSuperAdmin() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        const email = 'zeesuperadmin@gmail.com';
        const password = '123456789123456789';

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            console.log('User already exists, updating to super admin...');
            existingUser.isSuperAdmin = true;
            existingUser.password = await bcrypt.hash(password, 12);
            await existingUser.save();
            console.log('User updated successfully!');
        } else {
            // Hash password
            const hashedPassword = await bcrypt.hash(password, 12);

            // Create user
            const user = new User({
                name: 'Super Admin',
                email,
                password: hashedPassword,
                isSuperAdmin: true,
                isActive: true,
                isEmailVerified: true
            });

            await user.save();
            console.log('Super admin created successfully!');
        }

        console.log('Email:', email);
        console.log('Password:', password);

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

createSuperAdmin();
