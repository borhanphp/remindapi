const mongoose = require('mongoose');
const User = require('./models/User');
const Organization = require('./models/Organization');
const Subscription = require('./models/Subscription');
const { paddle } = require('./config/paddle');

require('dotenv').config();

async function testVerify() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB');

    const user = await User.findOne({ email: 'borhanidb@gmail.com' });
    if (!user) {
        console.log('User not found');
        process.exit(1);
    }
    console.log('Testing with user:', user.email, user._id);

    const transactionId = 'txn_01j78y6h2q37b8m9k6n7z21xtm'; // Replace with a valid test transaction id if you have one

    try {
        console.log('Fetching transaction from Paddle API...');
        const transaction = await paddle.transactions.get(transactionId);
        console.log(`Transaction fetched. Status: ${transaction?.status}, Subscription ID: ${transaction?.subscription_id}`);

        if (!transaction || transaction.status !== 'completed') {
            console.error(`Transaction not completed. Status is: ${transaction?.status}`);
            process.exit(1);
        }

        const subscriptionId = transaction.subscription_id;

        if (subscriptionId) {
            console.log(`Fetching subscription details for ${subscriptionId}...`);
            const paddleSub = await paddle.subscriptions.get(subscriptionId);
            console.log(`Subscription fetched. Status: ${paddleSub?.status}`);

            const organizationId = user.organization;
            const organization = await Organization.findById(organizationId);

            console.log('Applying upgrade locally...');
            user.plan = 'pro';
            user.subscriptionStatus = paddleSub.status === 'active' ? 'active' : paddleSub.status;
            user.paddleCustomerId = paddleSub.customer_id;
            user.paddleSubscriptionId = subscriptionId;
            if (paddleSub.billing_cycle) user.billingCycle = paddleSub.billing_cycle.interval;
            await user.save();

            if (organization) {
                organization.subscription.plan = 'pro';
                organization.subscription.status = 'active';
                organization.subscription.paddleCustomerId = paddleSub.customer_id;
                organization.subscription.paddleSubscriptionId = subscriptionId;
                organization.subscription.currentPeriodEnd = paddleSub.current_billing_period?.ends_at ? new Date(paddleSub.current_billing_period.ends_at) : null;

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
            }

            await Subscription.findOneAndUpdate(
                { organization: organizationId },
                {
                    plan: 'pro',
                    status: 'active',
                    currentPeriodStart: paddleSub.current_billing_period?.starts_at ? new Date(paddleSub.current_billing_period.starts_at) : new Date(),
                    currentPeriodEnd: paddleSub.current_billing_period?.ends_at ? new Date(paddleSub.current_billing_period.ends_at) : new Date(),
                    paddleCustomerId: paddleSub.customer_id,
                    paddleSubscriptionId: subscriptionId,
                    billingCycle: {
                        interval: paddleSub.billing_cycle?.interval || 'month',
                        frequency: paddleSub.billing_cycle?.frequency || 1
                    },
                    cancelAtPeriodEnd: false
                },
                { upsert: true, new: true }
            );
            console.log('Update Complete.');
        }

    } catch (e) {
        console.error('Error fetching from paddle:', e.message);
    }

    process.exit(0);
}

testVerify();
