/**
 * Quick script to manually upgrade a user to Pro in the database.
 * 
 * Usage: node fix-subscription.js <user-email>
 * 
 * Run from the invoice-reminder-api directory.
 */
require('dotenv').config();
const mongoose = require('mongoose');

async function fixSubscription() {
    const email = process.argv[2];
    if (!email) {
        console.log('Usage: node fix-subscription.js <user-email>');
        process.exit(1);
    }

    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const User = require('./models/User');
        const Organization = require('./models/Organization');
        const Subscription = require('./models/Subscription');

        // Find user
        const user = await User.findOne({ email });
        if (!user) {
            console.error(`User not found: ${email}`);
            process.exit(1);
        }
        console.log(`Found user: ${user.email} (ID: ${user._id})`);
        console.log(`Current plan: ${user.plan}, Status: ${user.subscriptionStatus}`);
        console.log(`Organization: ${user.organization}`);

        // Update user
        user.plan = 'pro';
        user.subscriptionStatus = 'active';
        await user.save();
        console.log('✓ User updated to Pro');

        // Update organization
        const organization = await Organization.findById(user.organization);
        if (organization) {
            organization.subscription.plan = 'pro';
            organization.subscription.status = 'active';

            // Update features for Pro plan
            const proFeatures = Subscription.plans.pro.features;
            organization.features = {
                maxInvoices: proFeatures.maxInvoices,
                emailReminders: proFeatures.emailReminders,
                basicReporting: proFeatures.basicReporting,
                automatedSchedule: proFeatures.automatedSchedule,
                prioritySupport: proFeatures.prioritySupport,
                removeBranding: proFeatures.removeBranding
            };
            await organization.save();
            console.log('✓ Organization updated to Pro');
        }

        // Create/update subscription record
        await Subscription.findOneAndUpdate(
            { organization: user.organization },
            {
                plan: 'pro',
                status: 'active',
                currentPeriodStart: new Date(),
                currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
                billingCycle: { interval: 'month', frequency: 1 },
                cancelAtPeriodEnd: false
            },
            { upsert: true, new: true }
        );
        console.log('✓ Subscription record created/updated');

        console.log('\n✅ Done! User is now on Pro plan.');
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await mongoose.disconnect();
    }
}

fixSubscription();
