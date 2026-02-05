const mongoose = require('mongoose');

const fxRateSchema = new mongoose.Schema({
  baseCurrency: {
    type: String,
    required: true,
    trim: true
  },
  quoteCurrency: {
    type: String,
    required: true,
    trim: true
  },
  rate: {
    type: Number,
    required: true,
    min: 0
  },
  date: {
    type: Date,
    required: true
  },
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization'
  }
}, { timestamps: true });

fxRateSchema.index({ organization: 1, baseCurrency: 1, quoteCurrency: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('FxRate', fxRateSchema);


