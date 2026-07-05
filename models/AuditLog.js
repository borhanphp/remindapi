const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
    type: {
        type: String,
        required: true,
        index: true
    },
    action: {
        type: String,
        required: true
    },
    user: {
        _id: mongoose.Schema.Types.ObjectId,
        name: String,
        email: String
    },
    organization: {
        _id: mongoose.Schema.Types.ObjectId,
        name: String
    },
    ip: {
        type: String,
        default: ''
    },
    geo: {
        country: String,
        city: String
    },
    status: {
        type: Number,
        default: 200
    },
    meta: {
        type: mongoose.Schema.Types.Mixed
    },
    ts: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

auditLogSchema.index({ ts: -1 });
auditLogSchema.index({ type: 1, ts: -1 });
auditLogSchema.index({ 'user._id': 1, ts: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
