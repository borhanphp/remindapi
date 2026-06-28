const InvoiceSettings = require('../models/InvoiceSettings');
const path = require('path');
const fs = require('fs');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'branding');

function ensureUploadDir() {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
}

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
    ensureUploadDir();

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const { position } = req.body;
    if (!['headerLogo', 'footerLogo'].includes(position)) {
      return res.status(400).json({ success: false, error: 'Position must be headerLogo or footerLogo' });
    }

    const ext = path.extname(req.file.originalname).toLowerCase();
    if (!['.png', '.jpg', '.jpeg', '.svg', '.webp'].includes(ext)) {
      return res.status(400).json({ success: false, error: 'Only PNG, JPG, SVG, or WebP files allowed' });
    }

    const filename = `${req.user.organization}_${position}_${Date.now()}${ext}`;
    const filepath = path.join(UPLOAD_DIR, filename);
    fs.writeFileSync(filepath, req.file.buffer);

    const logoUrl = `/uploads/branding/${filename}`;

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
      const filepath = path.join(__dirname, '..', settings.logos[position]);
      if (fs.existsSync(filepath)) fs.unlinkSync(filepath);

      settings.logos[position] = null;
      settings.updatedBy = req.user._id;
      await settings.save();
    }

    res.json({ success: true, message: 'Logo removed' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
