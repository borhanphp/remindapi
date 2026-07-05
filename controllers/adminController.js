const Organization = require('../models/Organization');
const User = require('../models/User');
const OrganizationMembership = require('../models/OrganizationMembership');
const Subscription = require('../models/Subscription');
const ContactMessage = require('../models/ContactMessage');
const PaymentConfig = require('../models/PaymentConfig');
const AuditLog = require('../models/AuditLog');
const ApiError = require('../utils/ApiError');

// Helper: write an audit log entry
async function audit(req, type, action, extra = {}) {
    try {
        await AuditLog.create({
            type,
            action,
            user: req.user ? { _id: req.user._id, name: req.user.name, email: req.user.email } : undefined,
            organization: extra.organization,
            ip: req.ip || req.headers['x-forwarded-for'] || '',
            geo: extra.geo,
            status: extra.status || 200,
            meta: extra.meta,
            ts: new Date()
        });
    } catch (err) {
        console.error('[Audit] Failed to write audit log:', err.message);
    }
}

// ========================
// ORGANIZATION ENDPOINTS
// ========================

exports.getOrganizationStats = async (req, res, next) => {
    try {
        const [pending, approved, rejected, total] = await Promise.all([
            Organization.countDocuments({ approvalStatus: 'pending' }),
            Organization.countDocuments({ approvalStatus: 'approved' }),
            Organization.countDocuments({ approvalStatus: 'rejected' }),
            Organization.countDocuments()
        ]);

        res.json({ success: true, data: { pending, approved, rejected, total } });
    } catch (error) {
        next(error);
    }
};

exports.getOrganizations = async (req, res, next) => {
    try {
        const { page = 1, limit = 10, status, search } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const query = {};
        if (status && status !== 'all') query.approvalStatus = status;
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { slug: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }

        const [organizations, total] = await Promise.all([
            Organization.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            Organization.countDocuments(query)
        ]);

        // Attach owner info
        const orgIds = organizations.map(o => o._id);
        const owners = await User.find({
            organization: { $in: orgIds },
            $or: [{ isOwner: true }, { organizationRole: 'owner' }]
        }).select('name email isEmailVerified organization').lean();

        const ownerMap = {};
        owners.forEach(u => {
            ownerMap[u.organization.toString()] = { name: u.name, email: u.email, isEmailVerified: u.isEmailVerified };
        });

        const data = organizations.map(org => ({
            ...org,
            owner: ownerMap[org._id.toString()] || null
        }));

        res.json({
            success: true,
            data,
            meta: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        next(error);
    }
};

exports.getOrganizationById = async (req, res, next) => {
    try {
        const organization = await Organization.findById(req.params.id).lean();
        if (!organization) return next(new ApiError(404, 'Organization not found'));

        const users = await User.find({ organization: req.params.id })
            .select('name email isActive isOwner organizationRole isEmailVerified lastLogin createdAt')
            .lean();

        res.json({ success: true, data: { organization, users } });
    } catch (error) {
        next(error);
    }
};

exports.approveOrganization = async (req, res, next) => {
    try {
        const org = await Organization.findById(req.params.id);
        if (!org) return next(new ApiError(404, 'Organization not found'));

        org.approvalStatus = 'approved';
        org.approvedBy = req.user._id;
        org.approvedAt = new Date();
        org.rejectionReason = undefined;
        await org.save();

        await audit(req, 'org.approve', `Approved organization "${org.name}"`, {
            organization: { _id: org._id, name: org.name }
        });

        res.json({ success: true, data: org });
    } catch (error) {
        next(error);
    }
};

exports.rejectOrganization = async (req, res, next) => {
    try {
        const org = await Organization.findById(req.params.id);
        if (!org) return next(new ApiError(404, 'Organization not found'));

        org.approvalStatus = 'rejected';
        org.rejectionReason = req.body.reason || 'Rejected by admin';
        await org.save();

        await audit(req, 'org.reject', `Rejected organization "${org.name}"`, {
            organization: { _id: org._id, name: org.name }
        });

        res.json({ success: true, data: org });
    } catch (error) {
        next(error);
    }
};

exports.toggleOrganizationStatus = async (req, res, next) => {
    try {
        const org = await Organization.findById(req.params.id);
        if (!org) return next(new ApiError(404, 'Organization not found'));

        // Toggle isActive - default to true if field doesn't exist
        const wasActive = org.isActive !== false;
        org.isActive = !wasActive;
        await org.save();

        await audit(req, 'org.toggle-status', `${org.isActive ? 'Activated' : 'Deactivated'} organization "${org.name}"`, {
            organization: { _id: org._id, name: org.name }
        });

        res.json({ success: true, data: org });
    } catch (error) {
        next(error);
    }
};

exports.cancelOrganizationSubscription = async (req, res, next) => {
    try {
        const { reason } = req.body;
        const org = await Organization.findById(req.params.id);
        if (!org) return next(new ApiError(404, 'Organization not found'));

        org.subscription.status = 'cancelled';
        org.subscription.cancelledAt = new Date();
        org.subscription.cancellationReason = reason || 'Cancelled by admin';

        // Revert to free plan features
        org.subscription.plan = 'free';
        org.features = {
            maxInvoices: 3,
            emailReminders: true,
            basicReporting: true,
            automatedSchedule: false,
            prioritySupport: false,
            removeBranding: false
        };
        await org.save();

        // Update subscription record
        const sub = await Subscription.findOne({ organization: org._id });
        if (sub) {
            sub.status = 'cancelled';
            sub.cancelledAt = new Date();
            await sub.save();
        }

        await audit(req, 'org.cancel-subscription', `Cancelled subscription for "${org.name}"`, {
            organization: { _id: org._id, name: org.name }
        });

        res.json({ success: true, message: 'Subscription cancelled', data: org });
    } catch (error) {
        next(error);
    }
};

exports.deleteOrganization = async (req, res, next) => {
    try {
        const org = await Organization.findById(req.params.id);
        if (!org) return next(new ApiError(404, 'Organization not found'));

        const orgName = org.name;

        // Delete all related data
        await Promise.all([
            User.deleteMany({ organization: req.params.id }),
            OrganizationMembership.deleteMany({ organization: req.params.id }),
            Subscription.deleteMany({ organization: req.params.id }),
            Organization.findByIdAndDelete(req.params.id)
        ]);

        await audit(req, 'org.delete', `Deleted organization "${orgName}" and all its data`);

        res.json({ success: true, message: 'Organization and all data deleted' });
    } catch (error) {
        next(error);
    }
};

// ========================
// USER ENDPOINTS
// ========================

exports.getUsers = async (req, res, next) => {
    try {
        const { page = 1, limit = 20, search } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const query = { isSuperAdmin: { $ne: true } };
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }

        const [users, total] = await Promise.all([
            User.find(query)
                .select('name email isActive isOwner isSuperAdmin isEmailVerified lastLogin createdAt organization organizationRole')
                .populate('organization', 'name slug')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            User.countDocuments(query)
        ]);

        res.json({
            success: true,
            data: users,
            meta: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        next(error);
    }
};

exports.toggleUserStatus = async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return next(new ApiError(404, 'User not found'));
        if (user.isSuperAdmin) return next(new ApiError(403, 'Cannot modify super admin'));

        user.isActive = !user.isActive;
        await user.save({ validateBeforeSave: false });

        await audit(req, 'user.toggle-status', `${user.isActive ? 'Activated' : 'Deactivated'} user "${user.email}"`);

        res.json({ success: true, data: { _id: user._id, isActive: user.isActive } });
    } catch (error) {
        next(error);
    }
};

exports.deleteUser = async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return next(new ApiError(404, 'User not found'));
        if (user.isSuperAdmin) return next(new ApiError(403, 'Cannot delete super admin'));

        const email = user.email;

        await Promise.all([
            OrganizationMembership.deleteMany({ user: req.params.id }),
            User.findByIdAndDelete(req.params.id)
        ]);

        await audit(req, 'user.delete', `Deleted user "${email}"`);

        res.json({ success: true, message: 'User deleted' });
    } catch (error) {
        next(error);
    }
};

// ========================
// PRICING ENDPOINTS
// ========================

exports.getPricing = async (req, res, next) => {
    try {
        const config = await PaymentConfig.getConfig();

        // Build pricing response from org defaults + config
        const pricing = {
            free: {
                name: 'Free',
                price: 0,
                features: {
                    maxInvoices: config.freeMaxInvoices || 3
                }
            },
            pro: {
                name: 'Pro',
                price: config.proPrice || 19,
                annualPrice: config.proAnnualPrice || 179,
                features: {
                    maxInvoices: -1
                }
            }
        };

        res.json({ success: true, data: pricing });
    } catch (error) {
        next(error);
    }
};

exports.updatePricing = async (req, res, next) => {
    try {
        const { proPrice, proAnnualPrice, freeMaxInvoices } = req.body;

        const update = {};
        if (proPrice !== undefined) update.proPrice = proPrice;
        if (proAnnualPrice !== undefined) update.proAnnualPrice = proAnnualPrice;
        if (freeMaxInvoices !== undefined) update.freeMaxInvoices = freeMaxInvoices;

        const config = await PaymentConfig.findOneAndUpdate(
            { _singleton: 'payment_config' },
            { $set: update, updatedBy: req.user._id },
            { upsert: true, new: true }
        );

        await audit(req, 'pricing.update', 'Updated pricing configuration', {
            meta: { proPrice, proAnnualPrice, freeMaxInvoices }
        });

        const pricing = {
            free: {
                name: 'Free',
                price: 0,
                features: { maxInvoices: config.freeMaxInvoices || 3 }
            },
            pro: {
                name: 'Pro',
                price: config.proPrice || 19,
                annualPrice: config.proAnnualPrice || 179,
                features: { maxInvoices: -1 }
            }
        };

        res.json({ success: true, data: pricing, message: 'Pricing updated' });
    } catch (error) {
        next(error);
    }
};

exports.getProcessor = async (req, res, next) => {
    try {
        const config = await PaymentConfig.getConfig();

        // Mask sensitive tokens
        const masked = (val) => val ? '••••' + val.slice(-4) : '';

        res.json({
            success: true,
            data: {
                activeProcessor: config.activeProcessor,
                paddle: {
                    clientToken: masked(config.paddle?.clientToken),
                    proPriceId: config.paddle?.proPriceId || '',
                    proAnnualPriceId: config.paddle?.proAnnualPriceId || ''
                },
                polar: {
                    accessToken: masked(config.polar?.accessToken),
                    webhookSecret: masked(config.polar?.webhookSecret),
                    organizationId: config.polar?.organizationId || '',
                    proProductId: config.polar?.proProductId || '',
                    proAnnualProductId: config.polar?.proAnnualProductId || '',
                    environment: config.polar?.environment || 'sandbox'
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

exports.updateProcessor = async (req, res, next) => {
    try {
        const { activeProcessor, polar } = req.body;

        // Polar checkout/webhooks are not implemented — switching to it would
        // break upgrades for every customer. Config can still be saved.
        if (activeProcessor && activeProcessor !== 'paddle') {
            return res.status(400).json({
                success: false,
                error: `Processor '${activeProcessor}' is not available yet. Only 'paddle' is currently supported.`
            });
        }

        const update = {};
        if (activeProcessor) update.activeProcessor = activeProcessor;
        if (polar) {
            if (polar.accessToken) update['polar.accessToken'] = polar.accessToken;
            if (polar.webhookSecret) update['polar.webhookSecret'] = polar.webhookSecret;
            if (polar.organizationId) update['polar.organizationId'] = polar.organizationId;
            if (polar.proProductId) update['polar.proProductId'] = polar.proProductId;
            if (polar.proAnnualProductId) update['polar.proAnnualProductId'] = polar.proAnnualProductId;
            if (polar.environment) update['polar.environment'] = polar.environment;
        }

        await PaymentConfig.findOneAndUpdate(
            { _singleton: 'payment_config' },
            { $set: update, updatedBy: req.user._id },
            { upsert: true, new: true }
        );

        await audit(req, 'processor.update', `Switched payment processor to ${activeProcessor}`);

        res.json({
            success: true,
            data: { activeProcessor: activeProcessor || 'paddle' },
            message: 'Processor updated'
        });
    } catch (error) {
        next(error);
    }
};

// ========================
// AUDIT LOG ENDPOINTS
// ========================

exports.getAuditLogs = async (req, res, next) => {
    try {
        const { page = 1, limit = 20, hours = 24, type } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const since = new Date(Date.now() - parseInt(hours) * 60 * 60 * 1000);
        const query = { ts: { $gte: since } };
        if (type) query.type = type;

        const [logs, total] = await Promise.all([
            AuditLog.find(query)
                .sort({ ts: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            AuditLog.countDocuments(query)
        ]);

        res.json({
            success: true,
            data: logs,
            meta: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        next(error);
    }
};

exports.getAuditSummary = async (req, res, next) => {
    try {
        const { hours = 24 } = req.query;
        const since = new Date(Date.now() - parseInt(hours) * 60 * 60 * 1000);

        const logs = await AuditLog.find({ ts: { $gte: since } }).lean();

        const summary = {
            totalEvents: logs.length,
            totalSuccess: logs.filter(l => l.status >= 200 && l.status < 400).length,
            totalFailed: logs.filter(l => l.status >= 400).length,
            byType: {},
            byCountry: {},
            byOrganization: {}
        };

        logs.forEach(l => {
            summary.byType[l.type] = (summary.byType[l.type] || 0) + 1;
            if (l.geo?.country) {
                summary.byCountry[l.geo.country] = (summary.byCountry[l.geo.country] || 0) + 1;
            }
            if (l.organization?.name) {
                summary.byOrganization[l.organization.name] = (summary.byOrganization[l.organization.name] || 0) + 1;
            }
        });

        res.json({ success: true, data: summary });
    } catch (error) {
        next(error);
    }
};

// ========================
// CONTACT MESSAGE ENDPOINTS
// ========================

exports.getContacts = async (req, res, next) => {
    try {
        const { status } = req.query;
        const query = {};
        if (status && status !== 'all') query.status = status;

        const messages = await ContactMessage.find(query).sort({ createdAt: -1 }).lean();

        res.json({ success: true, data: messages });
    } catch (error) {
        next(error);
    }
};

exports.markContactRead = async (req, res, next) => {
    try {
        const message = await ContactMessage.findByIdAndUpdate(
            req.params.id,
            { status: 'read', readAt: new Date() },
            { new: true }
        );
        if (!message) return next(new ApiError(404, 'Message not found'));

        res.json({ success: true, data: message });
    } catch (error) {
        next(error);
    }
};

exports.markContactResolved = async (req, res, next) => {
    try {
        const message = await ContactMessage.findByIdAndUpdate(
            req.params.id,
            { status: 'resolved', resolvedAt: new Date() },
            { new: true }
        );
        if (!message) return next(new ApiError(404, 'Message not found'));

        res.json({ success: true, data: message });
    } catch (error) {
        next(error);
    }
};

exports.deleteContact = async (req, res, next) => {
    try {
        const message = await ContactMessage.findByIdAndDelete(req.params.id);
        if (!message) return next(new ApiError(404, 'Message not found'));

        res.json({ success: true, message: 'Message deleted' });
    } catch (error) {
        next(error);
    }
};
