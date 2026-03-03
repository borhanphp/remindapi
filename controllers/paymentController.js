const { getActiveGateway } = require('../services/gatewayFactory');
const Subscription = require('../models/Subscription');

/**
 * @desc    Create checkout session via active payment processor
 * @route   POST /api/payment/checkout
 * @access  Private
 */
exports.createCheckout = async (req, res) => {
    try {
        const { plan, billingCycle } = req.body;

        if (!plan || plan !== 'pro') {
            return res.status(400).json({
                success: false,
                message: 'Invalid plan. Only "pro" plan can be purchased.'
            });
        }

        const gateway = await getActiveGateway();
        const orgId = req.user.organization?._id || req.user.organization;
        const result = await gateway.createCheckout({
            plan,
            billingCycle: billingCycle || 'monthly',
            user: req.user,
            organizationId: orgId
        });

        res.status(200).json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('[Payment] Checkout error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to create checkout session'
        });
    }
};

/**
 * @desc    Get current subscription via active processor
 * @route   GET /api/payment/subscription
 * @access  Private
 */
exports.getSubscription = async (req, res) => {
    try {
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
        console.error('[Payment] Get subscription error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch subscription'
        });
    }
};

/**
 * @desc    Cancel subscription via active processor
 * @route   POST /api/payment/cancel
 * @access  Private
 */
exports.cancelSubscription = async (req, res) => {
    try {
        const User = require('../models/User');
        const Organization = require('../models/Organization');
        const Subscription = require('../models/Subscription');
        const user = await User.findById(req.user._id);

        // Determine which subscription ID to use
        const subscriptionId = user.paddleSubscriptionId || user.polarSubscriptionId;

        if (subscriptionId) {
            // Cancel via payment gateway (Paddle/Polar API)
            try {
                const gateway = await getActiveGateway();
                await gateway.cancelSubscription(subscriptionId);

                return res.status(200).json({
                    success: true,
                    message: 'Subscription will be cancelled at the end of the billing period'
                });
            } catch (gatewayErr) {
                console.error('[Payment] Gateway cancel error:', gatewayErr.message);
                // If gateway fails (e.g. subscription already cancelled remotely), fall through to local cancel
            }
        }

        // Local cancellation: no gateway subscription ID or gateway call failed
        // Downgrade user and organization directly
        if (user.plan !== 'pro') {
            return res.status(400).json({
                success: false,
                message: 'No active Pro subscription to cancel'
            });
        }

        // Downgrade user
        user.plan = 'free';
        user.subscriptionStatus = 'cancelled';
        user.paddleSubscriptionId = null;
        user.paddleCustomerId = null;
        await user.save();

        // Downgrade organization
        const organization = await Organization.findById(user.organization);
        if (organization) {
            organization.subscription.plan = 'free';
            organization.subscription.status = 'cancelled';

            // Reset to free plan features
            const freeFeatures = Subscription.plans.free.features;
            organization.features = freeFeatures;
            await organization.save();
        }

        // Update subscription record
        await Subscription.findOneAndUpdate(
            { organization: user.organization },
            {
                status: 'cancelled',
                plan: 'free',
                cancelledAt: new Date(),
                cancelAtPeriodEnd: false
            }
        );

        res.status(200).json({
            success: true,
            message: 'Subscription cancelled and downgraded to Free plan'
        });
    } catch (error) {
        console.error('[Payment] Cancel subscription error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to cancel subscription'
        });
    }
};

/**
 * @desc    Get billing portal URL via active processor
 * @route   GET /api/payment/portal-url
 * @access  Private
 */
exports.getPortalUrl = async (req, res) => {
    try {
        const User = require('../models/User');
        const user = await User.findById(req.user._id);

        const customerId = user.paddleCustomerId || user.polarCustomerId;

        if (!customerId) {
            return res.status(400).json({
                success: false,
                message: 'No customer ID found. Please subscribe first.'
            });
        }

        const gateway = await getActiveGateway();
        const portalUrl = await gateway.getPortalUrl(customerId);

        res.status(200).json({
            success: true,
            data: { portalUrl }
        });
    } catch (error) {
        console.error('[Payment] Get portal URL error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get portal URL'
        });
    }
};

/**
 * @desc    Get active payment processor info
 * @route   GET /api/payment/processor
 * @access  Private
 */
exports.getProcessor = async (req, res) => {
    try {
        const gateway = await getActiveGateway();
        res.status(200).json({
            success: true,
            data: {
                processor: gateway.getProcessorName()
            }
        });
    } catch (error) {
        console.error('[Payment] Get processor error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get processor info'
        });
    }
};
