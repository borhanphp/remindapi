const mongoose = require('mongoose');

const periodLockSchema = new mongoose.Schema(
  {
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    status: { type: String, enum: ['open', 'locked'], default: 'open' },
    lockedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    lockedAt: { type: Date }
  },
  { timestamps: true }
);

periodLockSchema.index({ organization: 1, periodStart: 1, periodEnd: 1 }, { unique: true });

module.exports = mongoose.model('PeriodLock', periodLockSchema);


