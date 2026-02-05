const FxRate = require('../models/FxRate');

async function getRate({ organizationId, baseCurrency, quoteCurrency, onDate }) {
  if (!baseCurrency || !quoteCurrency || baseCurrency === quoteCurrency) return 1;
  const date = new Date(onDate || new Date());
  const rate = await FxRate.findOne({
    organization: organizationId,
    baseCurrency,
    quoteCurrency,
    date: { $lte: date }
  }).sort({ date: -1 });
  return rate?.rate || 1;
}

module.exports = { getRate };


