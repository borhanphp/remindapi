const mongoose = require('mongoose');
const Ledger = require('../models/Ledger');
const ChartOfAccount = require('../models/ChartOfAccount');
const Organization = require('../models/Organization');
const { getRate } = require('../utils/fx');
const AccountingService = require('../services/accountingService');

// Helper to find account by code and org
async function findAccountByCode(orgId, code) {
  return ChartOfAccount.findOne({ organization: orgId, accountCode: code });
}

exports.runRevaluation = async (req, res, next) => {
  try {
    const orgId = req.user.organization;
    const {
      asOfDate,
      scope = ['AR', 'AP', 'CASH'],
      arAccountCode = '1200',
      apAccountCode = '2000',
      cashAccountCodes = ['1000', '1010'],
      unrealizedGainCode,
      unrealizedLossCode,
      createReversal = true
    } = req.body || {};

    const date = asOfDate ? new Date(asOfDate) : new Date();
    const org = await Organization.findById(orgId).select('settings.currency');
    const baseCurrency = org?.settings?.currency || 'USD';

    // Resolve required accounts
    const [arAccount, apAccount, ...cashAccounts] = await Promise.all([
      scope.includes('AR') ? findAccountByCode(orgId, arAccountCode) : Promise.resolve(null),
      scope.includes('AP') ? findAccountByCode(orgId, apAccountCode) : Promise.resolve(null),
      ...cashAccountCodes.map((c) => scope.includes('CASH') ? findAccountByCode(orgId, c) : Promise.resolve(null))
    ]);

    if (scope.includes('AR') && !arAccount) {
      return res.status(400).json({ success: false, message: `AR account not found for code ${arAccountCode}` });
    }
    if (scope.includes('AP') && !apAccount) {
      return res.status(400).json({ success: false, message: `AP account not found for code ${apAccountCode}` });
    }
    const cashAccountIds = cashAccounts.filter(Boolean).map(a => a._id);

    // FX P&L accounts
    // Try defaults if not provided
    let [gainAccount, lossAccount] = await Promise.all([
      unrealizedGainCode ? findAccountByCode(orgId, unrealizedGainCode) : ChartOfAccount.findOne({ organization: orgId, accountName: /unrealized fx gain/i }),
      unrealizedLossCode ? findAccountByCode(orgId, unrealizedLossCode) : ChartOfAccount.findOne({ organization: orgId, accountName: /unrealized fx loss/i })
    ]);
    if (!gainAccount || !lossAccount) {
      return res.status(400).json({ success: false, message: 'Configure unrealized FX Gain and Loss accounts or provide their codes in the request.' });
    }

    const adjustments = [];

    // Revalue AR
    if (scope.includes('AR')) {
      const rows = await Ledger.aggregate([
        { $match: { organization: new mongoose.Types.ObjectId(orgId), account: arAccount._id, entryDate: { $lte: date } } },
        { $group: {
          _id: '$transactionCurrency',
          foreign: { $sum: { $subtract: ['$transactionDebit', '$transactionCredit'] } },
          base: { $sum: { $subtract: ['$debitAmount', '$creditAmount'] } }
        } }
      ]);
      for (const r of rows) {
        if (!r._id || r._id === baseCurrency) continue;
        const fx = await getRate({ organizationId: orgId, baseCurrency: r._id, quoteCurrency: baseCurrency, onDate: date });
        const revalued = r.foreign * fx;
        const delta = revalued - r.base;
        if (Math.abs(delta) < 0.005) continue;
        // delta > 0 => DR AR, CR Unrealized FX Gain; delta < 0 => DR Unrealized FX Loss, CR AR
        const lines = delta > 0 ? [
          { account: arAccount._id, debitAmount: Math.abs(delta), creditAmount: 0 },
          { account: gainAccount._id, debitAmount: 0, creditAmount: Math.abs(delta) }
        ] : [
          { account: lossAccount._id, debitAmount: Math.abs(delta), creditAmount: 0 },
          { account: arAccount._id, debitAmount: 0, creditAmount: Math.abs(delta) }
        ];
        adjustments.push({ currency: r._id, lines, description: `AR FX Revaluation ${r._id} as of ${date.toISOString().slice(0,10)}` });
      }
    }

    // Revalue AP
    if (scope.includes('AP')) {
      const rows = await Ledger.aggregate([
        { $match: { organization: new mongoose.Types.ObjectId(orgId), account: apAccount._id, entryDate: { $lte: date } } },
        { $group: {
          _id: '$transactionCurrency',
          foreign: { $sum: { $subtract: ['$transactionCredit', '$transactionDebit'] } },
          base: { $sum: { $subtract: ['$creditAmount', '$debitAmount'] } }
        } }
      ]);
      for (const r of rows) {
        if (!r._id || r._id === baseCurrency) continue;
        const fx = await getRate({ organizationId: orgId, baseCurrency: r._id, quoteCurrency: baseCurrency, onDate: date });
        const revalued = r.foreign * fx;
        const delta = revalued - r.base; // positive => liability increased => loss
        if (Math.abs(delta) < 0.005) continue;
        // For AP: delta > 0 => DR Unrealized FX Loss, CR AP; delta < 0 => DR AP, CR Unrealized FX Gain
        const lines = delta > 0 ? [
          { account: lossAccount._id, debitAmount: Math.abs(delta), creditAmount: 0 },
          { account: apAccount._id, debitAmount: 0, creditAmount: Math.abs(delta) }
        ] : [
          { account: apAccount._id, debitAmount: Math.abs(delta), creditAmount: 0 },
          { account: gainAccount._id, debitAmount: 0, creditAmount: Math.abs(delta) }
        ];
        adjustments.push({ currency: r._id, lines, description: `AP FX Revaluation ${r._id} as of ${date.toISOString().slice(0,10)}` });
      }
    }

    // Revalue CASH
    if (scope.includes('CASH') && cashAccountIds.length > 0) {
      const rows = await Ledger.aggregate([
        { $match: { organization: new mongoose.Types.ObjectId(orgId), account: { $in: cashAccountIds }, entryDate: { $lte: date } } },
        { $group: {
          _id: '$transactionCurrency',
          foreign: { $sum: { $subtract: ['$transactionDebit', '$transactionCredit'] } },
          base: { $sum: { $subtract: ['$debitAmount', '$creditAmount'] } }
        } }
      ]);
      for (const r of rows) {
        if (!r._id || r._id === baseCurrency) continue;
        const fx = await getRate({ organizationId: orgId, baseCurrency: r._id, quoteCurrency: baseCurrency, onDate: date });
        const revalued = r.foreign * fx;
        const delta = revalued - r.base;
        if (Math.abs(delta) < 0.005) continue;
        // Cash is asset similar to AR: delta > 0 => DR Cash, CR Unrealized FX Gain; delta < 0 => DR Unrealized FX Loss, CR Cash
        // Split across cash accounts proportionally could be done; we post to a generic cash account (first provided)
        const cashAccount = cashAccounts.find(Boolean);
        if (!cashAccount) continue;
        const lines = delta > 0 ? [
          { account: cashAccount._id, debitAmount: Math.abs(delta), creditAmount: 0 },
          { account: gainAccount._id, debitAmount: 0, creditAmount: Math.abs(delta) }
        ] : [
          { account: lossAccount._id, debitAmount: Math.abs(delta), creditAmount: 0 },
          { account: cashAccount._id, debitAmount: 0, creditAmount: Math.abs(delta) }
        ];
        adjustments.push({ currency: r._id, lines, description: `Cash FX Revaluation ${r._id} as of ${date.toISOString().slice(0,10)}` });
      }
    }

    const createdEntries = [];
    for (const adj of adjustments) {
      const entryData = {
        entryDate: date,
        description: adj.description,
        journalLines: adj.lines,
        organization: orgId,
        currency: baseCurrency,
        exchangeRate: 1,
        sourceDocument: { documentType: 'FXRevaluation' }
      };
      const je = await AccountingService.createJournalEntry(entryData, req.user._id);
      createdEntries.push(je);

      if (createReversal) {
        const reversalData = {
          entryDate: new Date(date.getTime() + 24*60*60*1000),
          description: `${adj.description} - Reversal`,
          journalLines: adj.lines.map(l => ({ account: l.account, debitAmount: l.creditAmount, creditAmount: l.debitAmount })),
          organization: orgId,
          currency: baseCurrency,
          exchangeRate: 1,
          sourceDocument: { documentType: 'FXRevaluationReversal' }
        };
        const revJe = await AccountingService.createJournalEntry(reversalData, req.user._id);
        createdEntries.push(revJe);
      }
    }

    res.json({ success: true, data: { count: createdEntries.length, entries: createdEntries.map(e => ({ id: e._id, entryNumber: e.entryNumber })) } });
  } catch (err) {
    next(err);
  }
};


