const crypto = require('crypto');
const AccountingConnection = require('../models/AccountingConnection');
const InvoiceReminder = require('../models/InvoiceReminder');
const { generatePortalToken } = require('../utils/portalToken');
const { dispatch: dispatchWebhook } = require('../services/webhookService');

exports.getConnections = async (req, res) => {
  try {
    const connections = await AccountingConnection.find({
      organization: req.user.organization
    }).select('provider companyName active lastSyncAt syncCount lastError createdAt');

    res.json({ success: true, data: connections });
  } catch (err) {
    console.error('Get connections error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

exports.connectQuickBooks = async (req, res) => {
  try {
    if (!process.env.QB_CLIENT_ID) {
      return res.status(400).json({ success: false, error: 'QuickBooks integration not configured' });
    }

    const state = crypto.randomBytes(16).toString('hex');
    req.session = req.session || {};

    const stateData = JSON.stringify({
      userId: req.user._id.toString(),
      orgId: req.user.organization.toString(),
      random: state
    });
    const stateToken = Buffer.from(stateData).toString('base64url');

    const qb = require('../services/quickbooksService');
    const url = qb.getAuthUrl(stateToken);

    res.json({ success: true, data: { authUrl: url } });
  } catch (err) {
    console.error('Connect QB error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

exports.quickbooksCallback = async (req, res) => {
  try {
    const { code, state, realmId } = req.query;

    if (!code || !state || !realmId) {
      return res.redirect(`${process.env.FRONTEND_URL}/settings/integrations?error=missing_params`);
    }

    let stateData;
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64url').toString());
    } catch {
      return res.redirect(`${process.env.FRONTEND_URL}/settings/integrations?error=invalid_state`);
    }

    const qb = require('../services/quickbooksService');
    const tokens = await qb.exchangeCode(code);

    const existing = await AccountingConnection.findOne({
      organization: stateData.orgId,
      provider: 'quickbooks'
    });

    if (existing) {
      existing.accessToken = tokens.access_token;
      existing.refreshToken = tokens.refresh_token;
      existing.tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);
      existing.realmId = realmId;
      existing.active = true;
      existing.lastError = undefined;
      await existing.save();

      const companyName = await qb.getCompanyInfo(existing);
      if (companyName) {
        existing.companyName = companyName;
        await existing.save();
      }
    } else {
      const conn = await AccountingConnection.create({
        organization: stateData.orgId,
        userId: stateData.userId,
        provider: 'quickbooks',
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        realmId
      });

      const companyName = await qb.getCompanyInfo(conn);
      if (companyName) {
        conn.companyName = companyName;
        await conn.save();
      }
    }

    res.redirect(`${process.env.FRONTEND_URL}/settings/integrations?connected=quickbooks`);
  } catch (err) {
    console.error('QB callback error:', err);
    res.redirect(`${process.env.FRONTEND_URL}/settings/integrations?error=connection_failed`);
  }
};

exports.connectXero = async (req, res) => {
  try {
    if (!process.env.XERO_CLIENT_ID) {
      return res.status(400).json({ success: false, error: 'Xero integration not configured' });
    }

    const state = crypto.randomBytes(16).toString('hex');
    const stateData = JSON.stringify({
      userId: req.user._id.toString(),
      orgId: req.user.organization.toString(),
      random: state
    });
    const stateToken = Buffer.from(stateData).toString('base64url');

    const xero = require('../services/xeroService');
    const url = xero.getAuthUrl(stateToken);

    res.json({ success: true, data: { authUrl: url } });
  } catch (err) {
    console.error('Connect Xero error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

exports.xeroCallback = async (req, res) => {
  try {
    const { code, state } = req.query;

    if (!code || !state) {
      return res.redirect(`${process.env.FRONTEND_URL}/settings/integrations?error=missing_params`);
    }

    let stateData;
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64url').toString());
    } catch {
      return res.redirect(`${process.env.FRONTEND_URL}/settings/integrations?error=invalid_state`);
    }

    const xero = require('../services/xeroService');
    const tokens = await xero.exchangeCode(code);
    const tenantId = await xero.getTenantId(tokens.access_token);

    if (!tenantId) {
      return res.redirect(`${process.env.FRONTEND_URL}/settings/integrations?error=no_tenant`);
    }

    const existing = await AccountingConnection.findOne({
      organization: stateData.orgId,
      provider: 'xero'
    });

    if (existing) {
      existing.accessToken = tokens.access_token;
      existing.refreshToken = tokens.refresh_token;
      existing.tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);
      existing.tenantId = tenantId;
      existing.active = true;
      existing.lastError = undefined;
      await existing.save();

      const orgName = await xero.getOrganisationName(existing);
      if (orgName) {
        existing.companyName = orgName;
        await existing.save();
      }
    } else {
      const conn = await AccountingConnection.create({
        organization: stateData.orgId,
        userId: stateData.userId,
        provider: 'xero',
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        tenantId
      });

      const orgName = await xero.getOrganisationName(conn);
      if (orgName) {
        conn.companyName = orgName;
        await conn.save();
      }
    }

    res.redirect(`${process.env.FRONTEND_URL}/settings/integrations?connected=xero`);
  } catch (err) {
    console.error('Xero callback error:', err);
    res.redirect(`${process.env.FRONTEND_URL}/settings/integrations?error=connection_failed`);
  }
};

exports.syncInvoices = async (req, res) => {
  try {
    const { provider } = req.params;

    if (!['quickbooks', 'xero'].includes(provider)) {
      return res.status(400).json({ success: false, error: 'Invalid provider' });
    }

    const connection = await AccountingConnection.findOne({
      organization: req.user.organization,
      provider,
      active: true
    });

    if (!connection) {
      return res.status(404).json({ success: false, error: `No active ${provider} connection` });
    }

    const service = provider === 'quickbooks'
      ? require('../services/quickbooksService')
      : require('../services/xeroService');

    const invoices = await service.fetchInvoices(connection, connection.lastSyncAt);

    let imported = 0;
    let skipped = 0;

    for (const inv of invoices) {
      if (!inv.clientEmail) {
        skipped++;
        continue;
      }

      const exists = await InvoiceReminder.findOne({
        userId: req.user._id,
        invoiceNumber: inv.invoiceNumber,
        clientEmail: inv.clientEmail
      });

      if (exists) {
        skipped++;
        continue;
      }

      const reminder = await InvoiceReminder.create({
        userId: req.user._id,
        clientName: inv.clientName,
        clientEmail: inv.clientEmail,
        invoiceNumber: inv.invoiceNumber,
        amount: inv.amount,
        dueDate: inv.dueDate,
        status: inv.status,
        reminderChannels: ['email']
      });

      reminder.portalToken = generatePortalToken(reminder._id);
      await reminder.save();

      dispatchWebhook(req.user.organization, 'invoice.created', reminder.toObject()).catch(() => {});

      imported++;
    }

    connection.lastSyncAt = new Date();
    connection.syncCount += 1;
    connection.lastError = undefined;
    await connection.save();

    res.json({
      success: true,
      data: { imported, skipped, total: invoices.length }
    });
  } catch (err) {
    console.error('Sync invoices error:', err);

    const connection = await AccountingConnection.findOne({
      organization: req.user.organization,
      provider: req.params.provider
    });
    if (connection) {
      connection.lastError = err.message;
      await connection.save();
    }

    res.status(500).json({ success: false, error: err.message || 'Sync failed' });
  }
};

exports.disconnect = async (req, res) => {
  try {
    const { provider } = req.params;

    const connection = await AccountingConnection.findOneAndDelete({
      organization: req.user.organization,
      provider
    });

    if (!connection) {
      return res.status(404).json({ success: false, error: 'Connection not found' });
    }

    res.json({ success: true, message: `${provider} disconnected` });
  } catch (err) {
    console.error('Disconnect error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};
