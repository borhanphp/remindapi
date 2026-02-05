const mongoose = require('mongoose');
const User = require('./models/User');
const OrganizationMembership = require('./models/OrganizationMembership');
const Organization = require('./models/Organization');
const Role = require('./models/Role');
require('dotenv').config();

const inspect = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');

        // Find the most recent user
        const user = await User.findOne().sort({ createdAt: -1 });

        if (!user) {
            console.log('No users found.');
            return;
        }

        console.log('--- Latest User ---');
        console.log('ID:', user._id);
        console.log('Name:', user.name);
        console.log('Email:', user.email);
        console.log('Org ID:', user.organization);
        console.log('Role ID:', user.role);

        // Find memberships
        const memberships = await OrganizationMembership.find({ user: user._id });
        console.log('\n--- Memberships ---');
        console.log('Count:', memberships.length);
        memberships.forEach(m => {
            console.log('Membership:', m);
        });

        // Check Organization
        if (user.organization) {
            const org = await Organization.findById(user.organization);
            console.log('\n--- Organization ---');
            console.log('Org:', org);
        }

    } catch (error) {
        console.error(error);
    } finally {
        await mongoose.disconnect();
    }
};

inspect();
