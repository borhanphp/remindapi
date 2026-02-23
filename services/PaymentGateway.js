/**
 * PaymentGateway — Base class defining the common payment interface.
 * Both PaddleGateway and PolarGateway implement these methods.
 */
class PaymentGateway {
    constructor(config) {
        this.config = config;
    }

    /**
     * Get the processor name
     * @returns {string} 'paddle' or 'polar'
     */
    getProcessorName() {
        throw new Error('getProcessorName() must be implemented');
    }

    /**
     * Create a checkout session for a plan
     * @param {Object} params
     * @param {string} params.plan - 'pro'
     * @param {string} params.billingCycle - 'monthly' or 'annual'
     * @param {Object} params.user - User document
     * @param {string} params.organizationId - Organization ID
     * @returns {Object} { type: 'redirect'|'client', url?: string, data?: Object }
     */
    async createCheckout({ plan, billingCycle, user, organizationId }) {
        throw new Error('createCheckout() must be implemented');
    }

    /**
     * Cancel a subscription
     * @param {string} subscriptionId - Processor-specific subscription ID
     * @returns {Object} { success: boolean, message: string }
     */
    async cancelSubscription(subscriptionId) {
        throw new Error('cancelSubscription() must be implemented');
    }

    /**
     * Get subscription details
     * @param {string} subscriptionId - Processor-specific subscription ID
     * @returns {Object|null} Subscription details
     */
    async getSubscription(subscriptionId) {
        throw new Error('getSubscription() must be implemented');
    }

    /**
     * Get billing portal/management URL
     * @param {string} customerId - Processor-specific customer ID
     * @returns {string|null} Portal URL
     */
    async getPortalUrl(customerId) {
        throw new Error('getPortalUrl() must be implemented');
    }
}

module.exports = PaymentGateway;
