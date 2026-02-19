const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const Organization = require('../models/Organization');
const Subscription = require('../models/Subscription');

// Load env vars
dotenv.config({ path: path.join(__dirname, '../.env') });

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
};

const fixTrialOrganizations = async () => {
    try {
        await connectDB();

        console.log('Searching for organizations with status "trial"...');

        const trialOrgs = await Organization.find({
            'subscription.status': 'trial'
        });

        console.log(`Found ${trialOrgs.length} organizations in trial mode.`);

        let updatedCount = 0;

        for (const org of trialOrgs) {
            console.log(`Fixing organization: ${org.name} (${org._id})`);

            // Update Organization
            org.subscription.plan = 'free';
            org.subscription.status = 'active';
            org.subscription.trialEndsAt = null;
            await org.save();

            // Update Subscription Record
            await Subscription.updateMany(
                { organization: org._id, status: 'trial' },
                {
                    $set: {
                        plan: 'free',
                        status: 'active',
                        currentPeriodEnd: null
                    }
                }
            );

            updatedCount++;
        }

        console.log(`Successfully updated ${updatedCount} organizations.`);
        process.exit(0);
    } catch (error) {
        console.error('Error fixing organizations:', error);
        process.exit(1);
    }
};

fixTrialOrganizations();
