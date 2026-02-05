const FxRate = require('../models/FxRate');

exports.listFx = async (req, res) => {
  try {
    const rates = await FxRate.find({ organization: req.user.organization }).sort({ date: -1 });
    res.json({ success: true, data: rates });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.upsertFx = async (req, res) => {
  try {
    const { baseCurrency, quoteCurrency, rate, date } = req.body;
    const doc = await FxRate.findOneAndUpdate(
      { organization: req.user.organization, baseCurrency, quoteCurrency, date },
      { rate },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json({ success: true, data: doc });
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
};


