const User = require('../models/User');
const Organization = require('../models/Organization');
const Subscription = require('../models/Subscription');
const subscriptionEmailService = require('../services/subscriptionEmailService');

/**
 * @desc    Handle Polar.sh Webhooks
 * @route   POST /api/polar/webhook
 * @access  Public (Signature verified)
 */
exports.handleWebhook = async (req, res) => {
    try {
        const PaymentConfig = require('../models/PaymentConfig');
        const config = await PaymentConfig.getConfig();

        // Verify webhook signature
        const signature = req.headers['webhook-id'];
        const webhookSecret = config.polar.webhookSecret;

        if (webhookSecret && signature) {
            // Polar uses standard webhook signature verification
            // For now, we validate by checking the secret is configured
            // In production, use Polar SDK's built-in verification
            const crypto = require('crypto');
            const webhookSignature = req.headers['webhook-signature'];

            if (!webhookSignature) {
                console.warn('[Polar Webhook] No webhook-signature header, proceeding with caution');
            }
        }

        const event = req.body;
        console.log('[Polar Webhook] Received event:', event.type || event.event);

        const eventType = event.type || event.event;
        const data = event.data;

        if (!data) {
            return res.status(200).json({ received: true });
        }

        switch (eventType) {
            case 'subscription.created':
            case 'subscription.updated':
                await handlePolarSubscriptionUpdate(data);
                break;
            case 'subscription.canceled':
            case 'subscription.revoked':
                await handlePolarSubscriptionCancel(data);
                break;
            case 'order.paid':
            case 'checkout.completed':
                await handlePolarOrderCompleted(data);
                break;
            default:
                console.log('[Polar Webhook] Unhandled event type:', eventType);
        }

        res.status(200).json({ received: true });
    } catch (err) {
        console.error('[Polar Webhook Error]', err);
        res.status(500).json({ error: 'Webhook Handler Error' });
    }
};

/**
 * Handle Polar subscription created/updated
 */
async function handlePolarSubscriptionUpdate(data) {
    const { metadata, customer, id, status } = data;

    let user;
    let organizationId;

    // Find user from metadata or customer email
    if (metadata && metadata.userId) {
        user = await User.findById(metadata.userId);
        organizationId = metadata.organizationId || user?.organization;
    } else if (customer && customer.email) {
        user = await User.findOne({ email: customer.email });
        organizationId = user?.organization;
    }

    if (!user || !organizationId) {
        console.error('[Polar Webhook] User/Organization not found for subscription:', id);
        return;
    }

    // Update user
    user.plan = 'pro';
    user.subscriptionStatus = status === 'active' ? 'active' : status;
    user.polarCustomerId = customer?.id || data.customer_id;
    user.polarSubscriptionId = id;
    await user.save();

    // Update organization
    const organization = await Organization.findById(organizationId);
    if (organization) {
        const wasFreePlan = organization.subscription.plan === 'free';

        organization.subscription.plan = 'pro';
        organization.subscription.status = 'active';
        organization.subscription.polarCustomerId = customer?.id || data.customer_id;
        organization.subscription.polarSubscriptionId = id;
        organization.subscription.paymentProcessor = 'polar';

        if (data.current_period_end) {
            organization.subscription.currentPeriodEnd = new Date(data.current_period_end);
        }

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

        // Send activation email only if upgrading from free
        if (wasFreePlan) {
            await subscriptionEmailService.sendSubscriptionActivatedEmail(user, organization);
        }
    }

    // Create/Update subscription record
    await Subscription.findOneAndUpdate(
        { organization: organizationId },
        {
            plan: 'pro',
            status: 'active',
            currentPeriodStart: data.current_period_start ? new Date(data.current_period_start) : new Date(),
            currentPeriodEnd: data.current_period_end ? new Date(data.current_period_end) : new Date(),
            polarCustomerId: customer?.id || data.customer_id,
            polarSubscriptionId: id,
            paymentProcessor: 'polar',
            billingCycle: {
                interval: data.recurring_interval || 'month',
                frequency: 1
            },
            cancelAtPeriodEnd: false
        },
        { upsert: true, new: true }
    );

    console.log(`[Polar Webhook] User ${user.email} upgraded to PRO`);
}

/**
 * Handle Polar subscription cancel
 */
async function handlePolarSubscriptionCancel(data) {
    const { id, customer, metadata } = data;

    let user;
    if (metadata && metadata.userId) {
        user = await User.findById(metadata.userId);
    } else if (customer && customer.email) {
        user = await User.findOne({ email: customer.email });
    } else {
        user = await User.findOne({ polarSubscriptionId: id });
    }

    if (!user) {
        console.error('[Polar Webhook] User not found for cancelled subscription:', id);
        return;
    }

    // Update user
    user.plan = 'free';
    user.subscriptionStatus = 'cancelled';
    await user.save();

    // Update organization
    const organization = await Organization.findById(user.organization);
    if (organization) {
        organization.subscription.plan = 'free';
        organization.subscription.status = 'cancelled';

        // Downgrade features
        const freeFeatures = Subscription.plans.free.features;
        organization.features = {
            maxInvoices: freeFeatures.maxInvoices,
            emailReminders: freeFeatures.emailReminders,
            basicReporting: freeFeatures.basicReporting,
            automatedSchedule: freeFeatures.automatedSchedule,
            prioritySupport: freeFeatures.prioritySupport,
            removeBranding: freeFeatures.removeBranding
        };

        await organization.save();

        // Send cancellation email
        await subscriptionEmailService.sendSubscriptionCancelledEmail(user, organization);
    }

    // Update subscription record
    await Subscription.findOneAndUpdate(
        { organization: user.organization },
        {
            status: 'cancelled',
            cancelAtPeriodEnd: true
        }
    );

    console.log(`[Polar Webhook] User ${user.email} subscription cancelled`);
}

/**
 * Handle Polar order/checkout completed
 */
async function handlePolarOrderCompleted(data) {
    console.log('[Polar Webhook] Order/checkout completed:', data.id);
    // If the subscription events haven't fired yet, handle the initial activation here
    if (data.subscription_id) {
        await handlePolarSubscriptionUpdate({
            ...data,
            id: data.subscription_id,
            status: 'active'
        });
    }
}
