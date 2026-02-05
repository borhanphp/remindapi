const Organization = require('../models/Organization');
const Subscription = require('../models/Subscription');
const User = require('../models/User');
const {
    getSubscriptionStatus,
    getInvoiceUsage,
    getTrialDaysRemaining,
    getPlanComparison,
    shouldUpgrade
} = require('../utils/subscriptionHelpers');

/**
 * @desc    Get current subscription status and usage
 * @route   GET /api/subscription/status
 * @access  Private
 */
exports.getStatus = async (req, res) => {
    try {
        const organization = await Organization.findById(req.user.organization);

        if (!organization) {
            return res.status(404).json({
                success: false,
                message: 'Organization not found'
            });
        }

        const subscription = await Subscription.findOne({
            organization: req.user.organization
        }).sort({ createdAt: -1 });

        // Get usage stats
        const usage = await getInvoiceUsage(req.user.organization);

        // Get trial info if applicable
        let trialInfo = null;
        if (organization.subscription.status === 'trial') {
            const daysRemaining = await getTrialDaysRemaining(req.user.organization);
            trialInfo = {
                daysRemaining,
                endsAt: organization.subscription.trialEndsAt
            };
        }

        // Check if upgrade is recommended
        const upgradeCheck = await shouldUpgrade(req.user.organization);

        res.json({
            success: true,
            data: {
                plan: organization.subscription.plan,
                status: organization.subscription.status,
                features: organization.features,
                usage: usage,
                trial: trialInfo,
                billing: subscription ? {
                    currentPeriodEnd: subscription.currentPeriodEnd,
                    nextBilledAt: subscription.nextBilledAt,
                    billingCycle: subscription.billingCycle,
                    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd
                } : null,
                upgradeRecommended: upgradeCheck.shouldUpgrade,
                upgradeReason: upgradeCheck.reason
            }
        });
    } catch (error) {
        console.error('Get subscription status error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get subscription status'
        });
    }
};

/**
 * @desc    Get available plans
 * @route   GET /api/subscription/plans
 * @access  Public
 */
exports.getPlans = async (req, res) => {
    try {
        const plans = getPlanComparison();

        res.json({
            success: true,
            data: plans
        });
    } catch (error) {
        console.error('Get plans error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get plans'
        });
    }
};

/**
 * @desc    Get billing history
 * @route   GET /api/subscription/billing-history
 * @access  Private
 */
exports.getBillingHistory = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);

        if (!user.paddleCustomerId) {
            return res.json({
                success: true,
                data: []
            });
        }

        const { paddle } = require('../config/paddle');

        // Get transactions from Paddle
        const transactions = await paddle.transactions.list({
            customerId: user.paddleCustomerId
        });

        // Format transactions
        const formattedTransactions = transactions.data.map(tx => ({
            id: tx.id,
            status: tx.status,
            amount: tx.details.totals.total,
            currency: tx.currency_code,
            createdAt: tx.created_at,
            billedAt: tx.billed_at,
            invoiceNumber: tx.invoice_number,
            receiptUrl: tx.receipt_url
        }));

        res.json({
            success: true,
            data: formattedTransactions
        });
    } catch (error) {
        console.error('Get billing history error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get billing history',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * @desc    Get usage statistics
 * @route   GET /api/subscription/usage
 * @access  Private
 */
exports.getUsage = async (req, res) => {
    try {
        const organization = await Organization.findById(req.user.organization);

        if (!organization) {
            return res.status(404).json({
                success: false,
                message: 'Organization not found'
            });
        }

        const usage = await getInvoiceUsage(req.user.organization);

        // Get historical usage (last 6 months)
        const Invoice = require('../models/Invoice');
        const monthlyUsage = [];
        
        for (let i = 5; i >= 0; i--) {
            const date = new Date();
            date.setMonth(date.getMonth() - i);
            const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
            const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);

            const count = await Invoice.countDocuments({
                organization: req.user.organization,
                createdAt: {
                    $gte: startOfMonth,
                    $lte: endOfMonth
                }
            });

            monthlyUsage.push({
                month: startOfMonth.toISOString().substring(0, 7), // YYYY-MM
                count: count
            });
        }

        res.json({
            success: true,
            data: {
                current: usage,
                history: monthlyUsage,
                plan: organization.subscription.plan,
                features: organization.features
            }
        });
    } catch (error) {
        console.error('Get usage error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get usage statistics'
        });
    }
};

/**
 * @desc    Preview upgrade (calculate prorated cost)
 * @route   GET /api/subscription/preview-upgrade
 * @access  Private
 */
exports.previewUpgrade = async (req, res) => {
    try {
        const organization = await Organization.findById(req.user.organization);

        if (!organization) {
            return res.status(404).json({
                success: false,
                message: 'Organization not found'
            });
        }

        if (organization.subscription.plan === 'pro') {
            return res.status(400).json({
                success: false,
                message: 'Already on Pro plan'
            });
        }

        // Simple preview - Pro plan is $9/month
        const proPrice = 9;
        
        res.json({
            success: true,
            data: {
                currentPlan: organization.subscription.plan,
                newPlan: 'pro',
                monthlyPrice: proPrice,
                currency: 'USD',
                billingCycle: 'monthly',
                features: Subscription.plans.pro.features,
                immediateCharge: proPrice, // No proration for simplicity
                savings: organization.subscription.plan === 'free' ? 'Unlimited invoices vs 5/month' : null
            }
        });
    } catch (error) {
        console.error('Preview upgrade error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to preview upgrade'
        });
    }
};

/**
 * @desc    Check feature availability
 * @route   GET /api/subscription/check-feature/:featureName
 * @access  Private
 */
exports.checkFeature = async (req, res) => {
    try {
        const { featureName } = req.params;
        const organization = await Organization.findById(req.user.organization);

        if (!organization) {
            return res.status(404).json({
                success: false,
                message: 'Organization not found'
            });
        }

        const hasAccess = organization.features[featureName] === true;

        res.json({
            success: true,
            data: {
                feature: featureName,
                hasAccess: hasAccess,
                currentPlan: organization.subscription.plan,
                requiresUpgrade: !hasAccess
            }
        });
    } catch (error) {
        console.error('Check feature error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to check feature'
        });
    }
};
