const sendEmail = require('../utils/sendEmail');
const ContactMessage = require('../models/ContactMessage');

/**
 * @desc    Submit contact form
 * @route   POST /api/contact
 * @access  Public
 */
exports.submitContactForm = async (req, res) => {
    try {
        const { name, email, subject, message } = req.body;

        if (!name || !email || !message) {
            return res.status(400).json({
                success: false,
                error: 'Please provide name, email, and message'
            });
        }

        // Save to database
        const contactMessage = await ContactMessage.create({
            name,
            email,
            subject: subject || '',
            message
        });

        // Send email notification
        const supportEmail = process.env.SUPPORT_EMAIL || 'support@zeeremind.com';
        const emailSubject = subject ? `Contact Form: ${subject}` : `New Contact Form Submission from ${name}`;

        try {
            await sendEmail({
                to: supportEmail,
                subject: emailSubject,
                replyTo: email,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
                        <h2 style="color: #4F46E5;">New Message from Contact Form</h2>
                        
                        <div style="background-color: #f9fafb; padding: 15px; border-radius: 6px; margin: 20px 0;">
                            <p><strong>Name:</strong> ${name}</p>
                            <p><strong>Email:</strong> ${email}</p>
                            <p><strong>Subject:</strong> ${subject || 'N/A'}</p>
                        </div>

                        <h3>Message:</h3>
                        <p style="white-space: pre-wrap; background-color: #f3f4f6; padding: 15px; border-radius: 6px;">${message}</p>
                        
                        <hr style="margin: 30px 0; border: 0; border-top: 1px solid #e5e7eb;" />
                        
                        <p style="color: #6b7280; font-size: 12px; text-align: center;">
                            This email was sent from the contact form on ${process.env.APP_NAME || 'ZeeRemind'}.
                        </p>
                    </div>
                `
            });
        } catch (emailErr) {
            console.error('Failed to send contact email:', emailErr);
            // Continue - message is saved, email just failed
        }

        res.status(200).json({
            success: true,
            data: 'Message sent successfully'
        });
    } catch (err) {
        console.error('Contact form error:', err);
        res.status(500).json({
            success: false,
            error: 'Failed to send message. Please try again later.'
        });
    }
};

/**
 * @desc    Get all contact messages (Admin)
 * @route   GET /api/admin/contacts
 * @access  Private (Super Admin)
 */
exports.getContactMessages = async (req, res) => {
    try {
        const { status, page = 1, limit = 20 } = req.query;

        const query = {};
        if (status && status !== 'all') {
            query.status = status;
        }

        const messages = await ContactMessage.find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        const total = await ContactMessage.countDocuments(query);

        res.json({
            success: true,
            data: messages,
            meta: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / limit)
            }
        });
    } catch (err) {
        console.error('Get contact messages error:', err);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch messages'
        });
    }
};

/**
 * @desc    Get unread count (Admin)
 * @route   GET /api/admin/contacts/unread-count
 * @access  Private (Super Admin)
 */
exports.getUnreadCount = async (req, res) => {
    try {
        const count = await ContactMessage.countDocuments({ status: 'unread' });
        res.json({ success: true, count });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Failed to get count' });
    }
};

/**
 * @desc    Mark message as read (Admin)
 * @route   PUT /api/admin/contacts/:id/read
 * @access  Private (Super Admin)
 */
exports.markAsRead = async (req, res) => {
    try {
        const message = await ContactMessage.findByIdAndUpdate(
            req.params.id,
            { status: 'read', readAt: new Date() },
            { new: true }
        );

        if (!message) {
            return res.status(404).json({ success: false, error: 'Message not found' });
        }

        res.json({ success: true, data: message });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Failed to update message' });
    }
};

/**
 * @desc    Mark message as resolved (Admin)
 * @route   PUT /api/admin/contacts/:id/resolve
 * @access  Private (Super Admin)
 */
exports.markAsResolved = async (req, res) => {
    try {
        const message = await ContactMessage.findByIdAndUpdate(
            req.params.id,
            { status: 'resolved', resolvedAt: new Date() },
            { new: true }
        );

        if (!message) {
            return res.status(404).json({ success: false, error: 'Message not found' });
        }

        res.json({ success: true, data: message });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Failed to update message' });
    }
};

/**
 * @desc    Delete message (Admin)
 * @route   DELETE /api/admin/contacts/:id
 * @access  Private (Super Admin)
 */
exports.deleteMessage = async (req, res) => {
    try {
        const message = await ContactMessage.findByIdAndDelete(req.params.id);

        if (!message) {
            return res.status(404).json({ success: false, error: 'Message not found' });
        }

        res.json({ success: true, message: 'Message deleted' });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Failed to delete message' });
    }
};
