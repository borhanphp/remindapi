const InvoiceSettings = require('../models/InvoiceSettings');
const path = require('path');
const storage = require('../utils/storage');

const LOGO_CONTENT_TYPES = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

exports.getBranding = async (req, res) => {
  try {
    const settings = await InvoiceSettings.findOne({ organization: req.user.organization });
    res.json({
      success: true,
      data: {
        logos: settings?.logos || {},
        lateFee: settings?.lateFee || { enabled: false, type: 'percentage', value: 0, gracePeriodDays: 0 },
        emailTemplates: settings?.emailTemplates || {},
        defaultNotes: settings?.defaultNotes || '',
        defaultTerms: settings?.defaultTerms || '',
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.updateBranding = async (req, res) => {
  try {
    const { lateFee, emailTemplates, defaultNotes, defaultTerms } = req.body;
    const update = {};

    if (lateFee !== undefined) update.lateFee = lateFee;
    if (emailTemplates !== undefined) update.emailTemplates = emailTemplates;
    if (defaultNotes !== undefined) update.defaultNotes = defaultNotes;
    if (defaultTerms !== undefined) update.defaultTerms = defaultTerms;
    update.updatedBy = req.user._id;

    const settings = await InvoiceSettings.findOneAndUpdate(
      { organization: req.user.organization },
      { $set: update },
      { new: true, upsert: true }
    );

    res.json({ success: true, data: settings });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.uploadLogo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const { position } = req.body;
    if (!['headerLogo', 'footerLogo'].includes(position)) {
      return res.status(400).json({ success: false, error: 'Position must be headerLogo or footerLogo' });
    }

    const ext = path.extname(req.file.originalname).toLowerCase();
    if (!LOGO_CONTENT_TYPES[ext]) {
      return res.status(400).json({ success: false, error: 'Only PNG, JPG, SVG, or WebP files allowed' });
    }

    const key = `branding/${req.user.organization}_${position}_${Date.now()}${ext}`;
    const logoUrl = await storage.uploadBuffer(key, req.file.buffer, LOGO_CONTENT_TYPES[ext]);

    // Clean up the previous logo for this slot
    const existing = await InvoiceSettings.findOne({ organization: req.user.organization });
    if (existing?.logos?.[position]) {
      await storage.deleteByUrl(existing.logos[position]);
    }

    await InvoiceSettings.findOneAndUpdate(
      { organization: req.user.organization },
      { $set: { [`logos.${position}`]: logoUrl, updatedBy: req.user._id } },
      { upsert: true }
    );

    res.json({ success: true, data: { url: logoUrl, position } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.deleteLogo = async (req, res) => {
  try {
    const { position } = req.params;
    if (!['headerLogo', 'footerLogo'].includes(position)) {
      return res.status(400).json({ success: false, error: 'Invalid position' });
    }

    const settings = await InvoiceSettings.findOne({ organization: req.user.organization });
    if (settings?.logos?.[position]) {
      await storage.deleteByUrl(settings.logos[position]);

      settings.logos[position] = null;
      settings.updatedBy = req.user._id;
      await settings.save();
    }

    res.json({ success: true, message: 'Logo removed' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
