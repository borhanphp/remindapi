const User = require('../models/User');

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Paddle transaction statuses that mean payment succeeded (see TransactionStatus in @paddle/paddle-node-sdk) */
const PAID_TRANSACTION_STATUSES = ['billed', 'paid', 'completed'];

/**
 * Fetch transaction until subscription is linked and status is paid — API can lag checkout.completed by 1–30s.
 */
async function getTransactionReadyForVerify(paddle, transactionId) {
    const maxAttempts = 35;
    const intervalMs = 1000;
    let last = null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const transaction = await paddle.transactions.get(transactionId);
        last = transaction;

        if (transaction.status === 'canceled') {
            return { transaction, error: 'canceled' };
        }

        const hasSubscription = Boolean(transaction.subscriptionId);
        const paid = PAID_TRANSACTION_STATUSES.includes(transaction.status);

        if (hasSubscription && paid) {
            return { transaction };
        }

        if (attempt < maxAttempts - 1) {
            await delay(intervalMs);
        }
    }

    return { transaction: last, error: last ? 'timeout' : 'missing' };
}

/**
 * @desc    Test webhook endpoint (GET) to verify reachability
 * @route   GET /api/paddle/webhook
 * @access  Public
 */
exports.testWebhook = async (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Paddle webhook endpoint is reachable',
        timestamp: new Date().toISOString()
    });
};

/**
 * @desc    Handle Paddle Webhooks
 * @route   POST /api/paddle/webhook
 * @access  Public (Signature verified)
 */
exports.handleWebhook = async (req, res) => {
    try {
        console.log('========================================');
        console.log('[Paddle Webhook] Incoming request');
        console.log('[Paddle Webhook] Signature header:', req.headers['paddle-signature'] ? 'present' : 'MISSING');
        console.log('[Paddle Webhook] Raw body present:', !!req.rawBody);
        console.log('[Paddle Webhook] Event type:', req.body?.event_type);
        console.log('========================================');

        const { verifyWebhookSignature } = require('../config/paddle');
        const signature = req.headers['paddle-signature'];
        const isSandbox = process.env.PADDLE_ENVIRONMENT === 'sandbox';

        // Verify webhook signature
        if (!signature) {
            console.error('[Paddle Webhook] ⚠️ Missing paddle-signature header');
            if (!isSandbox) {
                return res.status(401).json({ error: 'Missing signature' });
            }
            console.warn('[Paddle Webhook] Sandbox: proceeding without signature');
        } else {
            try {
                const isValid = verifyWebhookSignature(req.rawBody, signature);
                if (!isValid) {
                    console.error('[Paddle Webhook] ⚠️ Signature mismatch');
                    if (!isSandbox) {
                        return res.status(401).json({ error: 'Invalid signature' });
                    }
                    console.warn('[Paddle Webhook] Sandbox: proceeding despite invalid signature');
                } else {
                    console.log('[Paddle Webhook] ✅ Signature verified');
                }
            } catch (err) {
                console.error('[Paddle Webhook] Signature error:', err.message);
                if (!isSandbox) {
                    return res.status(401).json({ error: 'Signature verification failed' });
                }
                console.warn('[Paddle Webhook] Sandbox: proceeding despite error');
            }
        }

        const event = req.body;
        console.log('[Paddle Webhook] Processing:', event.event_type);

        if (event.data?.custom_data) {
            console.log('[Paddle Webhook] Custom data:', JSON.stringify(event.data.custom_data));
        }

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
                console.log('[Paddle Webhook] Unhandled event:', event.event_type);
        }

        console.log('[Paddle Webhook] ✅ Done');
        res.status(200).json({ received: true });
    } catch (err) {
        console.error('[Paddle Webhook Error]', err);
        res.status(500).json({ error: 'Webhook Handler Error' });
    }
};

/**
 * @desc    Verify a checkout transaction client-side to instantly upgrade user
 * @route   POST /api/paddle/verify-checkout
 * @access  Private
 */
exports.verifyCheckout = async (req, res) => {
    try {
        console.log('\n[Paddle Verify] ---------- START VERIFY ENDPOINT ----------');
        console.log('[Paddle Verify] Request Headers:', req.headers);
        console.log('[Paddle Verify] Request Body:', req.body);
        const { transactionId } = req.body;
        console.log('[Paddle Verify] Received transactionId:', transactionId);

        if (!transactionId) {
            console.error('[Paddle Verify] Missing transactionId in body');
            return res.status(400).json({ success: false, message: 'Transaction ID is required' });
        }

        const { paddle } = require('../config/paddle');
        console.log('[Paddle Verify] Fetching transaction from Paddle API (with retry until subscription is linked)...');
        const { transaction, error: pollError } = await getTransactionReadyForVerify(paddle, transactionId);

        if (!transaction) {
            return res.status(400).json({ success: false, message: 'Transaction not found' });
        }

        if (pollError === 'canceled') {
            return res.status(400).json({ success: false, message: 'Transaction was canceled', status: transaction.status });
        }

        const subscriptionId = transaction.subscriptionId;
        console.log(`[Paddle Verify] Transaction resolved. Status: ${transaction.status}, Subscription ID: ${subscriptionId}, pollError: ${pollError || 'none'}`);

        if (!PAID_TRANSACTION_STATUSES.includes(transaction.status)) {
            console.error(`[Paddle Verify] Transaction not in a paid state after retries. Status is: ${transaction?.status}`);
            return res.status(400).json({
                success: false,
                message: 'Transaction not completed',
                status: transaction?.status
            });
        }

        if (!subscriptionId) {
            console.error('[Paddle Verify] Paid transaction has no subscriptionId after retries');
            return res.status(400).json({
                success: false,
                message: 'Subscription is not linked to this transaction yet. Please wait a minute and refresh, or contact support if this persists.'
            });
        }

        // Get detailed subscription to ensure we have the billing cycle correctly
        console.log(`[Paddle Verify] Fetching subscription details for ${subscriptionId}...`);
        const paddleSub = await paddle.subscriptions.get(subscriptionId);
        console.log(`[Paddle Verify] Subscription fetched. Status: ${paddleSub?.status}`);

        const Subscription = require('../models/Subscription');
        const Organization = require('../models/Organization');
        const User = require('../models/User');

        console.log(`[Paddle Verify] Looking up user: ${req.user._id}`);
        const user = await User.findById(req.user._id);
        if (!user) {
            console.error('[Paddle Verify] User not found in DB');
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const organizationId = user.organization;
        console.log(`[Paddle Verify] Looking up organization: ${organizationId}`);
        const organization = await Organization.findById(organizationId);

        const periodStart = paddleSub.currentBillingPeriod?.startsAt
            ? new Date(paddleSub.currentBillingPeriod.startsAt)
            : new Date();
        const periodEnd = paddleSub.currentBillingPeriod?.endsAt
            ? new Date(paddleSub.currentBillingPeriod.endsAt)
            : new Date();

        // Apply upgrade since we verified payment
        console.log('[Paddle Verify] Applying upgrade locally...');
        user.plan = 'pro';
        user.subscriptionStatus = paddleSub.status === 'active' ? 'active' : paddleSub.status;
        user.paddleCustomerId = paddleSub.customerId;
        user.paddleSubscriptionId = subscriptionId;
        if (paddleSub.billingCycle) user.billingCycle = paddleSub.billingCycle.interval;
        await user.save();

        if (organization) {
            organization.subscription.plan = 'pro';
            organization.subscription.status = 'active';
            organization.subscription.paddleCustomerId = paddleSub.customerId;
            organization.subscription.paddleSubscriptionId = subscriptionId;
            organization.subscription.currentPeriodEnd = paddleSub.currentBillingPeriod?.endsAt
                ? new Date(paddleSub.currentBillingPeriod.endsAt)
                : null;

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
                currentPeriodStart: periodStart,
                currentPeriodEnd: periodEnd,
                paddleCustomerId: paddleSub.customerId,
                paddleSubscriptionId: subscriptionId,
                billingCycle: {
                    interval: paddleSub.billingCycle?.interval || 'month',
                    frequency: paddleSub.billingCycle?.frequency || 1
                },
                nextBilledAt: paddleSub.nextBilledAt ? new Date(paddleSub.nextBilledAt) : null,
                cancelAtPeriodEnd: false
            },
            { upsert: true, new: true }
        );

        res.status(200).json({ success: true, message: 'Checkout verified successfully' });
    } catch (err) {
        console.error('[Paddle] Verify checkout error:', err);
        res.status(500).json({ success: false, message: 'Failed to verify checkout' });
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
        user.subscriptionStatus = 'cancelled';
        await user.save();

        // Update organization
        if (organization) {
            organization.subscription.plan = 'free';
            organization.subscription.status = 'cancelled';

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
    const Organization = require('../models/Organization');
    const Subscription = require('../models/Subscription');

    const user = await User.findOne({ paddleSubscriptionId: id });

    if (user) {
        user.subscriptionStatus = 'paused';
        await user.save();

        // Update organization status
        const organization = await Organization.findById(user.organization);
        if (organization) {
            organization.subscription.status = 'paused';
            await organization.save();
        }

        // Update subscription record
        await Subscription.findOneAndUpdate(
            { paddleSubscriptionId: id },
            { status: 'paused' }
        );

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
