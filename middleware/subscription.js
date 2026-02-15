const Organization = require('../models/Organization');
const Subscription = require('../models/Subscription');

/**
 * Middleware to check if organization has an active subscription
 */
exports.requireActiveSubscription = async (req, res, next) => {
    try {
        const organization = await Organization.findById(req.user.organization);

        if (!organization) {
            return res.status(404).json({
                success: false,
                message: 'Organization not found'
            });
        }

        // Free and Pro users with 'active' status can access
        // Legacy 'trial' status is also allowed for backward compatibility
        const allowedStatuses = ['active', 'trial'];

        if (!allowedStatuses.includes(organization.subscription.status)) {
            return res.status(403).json({
                success: false,
                message: 'Your subscription is not active. Please upgrade to continue.',
                subscriptionStatus: organization.subscription.status,
                requiresUpgrade: true
            });
        }

        next();
    } catch (error) {
        console.error('Subscription check error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to verify subscription'
        });
    }
};


/**
 * Middleware to check if user is on Pro plan
 */
exports.requireProPlan = async (req, res, next) => {
    try {
        const organization = await Organization.findById(req.user.organization);

        if (!organization) {
            return res.status(404).json({
                success: false,
                message: 'Organization not found'
            });
        }

        if (organization.subscription.plan !== 'pro') {
            return res.status(403).json({
                success: false,
                message: 'This feature requires a Pro subscription',
                currentPlan: organization.subscription.plan,
                requiresPlan: 'pro',
                upgradeRequired: true
            });
        }

        next();
    } catch (error) {
        console.error('Pro plan check error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to verify plan'
        });
    }
};

/**
 * Middleware to check invoice limit for free plan
 */
exports.checkInvoiceLimit = async (req, res, next) => {
    try {
        const organization = await Organization.findById(req.user.organization);

        if (!organization) {
            return res.status(404).json({
                success: false,
                message: 'Organization not found'
            });
        }

        // Pro plan has unlimited invoices
        if (organization.subscription.plan === 'pro') {
            return next();
        }

        // Check free plan lifetime limit
        const maxInvoices = organization.features.maxInvoices || 5;

        // Count ALL invoices (lifetime limit for free plan)
        const InvoiceReminder = require('../models/InvoiceReminder');
        const User = require('../models/User');
        const orgUsers = await User.find({ organization: req.user.organization }).select('_id');
        const userIds = orgUsers.map(u => u._id);

        const invoiceCount = await InvoiceReminder.countDocuments({
            userId: { $in: userIds }
        });

        if (invoiceCount >= maxInvoices) {
            return res.status(403).json({
                success: false,
                message: `You've reached your limit of ${maxInvoices} invoices. Upgrade to Pro for unlimited invoices.`,
                currentCount: invoiceCount,
                limit: maxInvoices,
                requiresUpgrade: true
            });
        }

        // Add remaining count to request for info
        req.invoicesRemaining = maxInvoices - invoiceCount;
        next();
    } catch (error) {
        console.error('Invoice limit check error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to verify invoice limit'
        });
    }
};

/**
 * Middleware to check if feature is available in user's plan
 */
exports.requireFeature = (featureName) => {
    return async (req, res, next) => {
        try {
            const organization = await Organization.findById(req.user.organization);

            if (!organization) {
                return res.status(404).json({
                    success: false,
                    message: 'Organization not found'
                });
            }

            const featureEnabled = organization.features[featureName];

            if (!featureEnabled) {
                return res.status(403).json({
                    success: false,
                    message: `This feature (${featureName}) is not available in your current plan`,
                    feature: featureName,
                    currentPlan: organization.subscription.plan,
                    requiresUpgrade: true
                });
            }

            next();
        } catch (error) {
            console.error('Feature check error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to verify feature access'
            });
        }
    };
};

/**
 * Middleware to attach subscription info to request
 */
exports.attachSubscriptionInfo = async (req, res, next) => {
    try {
        const organization = await Organization.findById(req.user.organization);

        if (organization) {
            req.subscription = {
                plan: organization.subscription.plan,
                status: organization.subscription.status,
                features: organization.features,
                trialEndsAt: organization.subscription.trialEndsAt,
                currentPeriodEnd: organization.subscription.currentPeriodEnd
            };
        }

        next();
    } catch (error) {
        console.error('Attach subscription info error:', error);
        next(); // Don't fail the request, just continue without subscription info
    }
};

/**
 * Check if organization is in grace period after failed payment
 */
exports.checkGracePeriod = async (req, res, next) => {
    try {
        const organization = await Organization.findById(req.user.organization);

        if (!organization) {
            return res.status(404).json({
                success: false,
                message: 'Organization not found'
            });
        }

        // If subscription is past_due, allow 7 days grace period
        if (organization.subscription.status === 'past_due') {
            const subscription = await Subscription.findOne({
                organization: req.user.organization
            }).sort({ createdAt: -1 });

            if (subscription && subscription.currentPeriodEnd) {
                const gracePeriodEnd = new Date(subscription.currentPeriodEnd);
                gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 7); // 7 days grace

                if (new Date() > gracePeriodEnd) {
                    return res.status(403).json({
                        success: false,
                        message: 'Your subscription has expired due to failed payment. Please update your payment method.',
                        requiresPayment: true
                    });
                }

                // In grace period, show warning but allow access
                req.inGracePeriod = true;
                req.gracePeriodEnds = gracePeriodEnd;
            }
        }

        next();
    } catch (error) {
        console.error('Grace period check error:', error);
        next(); // Don't block on error
    }
};
