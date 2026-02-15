/**
 * Script to create a Pro user with organization
 * Run: node scripts/createProUser.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Organization = require('../models/Organization');
const Role = require('../models/Role');
const Subscription = require('../models/Subscription');

async function createProUser() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        // Find or create a default role
        let role = await Role.findOne({ name: { $regex: /admin/i } });
        if (!role) {
            role = await Role.findOne({});
        }
        if (!role) {
            console.log('No roles found. Creating a default admin role...');
            role = await Role.create({
                name: 'Admin',
                permissions: ['all'],
                description: 'Full access admin role'
            });
        }
        console.log('Using role:', role.name, role._id);

        // Create Organization with Pro subscription
        const org = await Organization.create({
            name: 'Pro Test Company',
            slug: 'pro-test-company-' + Date.now(),
            approvalStatus: 'approved',
            subscription: {
                plan: 'pro',
                status: 'active'
            },
            features: {
                maxInvoices: -1, // unlimited for pro
                emailReminders: true,
                smsReminders: true,
                whatsappReminders: true,
                basicReporting: true,
                automatedSchedule: true,
                prioritySupport: true,
                removeBranding: true
            }
        });
        console.log('Organization created:', org.name, org._id);

        // Create Pro User
        const user = await User.create({
            name: 'Pro Test User',
            email: 'pro@test.com',
            password: 'ProTest123',
            role: role._id,
            organization: org._id,
            organizationRole: 'owner',
            isOwner: true,
            isActive: true,
            isEmailVerified: true,
            plan: 'pro',
            subscriptionStatus: 'active'
        });
        console.log('User created:', user.name, user.email, user._id);

        console.log('\n✅ Pro user and organization created successfully!');
        console.log('─────────────────────────────────');
        console.log('Email:    pro@test.com');
        console.log('Password: ProTest123');
        console.log('Plan:     Pro (unlimited invoices)');
        console.log('Org:      Pro Test Company');
        console.log('─────────────────────────────────');

        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        if (error.code === 11000) {
            console.log('\nUser or org already exists. Try deleting first or use a different email.');
        }
        process.exit(1);
    }
}

createProUser();
