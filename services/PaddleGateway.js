const PaymentGateway = require('./PaymentGateway');

/**
 * PaddleGateway — Wraps the existing Paddle integration.
 * Delegates to the existing config/paddle.js and Paddle SDK.
 */
class PaddleGateway extends PaymentGateway {
    constructor(config) {
        super(config);
    }

    getProcessorName() {
        return 'paddle';
    }

    async createCheckout({ plan, billingCycle, user, organizationId }) {
        const { getPriceIdForPlan } = require('../config/paddle');

        if (!plan || plan !== 'pro') {
            throw new Error('Invalid plan. Only "pro" plan can be purchased.');
        }

        // For now, use existing monthly price ID
        // Annual billing would need a separate Paddle price ID configured
        const priceId = billingCycle === 'annual' && this.config.proAnnualPriceId
            ? this.config.proAnnualPriceId
            : getPriceIdForPlan(plan);

        // Paddle uses client-side checkout (Paddle.js)
        return {
            type: 'client',           // Frontend handles via Paddle.js
            processor: 'paddle',
            data: {
                priceId: priceId,
                customerEmail: user.email,
                customData: {
                    userId: user._id.toString(),
                    organizationId: organizationId.toString()
                },
                environment: process.env.PADDLE_ENVIRONMENT || 'sandbox'
            }
        };
    }

    async cancelSubscription(subscriptionId) {
        const { paddle } = require('../config/paddle');

        await paddle.subscriptions.cancel(subscriptionId, {
            effective_from: 'next_billing_period'
        });

        return {
            success: true,
            message: 'Subscription will be cancelled at the end of the billing period'
        };
    }

    async getSubscription(subscriptionId) {
        const Subscription = require('../models/Subscription');
        return Subscription.findOne({ paddleSubscriptionId: subscriptionId }).sort({ createdAt: -1 });
    }

    async getPortalUrl(customerId) {
        if (!customerId) return null;
        return `https://vendors.paddle.com/subscriptions/customers/manage/${customerId}`;
    }
}

module.exports = PaddleGateway;
