const AuditLog = require('../models/AuditLog');
const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');

// @desc    Get audit logs with admin filters
// @route   GET /api/admin/audit/log
// @access  Private (Admin)
exports.getAuditLogs = asyncHandler(async (req, res, next) => {
  const {
    page = 1,
    limit = 50,
    type,
    country,
    org,
    q,
    hours = 24,
    format
  } = req.query;

  // Build query
  const query = {};
  
  // Filter by organization if provided
  if (org) {
    query.organization = org;
  }
  
  // Filter by action/type
  if (type) {
    query.action = type;
  }
  
  // Filter by time range (hours)
  if (hours) {
    const hoursAgo = new Date(Date.now() - hours * 60 * 60 * 1000);
    query.createdAt = { $gte: hoursAgo };
  }
  
  // Text search across multiple fields
  if (q) {
    query.$or = [
      { action: { $regex: q, $options: 'i' } },
      { entityType: { $regex: q, $options: 'i' } },
      { ip: { $regex: q, $options: 'i' } }
    ];
  }
  
  // Filter by country (from meta.geo.country)
  if (country) {
    query['meta.geo.country'] = { $regex: country, $options: 'i' };
  }

  // CSV Export
  if (format === 'csv') {
    const logs = await AuditLog.find(query)
      .sort({ createdAt: -1 })
      .populate('user', 'name email')
      .populate('organization', 'name')
      .lean();

    // Generate CSV
    const csv = generateCSV(logs);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=audit-logs.csv');
    return res.send(csv);
  }

  // Regular JSON response with pagination
  const skip = (Number(page) - 1) * Number(limit);
  
  const [items, total] = await Promise.all([
    AuditLog.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate('user', 'name email')
      .populate('organization', 'name')
      .lean(),
    AuditLog.countDocuments(query)
  ]);

  // Transform data to match frontend expectations
  const transformedItems = items.map(item => ({
    ts: new Date(item.createdAt).toISOString(),
    type: item.action,
    org: item.organization?.name || item.organization,
    ip: item.ip || item.meta?.ip || '-',
    geo: item.meta?.geo || {},
    status: item.meta?.status || item.meta?.statusCode || 200,
    ...item
  }));

  res.json({
    success: true,
    data: transformedItems,
    meta: {
      total,
      page: Number(page),
      limit: Number(limit)
    }
  });
});

// @desc    Get audit summary with statistics
// @route   GET /api/admin/audit/summary
// @access  Private (Admin)
exports.getAuditSummary = asyncHandler(async (req, res, next) => {
  const { hours = 24, format } = req.query;

  // Time range filter
  const hoursAgo = new Date(Date.now() - hours * 60 * 60 * 1000);
  const query = { createdAt: { $gte: hoursAgo } };

  // Get all logs within time range
  const logs = await AuditLog.find(query)
    .populate('organization', 'name')
    .lean();

  // Calculate statistics
  const summary = {
    totalEvents: logs.length,
    totalSuccess: logs.filter(log => {
      const status = log.meta?.status || log.meta?.statusCode || 200;
      return status >= 200 && status < 300;
    }).length,
    totalFailed: logs.filter(log => {
      const status = log.meta?.status || log.meta?.statusCode || 200;
      return status >= 400;
    }).length,
    byType: {},
    byCountry: {},
    byOrganization: {}
  };

  // Count by type/action
  logs.forEach(log => {
    const type = log.action;
    summary.byType[type] = (summary.byType[type] || 0) + 1;

    // Count by country
    const country = log.meta?.geo?.country || log.meta?.geo?.country_name || 'Unknown';
    summary.byCountry[country] = (summary.byCountry[country] || 0) + 1;

    // Count by organization
    const orgName = log.organization?.name || 'Unknown';
    summary.byOrganization[orgName] = (summary.byOrganization[orgName] || 0) + 1;
  });

  // CSV Export
  if (format === 'csv') {
    const csv = generateSummaryCSV(summary);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=audit-summary.csv');
    return res.send(csv);
  }

  res.json({
    success: true,
    data: summary
  });
});

// Helper function to generate CSV from logs
function generateCSV(logs) {
  const headers = ['Timestamp', 'Type', 'Organization', 'User', 'IP', 'Country', 'Status', 'Entity Type', 'Action'];
  const rows = logs.map(log => [
    new Date(log.createdAt).toISOString(),
    log.action,
    log.organization?.name || '-',
    log.user?.name || '-',
    log.ip || log.meta?.ip || '-',
    log.meta?.geo?.country || log.meta?.geo?.country_name || '-',
    log.meta?.status || log.meta?.statusCode || '-',
    log.entityType || '-',
    log.action
  ]);

  return [headers, ...rows]
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\n');
}

// Helper function to generate summary CSV
function generateSummaryCSV(summary) {
  let csv = 'Metric,Value\n';
  csv += `Total Events,${summary.totalEvents}\n`;
  csv += `Total Success,${summary.totalSuccess}\n`;
  csv += `Total Failed,${summary.totalFailed}\n\n`;
  
  csv += 'Event Type,Count\n';
  Object.entries(summary.byType).forEach(([type, count]) => {
    csv += `"${type}",${count}\n`;
  });
  
  csv += '\nCountry,Count\n';
  Object.entries(summary.byCountry)
    .sort((a, b) => b[1] - a[1])
    .forEach(([country, count]) => {
      csv += `"${country}",${count}\n`;
    });

  return csv;
}

// @desc    Create audit log entry
// @route   POST /api/admin/audit/log
// @access  Private (Admin)
exports.createAuditLog = asyncHandler(async (req, res, next) => {
  const {
    action,
    entityType,
    entityId,
    before,
    after,
    meta
  } = req.body;

  // Validate required fields
  if (!action || !entityType) {
    return next(new ErrorResponse('Action and entityType are required', 400));
  }

  const auditLog = await AuditLog.create({
    organization: req.user.organization,
    user: req.user._id,
    action,
    entityType,
    entityId,
    before,
    after,
    meta: {
      ...meta,
      ip: req.ip || req.connection?.remoteAddress
    },
    ip: req.ip || req.connection?.remoteAddress
  });

  res.status(201).json({
    success: true,
    data: auditLog
  });
});

