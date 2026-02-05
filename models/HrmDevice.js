const mongoose = require('mongoose');

const HrmDeviceSchema = new mongoose.Schema({
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true, required: true },
  name: { type: String, required: true },
  apiKey: { type: String, required: true, unique: true, index: true },
  active: { type: Boolean, default: true },
  allowedIps: [{ type: String }]
}, { timestamps: true });

module.exports = mongoose.model('HrmDevice', HrmDeviceSchema);


