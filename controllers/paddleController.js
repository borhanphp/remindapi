const User = require('../models/User');

/**
 * @desc    Handle Paddle Webhooks
 * @route   POST /api/paddle/webhook
 * @access  Public (Signature verified)
 */
exports.handleWebhook = async (req, res) => {
    try {
        const { verifyWebhookSignature } = require('../config/paddle');
        const signature = req.headers['paddle-signature'];
        
        // Verify webhook signature for security
        if (process.env.NODE_ENV === 'production' && signature) {
            try {
                const isValid = verifyWebhookSignature(req.rawBody, signature);
                if (!isValid) {
                    console.error('[Paddle Webhook] Invalid signature');
                    return res.status(401).json({ error: 'Invalid signature' });
                }
            } catch (err) {
                console.error('[Paddle Webhook] Signature verification failed:', err);
                return res.status(401).json({ error: 'Signature verification failed' });
            }
        }

        const event = req.body;
        console.log('[Paddle Webhook] Received event:', event.event_type);

        if (!event.data) {
            return res.status(200).json({ received: true });
        }

        switch (event.event_type) {
            case 'subscription.created':
            case 'subscription.updated':
                await handleSubscriptionUpdate(event.data);
                break;
            case 'subscription.canceled':
                await handleSubscriptionCancel(event.data);
                break;
            case 'subscription.paused':
                await handleSubscriptionPause(event.data);
                break;
            case 'subscription.resumed':
                await handleSubscriptionResume(event.data);
                break;
            case 'transaction.completed':
                await handleTransactionCompleted(event.data);
                break;
            case 'transaction.payment_failed':
                await handlePaymentFailed(event.data);
                break;
            default:
                console.log('[Paddle Webhook] Unhandled event type:', event.event_type);
        }

        res.status(200).json({ received: true });
    } catch (err) {
        console.error('[Paddle Webhook Error]', err);
        res.status(500).json({ error: 'Webhook Handler Error' });
    }
};

// Helper: Handle Subscription Created/Updated
async function handleSubscriptionUpdate(data) {
    const { custom_data, customer_id, id, status, billing_cycle, items } = data;
    const Organization = require('../models/Organization');
    const Subscription = require('../models/Subscription');
    const subscriptionEmailService = require('../services/subscriptionEmailService');

    let user;
    let organizationId;

    // Try to find user and organization from custom_data
    if (custom_data && custom_data.userId) {
        user = await User.findById(custom_data.userId);
        organizationId = custom_data.organizationId || user?.organization;
    } else {
        // Fallback: lookup by customer_id
        user = await User.findOne({ paddleCustomerId: customer_id });
        organizationId = user?.organization;
    }

    if (!user || !organizationId) {
        console.error('[Paddle Webhook] User/Organization not found for subscription:', id);
        return;
    }

    // Update user
    user.plan = 'pro';
    user.subscriptionStatus = status === 'active' ? 'active' : status;
    user.paddleCustomerId = customer_id;
    user.paddleSubscriptionId = id;
    if (billing_cycle) user.billingCycle = billing_cycle.interval;
    await user.save();

    // Update organization
    const organization = await Organization.findById(organizationId);
    if (organization) {
        const wasFreePlan = organization.subscription.plan === 'free';
        
        organization.subscription.plan = 'pro';
        organization.subscription.status = 'active';
        organization.subscription.paddleCustomerId = customer_id;
        organization.subscription.paddleSubscriptionId = id;
        organization.subscription.currentPeriodEnd = billing_cycle?.ends_at ? new Date(billing_cycle.ends_at) : null;

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
    const priceId = items?.[0]?.price?.id;
    const unitPrice = items?.[0]?.price?.unit_price?.amount;

    await Subscription.findOneAndUpdate(
        { organization: organizationId },
        {
            plan: 'pro',
            status: 'active',
            currentPeriodStart: billing_cycle?.starts_at ? new Date(billing_cycle.starts_at) : new Date(),
            currentPeriodEnd: billing_cycle?.ends_at ? new Date(billing_cycle.ends_at) : new Date(),
            paddleCustomerId: customer_id,
            paddleSubscriptionId: id,
            paddlePriceId: priceId,
            billingCycle: {
                interval: billing_cycle?.interval || 'month',
                frequency: billing_cycle?.frequency || 1
            },
            nextBilledAt: billing_cycle?.next_billed_at ? new Date(billing_cycle.next_billed_at) : null,
            unitPrice: unitPrice ? unitPrice / 100 : null, // Convert cents to dollars
            cancelAtPeriodEnd: false
        },
        { upsert: true, new: true }
    );

    console.log(`[Paddle Webhook] User ${user.email} upgraded to PRO`);
}

// Helper: Handle Subscription Cancel
async function handleSubscriptionCancel(data) {
    const { id, scheduled_change } = data;
    const Organization = require('../models/Organization');
    const Subscription = require('../models/Subscription');
    const subscriptionEmailService = require('../services/subscriptionEmailService');

    const user = await User.findOne({ paddleSubscriptionId: id });
    if (!user) {
        console.error('[Paddle Webhook] User not found for canceled subscription:', id);
        return;
    }

    const organization = await Organization.findById(user.organization);
    
    // Check if cancellation is immediate or at period end
    const isImmediate = !scheduled_change;

    if (isImmediate) {
        // Downgrade immediately
        user.plan = 'free';
        user.subscriptionStatus = 'canceled';
        await user.save();

        // Update organization
        if (organization) {
            organization.subscription.plan = 'free';
            organization.subscription.status = 'canceled';

            // Reset to free plan features
            const freeFeatures = Subscription.plans.free.features;
            organization.features = freeFeatures;
            await organization.save();
        }

        // Update subscription record
        const subscription = await Subscription.findOneAndUpdate(
            { paddleSubscriptionId: id },
            {
                status: 'cancelled',
                cancelledAt: new Date(),
                plan: 'free'
            },
            { new: true }
        );

        // Send cancellation email
        await subscriptionEmailService.sendSubscriptionCancelledEmail(
            user, 
            organization, 
            subscription?.currentPeriodEnd
        );

        console.log(`[Paddle Webhook] User ${user.email} immediately downgraded to FREE`);
    } else {
        // Mark for cancellation at period end
        const subscription = await Subscription.findOneAndUpdate(
            { paddleSubscriptionId: id },
            {
                cancelAtPeriodEnd: true,
                cancelledAt: new Date()
            },
            { new: true }
        );

        // Send cancellation email with end date
        await subscriptionEmailService.sendSubscriptionCancelledEmail(
            user, 
            organization, 
            subscription?.currentPeriodEnd
        );

        console.log(`[Paddle Webhook] User ${user.email} subscription will cancel at period end`);
    }
}

// Helper: Handle Subscription Pause
async function handleSubscriptionPause(data) {
    const { id } = data;
    const user = await User.findOne({ paddleSubscriptionId: id });
    
    if (user) {
        user.subscriptionStatus = 'paused';
        await user.save();
        console.log(`[Paddle Webhook] User ${user.email} subscription paused`);
    }
}

// Helper: Handle Subscription Resume
async function handleSubscriptionResume(data) {
    const { id, status } = data;
    const user = await User.findOne({ paddleSubscriptionId: id });
    
    if (user) {
        user.subscriptionStatus = status || 'active';
        await user.save();
        console.log(`[Paddle Webhook] User ${user.email} subscription resumed`);
    }
}

// Helper: Handle Transaction Completed
async function handleTransactionCompleted(data) {
    const { subscription_id } = data;
    
    if (subscription_id) {
        const user = await User.findOne({ paddleSubscriptionId: subscription_id });
        if (user && user.subscriptionStatus === 'past_due') {
            user.subscriptionStatus = 'active';
            await user.save();
            console.log(`[Paddle Webhook] Payment received for user ${user.email}`);
        }
    }
}

// Helper: Handle Payment Failed
async function handlePaymentFailed(data) {
    const { subscription_id } = data;
    const Organization = require('../models/Organization');
    const subscriptionEmailService = require('../services/subscriptionEmailService');
    
    if (subscription_id) {
        const user = await User.findOne({ paddleSubscriptionId: subscription_id });
        if (user) {
            user.subscriptionStatus = 'past_due';
            await user.save();

            // Update organization status
            const organization = await Organization.findById(user.organization);
            if (organization) {
                organization.subscription.status = 'past_due';
                await organization.save();

                // Send payment failed email
                await subscriptionEmailService.sendPaymentFailedEmail(user, organization);
            }

            console.log(`[Paddle Webhook] Payment failed for user ${user.email}`);
        }
    }
}

/**
 * @desc    Get subscription plans
 * @route   GET /api/paddle/plans
 * @access  Public
 */
exports.getPlans = async (req, res) => {
    try {
        const Subscription = require('../models/Subscription');
        const plans = Subscription.plans;
        
        // Format plans for frontend
        const formattedPlans = Object.keys(plans).map(key => ({
            id: key,
            name: plans[key].name,
            price: plans[key].price,
            interval: plans[key].interval,
            features: plans[key].features
        }));

        res.status(200).json({
            success: true,
            data: formattedPlans
        });
    } catch (error) {
        console.error('[Paddle] Get plans error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch plans'
        });
    }
};

/**
 * @desc    Create checkout session
 * @route   POST /api/paddle/checkout
 * @access  Private
 */
exports.createCheckout = async (req, res) => {
    try {
        const { getPriceIdForPlan } = require('../config/paddle');
        const { plan } = req.body;

        if (!plan || plan !== 'pro') {
            return res.status(400).json({
                success: false,
                message: 'Invalid plan. Only "pro" plan can be purchased.'
            });
        }

        const priceId = getPriceIdForPlan(plan);
        
        // Return price ID and user details for frontend Paddle.js to handle
        res.status(200).json({
            success: true,
            data: {
                priceId: priceId,
                customerEmail: req.user.email,
                customData: {
                    userId: req.user._id.toString(),
                    organizationId: req.user.organization.toString()
                }
            }
        });
    } catch (error) {
        console.error('[Paddle] Checkout creation error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create checkout session',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * @desc    Get current subscription
 * @route   GET /api/paddle/subscription
 * @access  Private
 */
exports.getSubscription = async (req, res) => {
    try {
        const Subscription = require('../models/Subscription');
        const subscription = await Subscription.findOne({
            organization: req.user.organization
        }).sort({ createdAt: -1 });

        if (!subscription) {
            return res.status(404).json({
                success: false,
                message: 'No subscription found'
            });
        }

        res.status(200).json({
            success: true,
            data: subscription
        });
    } catch (error) {
        console.error('[Paddle] Get subscription error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch subscription'
        });
    }
};

/**
 * @desc    Cancel subscription
 * @route   POST /api/paddle/cancel
 * @access  Private
 */
exports.cancelSubscription = async (req, res) => {
    try {
        const { paddle } = require('../config/paddle');
        const User = require('../models/User');
        
        const user = await User.findById(req.user._id);
        
        if (!user.paddleSubscriptionId) {
            return res.status(400).json({
                success: false,
                message: 'No active subscription found'
            });
        }

        // Cancel subscription at period end
        await paddle.subscriptions.cancel(user.paddleSubscriptionId, {
            effective_from: 'next_billing_period'
        });

        res.status(200).json({
            success: true,
            message: 'Subscription will be cancelled at the end of the billing period'
        });
    } catch (error) {
        console.error('[Paddle] Cancel subscription error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to cancel subscription',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * @desc    Update subscription (e.g., change billing cycle)
 * @route   POST /api/paddle/update
 * @access  Private
 */
exports.updateSubscription = async (req, res) => {
    try {
        const { paddle } = require('../config/paddle');
        const User = require('../models/User');
        const { priceId } = req.body;

        const user = await User.findById(req.user._id);

        if (!user.paddleSubscriptionId) {
            return res.status(400).json({
                success: false,
                message: 'No active subscription found'
            });
        }

        if (!priceId) {
            return res.status(400).json({
                success: false,
                message: 'Price ID is required'
            });
        }

        // Update subscription
        await paddle.subscriptions.update(user.paddleSubscriptionId, {
            items: [{
                price_id: priceId,
                quantity: 1
            }],
            proration_billing_mode: 'prorated_immediately'
        });

        res.status(200).json({
            success: true,
            message: 'Subscription updated successfully'
        });
    } catch (error) {
        console.error('[Paddle] Update subscription error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update subscription',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * @desc    Get transactions
 * @route   GET /api/paddle/transactions
 * @access  Private
 */
exports.getTransactions = async (req, res) => {
    try {
        const { paddle } = require('../config/paddle');
        const User = require('../models/User');
        
        const user = await User.findById(req.user._id);

        if (!user.paddleCustomerId) {
            return res.status(200).json({
                success: true,
                data: []
            });
        }

        // Get transactions for customer
        const transactions = await paddle.transactions.list({
            customer_id: user.paddleCustomerId
        });

        res.status(200).json({
            success: true,
            data: transactions.data || []
        });
    } catch (error) {
        console.error('[Paddle] Get transactions error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch transactions',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * @desc    Get portal URL
 * @route   GET /api/paddle/portal-url
 * @access  Private
 */
exports.getPortalUrl = async (req, res) => {
    try {
        const User = require('../models/User');
        const user = await User.findById(req.user._id);

        if (!user.paddleCustomerId) {
            return res.status(400).json({
                success: false,
                message: 'No customer ID found. Please subscribe first.'
            });
        }

        // Paddle doesn't have a direct portal URL API like Stripe
        // You'll need to redirect to your own billing page or Paddle's billing portal
        const portalUrl = `https://vendors.paddle.com/subscriptions/customers/manage/${user.paddleCustomerId}`;

        res.status(200).json({
            success: true,
            data: {
                portalUrl: portalUrl
            }
        });
    } catch (error) {
        console.error('[Paddle] Get portal URL error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get portal URL'
        });
    }
};
