const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Role = require('../models/Role');
const Organization = require('../models/Organization');
const OrganizationMembership = require('../models/OrganizationMembership'); // Add this!
const dotenv = require('dotenv');

dotenv.config();

const seedAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/inventory');
        console.log('✅ Connected to MongoDB');

        // 1. Ensure Organization
        let org = await Organization.findOne({ slug: 'admin-org' });
        if (!org) {
            org = await Organization.create({
                name: 'Admin Organization',
                slug: 'admin-org',
                email: 'admin@inventory.com',
                subscription: { plan: 'enterprise', status: 'active' },
                modules: ['inventory', 'crm', 'hrm', 'accounting', 'projects']
            });
            console.log('✅ Created Organization');
        } else {
            console.log('✅ Found Organization');
        }

        // 2. Ensure Role
        let role = await Role.findOne({ name: 'super admin', organization: org._id });
        if (!role) {
            role = await Role.create({
                name: 'super admin',
                organization: org._id,
                permissions: [
                    'inventory:view', 'inventory:create', 'inventory:edit', 'inventory:delete',
                    'users:view', 'users:create', 'users:edit', 'users:delete',
                    'roles:view', 'roles:create', 'roles:edit', 'roles:delete'
                ],
                isCustom: false
            });
            console.log('✅ Created Super Admin Role');
        } else {
            console.log('✅ Found Super Admin Role');
        }

        // 3. Create/Update Admin User
        const email = 'admin@inventory.com';
        const password = 'admin123';

        let user = await User.findOne({ email });

        if (user) {
            user.password = password;
            user.organization = org._id;
            user.role = role._id;
            user.isSuperAdmin = true;
            user.isActive = true;
            user.isEmailVerified = true;
            await user.save();
            console.log('✅ Updated Admin User Password & Verification');
        } else {
            user = await User.create({
                name: 'Admin User',
                email,
                password,
                organization: org._id,
                role: role._id,
                isSuperAdmin: true,
                isActive: true,
                isEmailVerified: true
            });
            console.log('✅ Created Admin User');
        }

        // 4. Ensure Organization Membership (CRITICAL FIX)
        let membership = await OrganizationMembership.findOne({
            user: user._id,
            organization: org._id
        });

        if (!membership) {
            await OrganizationMembership.create({
                user: user._id,
                organization: org._id,
                role: role._id,
                status: 'active',
                isActive: true,
                joinedAt: new Date()
            });
            console.log('✅ Created Organization Membership');
        } else {
            // Update role if changed
            membership.role = role._id;
            membership.isActive = true;
            await membership.save();
            console.log('✅ Updated Organization Membership');
        }

        console.log('🎉 Seeding complete. Credentials: admin@inventory.com / admin123');
        process.exit(0);
    } catch (error) {
        console.error('❌ Seeding failed:', error);
        process.exit(1);
    }
};

seedAdmin();
