const Client = require('../models/Client');
const InvoiceReminder = require('../models/InvoiceReminder');

exports.listClients = async (req, res) => {
  try {
    const { search, tag, page = 1, limit = 50 } = req.query;
    const query = { userId: req.user._id };

    if (search) {
      const re = new RegExp(search, 'i');
      query.$or = [{ name: re }, { email: re }, { company: re }];
    }
    if (tag) query.tags = tag;

    const skip = (Number(page) - 1) * Number(limit);
    const [clients, total] = await Promise.all([
      Client.find(query).sort({ name: 1 }).skip(skip).limit(Number(limit)),
      Client.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: clients,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getClient = async (req, res) => {
  try {
    const client = await Client.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });
    if (!client) return res.status(404).json({ success: false, error: 'Client not found' });

    const invoices = await InvoiceReminder.find({
      userId: req.user._id,
      clientEmail: client.email,
    }).sort({ createdAt: -1 });

    res.json({ success: true, data: { client, invoices } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.createClient = async (req, res) => {
  try {
    const { name, email, phone, company, address, notes, tags } = req.body;
    if (!name || !email) {
      return res.status(400).json({ success: false, error: 'Name and email are required' });
    }

    const existing = await Client.findOne({
      organization: req.user.organization,
      email: email.toLowerCase(),
    });
    if (existing) {
      return res.status(409).json({ success: false, error: 'Client with this email already exists' });
    }

    const invoiceStats = await InvoiceReminder.aggregate([
      { $match: { userId: req.user._id, clientEmail: email.toLowerCase() } },
      {
        $group: {
          _id: null,
          totalInvoices: { $sum: 1 },
          totalPaid: {
            $sum: { $cond: [{ $eq: ['$status', 'paid'] }, '$amount', 0] },
          },
          totalOutstanding: {
            $sum: { $cond: [{ $ne: ['$status', 'paid'] }, '$amount', 0] },
          },
          lastInvoiceDate: { $max: '$createdAt' },
        },
      },
    ]);

    const stats = invoiceStats[0] || {};

    const client = await Client.create({
      organization: req.user.organization,
      userId: req.user._id,
      name,
      email: email.toLowerCase(),
      phone,
      company,
      address,
      notes,
      tags,
      totalInvoices: stats.totalInvoices || 0,
      totalPaid: stats.totalPaid || 0,
      totalOutstanding: stats.totalOutstanding || 0,
      lastInvoiceDate: stats.lastInvoiceDate || null,
    });

    res.status(201).json({ success: true, data: client });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.updateClient = async (req, res) => {
  try {
    const { name, email, phone, company, address, notes, tags } = req.body;
    const client = await Client.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { name, email, phone, company, address, notes, tags },
      { new: true, runValidators: true }
    );
    if (!client) return res.status(404).json({ success: false, error: 'Client not found' });
    res.json({ success: true, data: client });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.deleteClient = async (req, res) => {
  try {
    const client = await Client.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id,
    });
    if (!client) return res.status(404).json({ success: false, error: 'Client not found' });
    res.json({ success: true, message: 'Client deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.searchClients = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) {
      return res.json({ success: true, data: [] });
    }
    const re = new RegExp(q, 'i');
    const clients = await Client.find({
      userId: req.user._id,
      $or: [{ name: re }, { email: re }, { company: re }],
    })
      .select('name email phone company')
      .limit(10)
      .sort({ name: 1 });

    res.json({ success: true, data: clients });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.syncClientStats = async (req, res) => {
  try {
    const clients = await Client.find({ userId: req.user._id });
    for (const client of clients) {
      const stats = await InvoiceReminder.aggregate([
        { $match: { userId: req.user._id, clientEmail: client.email } },
        {
          $group: {
            _id: null,
            totalInvoices: { $sum: 1 },
            totalPaid: {
              $sum: { $cond: [{ $eq: ['$status', 'paid'] }, '$amount', 0] },
            },
            totalOutstanding: {
              $sum: { $cond: [{ $ne: ['$status', 'paid'] }, '$amount', 0] },
            },
            lastInvoiceDate: { $max: '$createdAt' },
          },
        },
      ]);
      const s = stats[0] || {};
      client.totalInvoices = s.totalInvoices || 0;
      client.totalPaid = s.totalPaid || 0;
      client.totalOutstanding = s.totalOutstanding || 0;
      client.lastInvoiceDate = s.lastInvoiceDate || null;
      await client.save();
    }
    res.json({ success: true, message: `Synced ${clients.length} clients` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
