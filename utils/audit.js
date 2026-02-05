const AuditLog = require('../models/AuditLog');

async function logAudit({ req, action, entityType, entityId, before, after, meta }) {
  try {
    const organization = req.user?.organization?._id || req.user?.organization;
    if (!organization) return;
    await AuditLog.create({
      organization,
      user: req.user?._id,
      action,
      entityType,
      entityId,
      before,
      after,
      meta,
      ip: req.ip
    });
  } catch (err) {
    // Do not block main flow on audit errors
    console.error('Audit log error:', err?.message);
  }
}

module.exports = { logAudit };


