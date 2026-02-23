const mongoose = require('mongoose');

const paymentConfigSchema = new mongoose.Schema({
    // Singleton identifier — only one config document exists
    _singleton: {
        type: String,
        default: 'payment_config',
        unique: true,
        immutable: true
    },

    // Active payment processor
    activeProcessor: {
        type: String,
        enum: ['paddle', 'polar'],
        default: 'paddle'
    },

    // Paddle configuration (loaded from env by default)
    paddle: {
        clientToken: { type: String, default: '' },
        proPriceId: { type: String, default: '' },
        proAnnualPriceId: { type: String, default: '' }
    },

    // Polar.sh configuration
    polar: {
        accessToken: { type: String, default: '' },
        webhookSecret: { type: String, default: '' },
        organizationId: { type: String, default: '' },
        proProductId: { type: String, default: '' },
        proAnnualProductId: { type: String, default: '' },
        environment: {
            type: String,
            enum: ['sandbox', 'production'],
            default: 'sandbox'
        }
    },

    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

// Static: Get the singleton config document (creates if not exists)
paymentConfigSchema.statics.getConfig = async function () {
    let config = await this.findOne({ _singleton: 'payment_config' });
    if (!config) {
        config = await this.create({
            activeProcessor: 'paddle',
            paddle: {
                clientToken: process.env.PADDLE_CLIENT_TOKEN || '',
                proPriceId: process.env.PADDLE_PRO_PRICE_ID || '',
                proAnnualPriceId: process.env.PADDLE_PRO_ANNUAL_PRICE_ID || ''
            }
        });
    }
    return config;
};

// Static: Update the config
paymentConfigSchema.statics.updateConfig = async function (data, userId) {
    return this.findOneAndUpdate(
        { _singleton: 'payment_config' },
        { ...data, updatedBy: userId },
        { upsert: true, new: true, runValidators: true }
    );
};

module.exports = mongoose.model('PaymentConfig', paymentConfigSchema);
