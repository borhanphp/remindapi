const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Subscription = require('../models/Subscription');

// Middleware to check if user is super admin
const requireSuperAdmin = (req, res, next) => {
    if (!req.user.isSuperAdmin) {
        return res.status(403).json({
            success: false,
            message: 'Access denied. Super admin privileges required.'
        });
    }
    next();
};

// All routes require super admin authentication
router.use(protect, requireSuperAdmin);

/**
 * @desc    Get current pricing configuration
 * @route   GET /api/admin/pricing
 * @access  Private/SuperAdmin
 */
router.get('/', async (req, res) => {
    try {
        const plans = Subscription.plans;

        res.json({
            success: true,
            data: {
                free: {
                    name: plans.free.name,
                    price: plans.free.price,
                    interval: plans.free.interval,
                    features: plans.free.features
                },
                pro: {
                    name: plans.pro.name,
                    price: plans.pro.price,
                    annualPrice: plans.pro.annualPrice,
                    interval: plans.pro.interval,
                    features: plans.pro.features
                }
            }
        });
    } catch (error) {
        console.error('Get pricing config error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch pricing config' });
    }
});

/**
 * @desc    Update pricing configuration
 * @route   PUT /api/admin/pricing
 * @access  Private/SuperAdmin
 * 
 * Updates the in-memory pricing config. Changes persist until server restart.
 * For permanent changes, update the Subscription model code.
 */
router.put('/', async (req, res) => {
    try {
        const { proPrice, proAnnualPrice, freeMaxInvoices } = req.body;

        // Validate inputs
        if (proPrice !== undefined) {
            if (typeof proPrice !== 'number' || proPrice < 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Pro price must be a non-negative number'
                });
            }
            Subscription.plans.pro.price = proPrice;
        }

        if (proAnnualPrice !== undefined) {
            if (typeof proAnnualPrice !== 'number' || proAnnualPrice < 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Pro annual price must be a non-negative number'
                });
            }
            Subscription.plans.pro.annualPrice = proAnnualPrice;
        }

        if (freeMaxInvoices !== undefined) {
            if (typeof freeMaxInvoices !== 'number' || freeMaxInvoices < 1) {
                return res.status(400).json({
                    success: false,
                    message: 'Free max invoices must be at least 1'
                });
            }
            Subscription.plans.free.features.maxInvoices = freeMaxInvoices;
        }

        console.log(`[Admin] Pricing config updated by ${req.user.email}:`, {
            proPrice: Subscription.plans.pro.price,
            proAnnualPrice: Subscription.plans.pro.annualPrice,
            freeMaxInvoices: Subscription.plans.free.features.maxInvoices
        });

        res.json({
            success: true,
            message: 'Pricing configuration updated successfully',
            data: {
                free: {
                    name: Subscription.plans.free.name,
                    price: Subscription.plans.free.price,
                    features: Subscription.plans.free.features
                },
                pro: {
                    name: Subscription.plans.pro.name,
                    price: Subscription.plans.pro.price,
                    annualPrice: Subscription.plans.pro.annualPrice,
                    features: Subscription.plans.pro.features
                }
            }
        });
    } catch (error) {
        console.error('Update pricing config error:', error);
        res.status(500).json({ success: false, message: 'Failed to update pricing config' });
    }
});

/**
 * @desc    Get payment processor configuration
 * @route   GET /api/admin/pricing/processor
 * @access  Private/SuperAdmin
 */
router.get('/processor', async (req, res) => {
    try {
        const PaymentConfig = require('../models/PaymentConfig');
        const config = await PaymentConfig.getConfig();

        res.json({
            success: true,
            data: {
                activeProcessor: config.activeProcessor,
                paddle: {
                    clientToken: config.paddle.clientToken ? '••••' + config.paddle.clientToken.slice(-4) : '',
                    proPriceId: config.paddle.proPriceId,
                    proAnnualPriceId: config.paddle.proAnnualPriceId
                },
                polar: {
                    accessToken: config.polar.accessToken ? '••••' + config.polar.accessToken.slice(-4) : '',
                    webhookSecret: config.polar.webhookSecret ? '••••configured••••' : '',
                    organizationId: config.polar.organizationId,
                    proProductId: config.polar.proProductId,
                    proAnnualProductId: config.polar.proAnnualProductId,
                    environment: config.polar.environment
                }
            }
        });
    } catch (error) {
        console.error('Get processor config error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch processor config' });
    }
});

/**
 * @desc    Update payment processor configuration
 * @route   PUT /api/admin/pricing/processor
 * @access  Private/SuperAdmin
 */
router.put('/processor', async (req, res) => {
    try {
        const PaymentConfig = require('../models/PaymentConfig');
        const { clearGatewayCache } = require('../services/gatewayFactory');
        const { activeProcessor, paddle, polar } = req.body;

        const updateData = {};

        if (activeProcessor) {
            if (!['paddle', 'polar'].includes(activeProcessor)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid processor. Use "paddle" or "polar".'
                });
            }
            updateData.activeProcessor = activeProcessor;
        }

        if (paddle) {
            updateData.paddle = {};
            if (paddle.clientToken) updateData.paddle.clientToken = paddle.clientToken;
            if (paddle.proPriceId) updateData.paddle.proPriceId = paddle.proPriceId;
            if (paddle.proAnnualPriceId) updateData.paddle.proAnnualPriceId = paddle.proAnnualPriceId;
        }

        if (polar) {
            updateData.polar = {};
            if (polar.accessToken) updateData.polar.accessToken = polar.accessToken;
            if (polar.webhookSecret) updateData.polar.webhookSecret = polar.webhookSecret;
            if (polar.organizationId) updateData.polar.organizationId = polar.organizationId;
            if (polar.proProductId) updateData.polar.proProductId = polar.proProductId;
            if (polar.proAnnualProductId) updateData.polar.proAnnualProductId = polar.proAnnualProductId;
            if (polar.environment) updateData.polar.environment = polar.environment;
        }

        const config = await PaymentConfig.updateConfig(updateData, req.user._id);

        // Clear gateway cache so next request uses the new config
        clearGatewayCache();

        console.log(`[Admin] Processor config updated by ${req.user.email}: active=${config.activeProcessor}`);

        res.json({
            success: true,
            message: `Payment processor updated to ${config.activeProcessor}`,
            data: {
                activeProcessor: config.activeProcessor
            }
        });
    } catch (error) {
        console.error('Update processor config error:', error);
        res.status(500).json({ success: false, message: 'Failed to update processor config' });
    }
});

module.exports = router;

