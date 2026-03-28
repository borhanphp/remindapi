const PaymentGateway = require('./PaymentGateway');

/**
 * PolarGateway — Implements the payment gateway using Polar.sh SDK.
 * Uses server-side checkout session creation with redirect.
 */
class PolarGateway extends PaymentGateway {
    constructor(config) {
        super(config);
        this.polar = null;
        this._initClient();
    }

    _initClient() {
        try {
            const { Polar } = require('@polar-sh/sdk');
            if (this.config.accessToken) {
                this.polar = new Polar({
                    accessToken: this.config.accessToken,
                    server: this.config.environment === 'production' ? 'production' : 'sandbox'
                });
            }
        } catch (err) {
            console.error('[PolarGateway] Failed to initialize Polar SDK:', err.message);
        }
    }

    getProcessorName() {
        return 'polar';
    }

    async createCheckout({ plan, billingCycle, user, organizationId }) {
        if (!this.polar) {
            throw new Error('Polar.sh is not configured. Please set up credentials in the admin panel.');
        }

        if (!plan || plan !== 'pro') {
            throw new Error('Invalid plan. Only "pro" plan can be purchased.');
        }

        // Choose the right product based on billing cycle
        const productId = billingCycle === 'annual' && this.config.proAnnualProductId
            ? this.config.proAnnualProductId
            : this.config.proProductId;

        if (!productId) {
            throw new Error('Polar.sh product ID is not configured for this plan.');
        }

        // Create a Polar checkout session
        const checkout = await this.polar.checkouts.create({
            products: [productId],
            // App route is /settings/billing (no /dashboard prefix)
            successUrl: `${(process.env.FRONTEND_URL || '').replace(/\/$/, '')}/settings/billing?success=true`,
            customerEmail: user.email,
            metadata: {
                userId: String(user._id),
                organizationId: String(organizationId),
                plan: plan,
                billingCycle: billingCycle || 'monthly'
            }
        });

        // Polar uses redirect-based checkout
        return {
            type: 'redirect',          // Frontend redirects to Polar checkout page
            processor: 'polar',
            data: {
                checkoutUrl: checkout.url,
                checkoutId: checkout.id
            }
        };
    }

    async cancelSubscription(subscriptionId) {
        if (!this.polar) {
            throw new Error('Polar.sh is not configured.');
        }

        await this.polar.subscriptions.cancel({ id: subscriptionId });

        return {
            success: true,
            message: 'Subscription has been cancelled.'
        };
    }

    async getSubscription(subscriptionId) {
        if (!this.polar) return null;

        try {
            const sub = await this.polar.subscriptions.get({ id: subscriptionId });
            return sub;
        } catch (err) {
            console.error('[PolarGateway] Failed to get subscription:', err.message);
            return null;
        }
    }

    async getPortalUrl(customerId) {
        if (!this.polar || !customerId) return null;

        try {
            // Create a customer session for the portal
            const session = await this.polar.customerSessions.create({
                customerId: customerId
            });
            return session.customerPortalUrl || null;
        } catch (err) {
            console.error('[PolarGateway] Failed to get portal URL:', err.message);
            return null;
        }
    }
}

module.exports = PolarGateway;
