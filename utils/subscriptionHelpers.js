const Organization = require('../models/Organization');
const Subscription = require('../models/Subscription');
const User = require('../models/User');

/**
 * Get organization's current subscription status
 */
exports.getSubscriptionStatus = async (organizationId) => {
    try {
        const organization = await Organization.findById(organizationId);
        
        if (!organization) {
            return null;
        }

        const subscription = await Subscription.findOne({ organization: organizationId })
            .sort({ createdAt: -1 });

        return {
            plan: organization.subscription.plan,
            status: organization.subscription.status,
            features: organization.features,
            trialEndsAt: organization.subscription.trialEndsAt,
            currentPeriodEnd: organization.subscription.currentPeriodEnd,
            paddleSubscriptionId: organization.subscription.paddleSubscriptionId,
            subscriptionRecord: subscription
        };
    } catch (error) {
        console.error('Get subscription status error:', error);
        return null;
    }
};

/**
 * Check if organization has access to a feature
 */
exports.hasFeature = async (organizationId, featureName) => {
    try {
        const organization = await Organization.findById(organizationId);
        
        if (!organization) {
            return false;
        }

        return organization.features[featureName] === true;
    } catch (error) {
        console.error('Check feature error:', error);
        return false;
    }
};

/**
 * Get remaining invoice count for current month
 */
exports.getRemainingInvoices = async (organizationId) => {
    try {
        const organization = await Organization.findById(organizationId);
        
        if (!organization) {
            return 0;
        }

        // Pro plan has unlimited invoices
        if (organization.subscription.plan === 'pro') {
            return -1; // -1 indicates unlimited
        }

        const maxInvoices = organization.features.maxInvoices || 5;
        
        // Count invoices for current month
        const Invoice = require('../models/Invoice');
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const invoiceCount = await Invoice.countDocuments({
            organization: organizationId,
            createdAt: { $gte: startOfMonth }
        });

        return Math.max(0, maxInvoices - invoiceCount);
    } catch (error) {
        console.error('Get remaining invoices error:', error);
        return 0;
    }
};

/**
 * Get invoice usage for current month
 */
exports.getInvoiceUsage = async (organizationId) => {
    try {
        const organization = await Organization.findById(organizationId);
        
        if (!organization) {
            return { used: 0, limit: 0, unlimited: false };
        }

        // Pro plan has unlimited invoices
        if (organization.subscription.plan === 'pro') {
            const Invoice = require('../models/Invoice');
            const startOfMonth = new Date();
            startOfMonth.setDate(1);
            startOfMonth.setHours(0, 0, 0, 0);

            const invoiceCount = await Invoice.countDocuments({
                organization: organizationId,
                createdAt: { $gte: startOfMonth }
            });

            return {
                used: invoiceCount,
                limit: -1,
                unlimited: true
            };
        }

        const maxInvoices = organization.features.maxInvoices || 5;
        
        const Invoice = require('../models/Invoice');
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const invoiceCount = await Invoice.countDocuments({
            organization: organizationId,
            createdAt: { $gte: startOfMonth }
        });

        return {
            used: invoiceCount,
            limit: maxInvoices,
            remaining: Math.max(0, maxInvoices - invoiceCount),
            unlimited: false
        };
    } catch (error) {
        console.error('Get invoice usage error:', error);
        return { used: 0, limit: 0, unlimited: false };
    }
};

/**
 * Check if trial is expired
 */
exports.isTrialExpired = async (organizationId) => {
    try {
        const organization = await Organization.findById(organizationId);
        
        if (!organization) {
            return false;
        }

        if (organization.subscription.status !== 'trial') {
            return false;
        }

        if (!organization.subscription.trialEndsAt) {
            return false;
        }

        return new Date() > new Date(organization.subscription.trialEndsAt);
    } catch (error) {
        console.error('Check trial expired error:', error);
        return false;
    }
};

/**
 * Get days remaining in trial
 */
exports.getTrialDaysRemaining = async (organizationId) => {
    try {
        const organization = await Organization.findById(organizationId);
        
        if (!organization || organization.subscription.status !== 'trial') {
            return 0;
        }

        if (!organization.subscription.trialEndsAt) {
            return 0;
        }

        const now = new Date();
        const trialEnd = new Date(organization.subscription.trialEndsAt);
        const daysRemaining = Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24));

        return Math.max(0, daysRemaining);
    } catch (error) {
        console.error('Get trial days remaining error:', error);
        return 0;
    }
};

/**
 * Upgrade organization to Pro plan
 */
exports.upgradeToProPlan = async (organizationId, paddleData) => {
    try {
        const organization = await Organization.findById(organizationId);
        
        if (!organization) {
            throw new Error('Organization not found');
        }

        // Update organization
        organization.subscription.plan = 'pro';
        organization.subscription.status = 'active';
        organization.subscription.paddleCustomerId = paddleData.customerId;
        organization.subscription.paddleSubscriptionId = paddleData.subscriptionId;
        organization.subscription.currentPeriodEnd = paddleData.currentPeriodEnd;

        // Update features for Pro plan
        const proFeatures = Subscription.plans.pro.features;
        organization.features = proFeatures;

        await organization.save();

        // Update all users in organization
        await User.updateMany(
            { organization: organizationId },
            {
                $set: {
                    plan: 'pro',
                    subscriptionStatus: 'active',
                    paddleCustomerId: paddleData.customerId,
                    paddleSubscriptionId: paddleData.subscriptionId
                }
            }
        );

        return organization;
    } catch (error) {
        console.error('Upgrade to Pro error:', error);
        throw error;
    }
};

/**
 * Downgrade organization to Free plan
 */
exports.downgradeToFreePlan = async (organizationId) => {
    try {
        const organization = await Organization.findById(organizationId);
        
        if (!organization) {
            throw new Error('Organization not found');
        }

        // Update organization
        organization.subscription.plan = 'free';
        organization.subscription.status = 'active';

        // Update features for Free plan
        const freeFeatures = Subscription.plans.free.features;
        organization.features = freeFeatures;

        await organization.save();

        // Update all users in organization
        await User.updateMany(
            { organization: organizationId },
            {
                $set: {
                    plan: 'free',
                    subscriptionStatus: 'active'
                }
            }
        );

        return organization;
    } catch (error) {
        console.error('Downgrade to Free error:', error);
        throw error;
    }
};

/**
 * Get plan comparison
 */
exports.getPlanComparison = () => {
    return {
        free: Subscription.plans.free,
        pro: Subscription.plans.pro
    };
};

/**
 * Check if upgrade is needed based on usage
 */
exports.shouldUpgrade = async (organizationId) => {
    try {
        const organization = await Organization.findById(organizationId);
        
        if (!organization || organization.subscription.plan === 'pro') {
            return { shouldUpgrade: false };
        }

        const usage = await exports.getInvoiceUsage(organizationId);
        
        // Suggest upgrade if user is at 80% of limit
        const usagePercentage = (usage.used / usage.limit) * 100;

        return {
            shouldUpgrade: usagePercentage >= 80,
            reason: usagePercentage >= 100 ? 'limit_reached' : 'approaching_limit',
            usage: usage,
            usagePercentage: Math.round(usagePercentage)
        };
    } catch (error) {
        console.error('Should upgrade check error:', error);
        return { shouldUpgrade: false };
    }
};
