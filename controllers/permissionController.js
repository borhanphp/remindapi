const { PERMISSIONS } = require('../utils/permissions');
const Role = require('../models/Role');

exports.getRegistry = async (req, res, next) => {
  try {
    const keys = Object.keys(PERMISSIONS);
    const values = Object.values(PERMISSIONS);
    res.json({ success: true, data: { keys, values, map: PERMISSIONS } });
  } catch (e) { next(e); }
};

exports.getRolesDiff = async (req, res, next) => {
  try {
    const roles = await Role.find({ organization: req.user.organization }).lean();
    const all = new Set(Object.values(PERMISSIONS));
    const report = roles.map(r => {
      const perms = new Set(r.permissions || []);
      const missing = Array.from(all).filter(p => !perms.has(p));
      const unknown = Array.from(perms).filter(p => !all.has(p));
      return { roleId: r._id, name: r.name, missing, unknown, hasCount: perms.size };
    });
    res.json({ success: true, data: report });
  } catch (e) { next(e); }
};

