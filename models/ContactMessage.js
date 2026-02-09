const mongoose = require('mongoose');

const contactMessageSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        trim: true,
        lowercase: true
    },
    subject: {
        type: String,
        trim: true,
        default: ''
    },
    message: {
        type: String,
        required: [true, 'Message is required']
    },
    status: {
        type: String,
        enum: ['unread', 'read', 'resolved'],
        default: 'unread'
    },
    readAt: {
        type: Date
    },
    resolvedAt: {
        type: Date
    }
}, {
    timestamps: true
});

// Indexes for efficient queries
contactMessageSchema.index({ status: 1, createdAt: -1 });
contactMessageSchema.index({ createdAt: -1 });

module.exports = mongoose.model('ContactMessage', contactMessageSchema);
