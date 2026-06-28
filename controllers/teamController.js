const User = require('../models/User');
const Organization = require('../models/Organization');
const OrganizationMembership = require('../models/OrganizationMembership');
const Role = require('../models/Role');
const crypto = require('crypto');
const sendEmail = require('../utils/sendEmail');

exports.getTeamMembers = async (req, res) => {
    try {
        const orgId = req.user.organization;
        if (!orgId) {
            return res.json({ success: true, data: [] });
        }

        const org = await Organization.findById(orgId);
        const maxUsers = org?.features?.maxUsers || 1;

        const memberships = await OrganizationMembership.find({
            organization: orgId,
            isActive: true
        }).populate('user', 'name email plan createdAt').populate('role', 'name');

        const members = memberships.map(m => ({
            _id: m._id,
            userId: m.user?._id,
            name: m.user?.name,
            email: m.user?.email,
            role: m.role?.name || 'member',
            joinedAt: m.joinedAt,
            isOwner: m.user?._id?.toString() === req.user._id.toString()
        }));

        const pendingInvites = await User.find({
            organization: orgId,
            isVerified: false,
            inviteToken: { $exists: true, $ne: null }
        }).select('name email inviteToken createdAt');

        res.json({
            success: true,
            data: {
                members,
                pendingInvites: pendingInvites.map(u => ({
                    _id: u._id,
                    name: u.name,
                    email: u.email,
                    invitedAt: u.createdAt
                })),
                maxUsers,
                currentCount: members.length + pendingInvites.length
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Server Error' });
    }
};

exports.inviteMember = async (req, res) => {
    try {
        const { email, name } = req.body;
        if (!email) {
            return res.status(400).json({ success: false, error: 'Email is required' });
        }

        const orgId = req.user.organization;
        if (!orgId) {
            return res.status(400).json({ success: false, error: 'No organization found' });
        }

        const org = await Organization.findById(orgId);
        const plan = org?.subscription?.plan;
        if (plan !== 'team') {
            return res.status(403).json({ success: false, error: 'Team plan required to invite members' });
        }

        const maxUsers = org?.features?.maxUsers || 5;
        const currentMembers = await OrganizationMembership.countDocuments({
            organization: orgId,
            isActive: true
        });
        const pendingInvites = await User.countDocuments({
            organization: orgId,
            isVerified: false,
            inviteToken: { $exists: true, $ne: null }
        });

        if (currentMembers + pendingInvites >= maxUsers) {
            return res.status(400).json({
                success: false,
                error: `Team member limit reached (${maxUsers}). Upgrade for more seats.`
            });
        }

        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            const existingMembership = await OrganizationMembership.findOne({
                user: existingUser._id,
                organization: orgId
            });
            if (existingMembership) {
                return res.status(400).json({ success: false, error: 'User is already a team member' });
            }
        }

        const inviteToken = crypto.randomBytes(32).toString('hex');

        let memberRole = await Role.findOne({ name: 'member', organization: orgId });
        if (!memberRole) {
            memberRole = await Role.findOne({ name: 'member' });
        }
        if (!memberRole) {
            memberRole = await Role.create({
                name: 'member',
                organization: orgId,
                permissions: ['invoices:read', 'invoices:create', 'invoices:update']
            });
        }

        let user;
        if (existingUser) {
            existingUser.organization = orgId;
            existingUser.plan = plan;
            existingUser.inviteToken = inviteToken;
            await existingUser.save();
            user = existingUser;

            await OrganizationMembership.create({
                user: existingUser._id,
                organization: orgId,
                role: memberRole._id,
                invitedBy: req.user._id
            });
        } else {
            user = await User.create({
                name: name || email.split('@')[0],
                email: email.toLowerCase(),
                password: crypto.randomBytes(16).toString('hex'),
                organization: orgId,
                role: memberRole._id,
                plan,
                subscriptionStatus: 'active',
                isVerified: false,
                inviteToken,
                invitedBy: req.user._id
            });

            await OrganizationMembership.create({
                user: user._id,
                organization: orgId,
                role: memberRole._id,
                invitedBy: req.user._id
            });
        }

        const inviteUrl = `${process.env.FRONTEND_URL}/accept-invite/${inviteToken}`;
        const inviterName = req.user.companyName || req.user.name;

        await sendEmail({
            to: email,
            subject: `You've been invited to ${inviterName}'s team on ZeeRemind`,
            text: `Hi${name ? ` ${name}` : ''},\n\n${inviterName} has invited you to join their team on ZeeRemind.\n\nAccept your invitation here:\n${inviteUrl}\n\nThis link will expire in 7 days.\n\nBest,\nThe ZeeRemind Team`,
            html: `<p>Hi${name ? ` ${name}` : ''},</p>
<p><strong>${inviterName}</strong> has invited you to join their team on ZeeRemind.</p>
<p style="margin: 20px 0;"><a href="${inviteUrl}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Accept Invitation</a></p>
<p style="color: #666; font-size: 14px;">This link will expire in 7 days.</p>
<p>Best,<br>The ZeeRemind Team</p>`
        });

        res.status(201).json({
            success: true,
            message: `Invitation sent to ${email}`
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: err.message || 'Server Error' });
    }
};

exports.removeMember = async (req, res) => {
    try {
        const { memberId } = req.params;
        const orgId = req.user.organization;

        const membership = await OrganizationMembership.findById(memberId).populate('user');
        if (!membership || membership.organization.toString() !== orgId.toString()) {
            return res.status(404).json({ success: false, error: 'Member not found' });
        }

        if (membership.user._id.toString() === req.user._id.toString()) {
            return res.status(400).json({ success: false, error: 'Cannot remove yourself' });
        }

        membership.isActive = false;
        await membership.save();

        if (membership.user) {
            membership.user.organization = null;
            membership.user.plan = 'free';
            await membership.user.save();
        }

        res.json({ success: true, message: 'Member removed' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Server Error' });
    }
};

exports.cancelInvite = async (req, res) => {
    try {
        const { userId } = req.params;
        const orgId = req.user.organization;

        const user = await User.findById(userId);
        if (!user || user.organization?.toString() !== orgId.toString()) {
            return res.status(404).json({ success: false, error: 'Invite not found' });
        }

        await OrganizationMembership.deleteOne({ user: userId, organization: orgId });
        await User.deleteOne({ _id: userId });

        res.json({ success: true, message: 'Invite cancelled' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Server Error' });
    }
};
