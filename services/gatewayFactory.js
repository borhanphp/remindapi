const PaymentConfig = require('../models/PaymentConfig');
const PaddleGateway = require('./PaddleGateway');
const PolarGateway = require('./PolarGateway');

// Cache the gateway instance to avoid re-creating on every request
let cachedGateway = null;
let cachedProcessor = null;

/**
 * Get the active payment gateway based on the PaymentConfig in DB.
 * Caches the gateway instance and refreshes only when the processor changes.
 *
 * @param {boolean} forceRefresh - Force re-reading config from DB
 * @returns {PaymentGateway} Active gateway instance
 */
async function getActiveGateway(forceRefresh = false) {
    const config = await PaymentConfig.getConfig();

    // Return cached if processor hasn't changed
    if (!forceRefresh && cachedGateway && cachedProcessor === config.activeProcessor) {
        return cachedGateway;
    }

    if (config.activeProcessor === 'polar') {
        cachedGateway = new PolarGateway(config.polar);
    } else {
        cachedGateway = new PaddleGateway(config.paddle);
    }

    cachedProcessor = config.activeProcessor;
    console.log(`[Payment] Active gateway: ${cachedProcessor}`);

    return cachedGateway;
}

/**
 * Clear the cached gateway (called when admin updates config)
 */
function clearGatewayCache() {
    cachedGateway = null;
    cachedProcessor = null;
}

module.exports = { getActiveGateway, clearGatewayCache };
