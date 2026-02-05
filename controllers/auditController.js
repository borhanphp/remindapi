const AuditLog = require('../models/AuditLog');

exports.listAuditLogs = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, entityType, entityId, startDate, endDate, action } = req.query;
    const query = { organization: req.user.organization };
    if (entityType) query.entityType = entityType;
    if (entityId) query.entityId = entityId;
    if (action) query.action = action;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    const [items, total] = await Promise.all([
      AuditLog.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .populate('user', 'name email')
        .lean(),
      AuditLog.countDocuments(query)
    ]);
    res.json({ success: true, data: items, meta: { total, page: Number(page), limit: Number(limit) } });
  } catch (err) { next(err); }
};


