const crypto = require('crypto');
const Webhook = require('../models/Webhook');
const WebhookLog = require('../models/WebhookLog');

const VALID_EVENTS = [
  'invoice.created',
  'invoice.updated',
  'invoice.paid',
  'invoice.deleted',
  'reminder.sent',
  'invoice.viewed'
];

exports.listWebhooks = async (req, res) => {
  try {
    const webhooks = await Webhook.find({ organization: req.user.organization })
      .sort({ createdAt: -1 })
      .select('-secret');

    res.json({ success: true, data: webhooks });
  } catch (err) {
    console.error('List webhooks error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

exports.createWebhook = async (req, res) => {
  try {
    const { url, events, description } = req.body;

    if (!url || !events?.length) {
      return res.status(400).json({ success: false, error: 'URL and at least one event are required' });
    }

    try {
      new URL(url);
    } catch {
      return res.status(400).json({ success: false, error: 'Invalid URL' });
    }

    const invalidEvents = events.filter(e => !VALID_EVENTS.includes(e));
    if (invalidEvents.length) {
      return res.status(400).json({ success: false, error: `Invalid events: ${invalidEvents.join(', ')}` });
    }

    const existing = await Webhook.countDocuments({ organization: req.user.organization });
    if (existing >= 10) {
      return res.status(400).json({ success: false, error: 'Maximum 10 webhooks per organization' });
    }

    const secret = `whsec_${crypto.randomBytes(24).toString('hex')}`;

    const webhook = await Webhook.create({
      organization: req.user.organization,
      userId: req.user._id,
      url,
      events,
      description: description || '',
      secret
    });

    res.status(201).json({
      success: true,
      data: {
        _id: webhook._id,
        url: webhook.url,
        events: webhook.events,
        description: webhook.description,
        active: webhook.active,
        secret,
        createdAt: webhook.createdAt
      }
    });
  } catch (err) {
    console.error('Create webhook error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

exports.updateWebhook = async (req, res) => {
  try {
    const webhook = await Webhook.findOne({
      _id: req.params.id,
      organization: req.user.organization
    });

    if (!webhook) {
      return res.status(404).json({ success: false, error: 'Webhook not found' });
    }

    const { url, events, description, active } = req.body;

    if (url !== undefined) {
      try { new URL(url); } catch {
        return res.status(400).json({ success: false, error: 'Invalid URL' });
      }
      webhook.url = url;
    }

    if (events !== undefined) {
      const invalidEvents = events.filter(e => !VALID_EVENTS.includes(e));
      if (invalidEvents.length) {
        return res.status(400).json({ success: false, error: `Invalid events: ${invalidEvents.join(', ')}` });
      }
      webhook.events = events;
    }

    if (description !== undefined) webhook.description = description;

    if (active !== undefined) {
      webhook.active = active;
      if (active) webhook.failureCount = 0;
    }

    await webhook.save();

    const result = webhook.toObject();
    delete result.secret;
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('Update webhook error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

exports.deleteWebhook = async (req, res) => {
  try {
    const webhook = await Webhook.findOneAndDelete({
      _id: req.params.id,
      organization: req.user.organization
    });

    if (!webhook) {
      return res.status(404).json({ success: false, error: 'Webhook not found' });
    }

    await WebhookLog.deleteMany({ webhook: webhook._id });

    res.json({ success: true, data: {} });
  } catch (err) {
    console.error('Delete webhook error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

exports.getWebhookLogs = async (req, res) => {
  try {
    const webhook = await Webhook.findOne({
      _id: req.params.id,
      organization: req.user.organization
    });

    if (!webhook) {
      return res.status(404).json({ success: false, error: 'Webhook not found' });
    }

    const logs = await WebhookLog.find({ webhook: webhook._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .select('event statusCode success error duration createdAt');

    res.json({ success: true, data: logs });
  } catch (err) {
    console.error('Get webhook logs error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

exports.testWebhook = async (req, res) => {
  try {
    const webhook = await Webhook.findOne({
      _id: req.params.id,
      organization: req.user.organization
    });

    if (!webhook) {
      return res.status(404).json({ success: false, error: 'Webhook not found' });
    }

    const { dispatch } = require('../services/webhookService');

    await dispatch(req.user.organization, 'invoice.created', {
      _test: true,
      _id: '000000000000000000000000',
      clientName: 'Test Client',
      clientEmail: 'test@example.com',
      amount: 100,
      status: 'draft',
      dueDate: new Date().toISOString()
    });

    res.json({ success: true, message: 'Test event dispatched' });
  } catch (err) {
    console.error('Test webhook error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};
