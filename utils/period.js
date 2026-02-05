const PeriodLock = require('../models/PeriodLock');

async function isDateLocked(organizationId, date) {
  const d = new Date(date);
  const lock = await PeriodLock.findOne({
    organization: organizationId,
    status: 'locked',
    periodStart: { $lte: d },
    periodEnd: { $gte: d }
  });
  return !!lock;
}

module.exports = { isDateLocked };


