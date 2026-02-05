const mongoose = require('mongoose');

const dunningScheduleSchema = new mongoose.Schema(
  {
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
    type: { type: String, enum: ['AR', 'AP'], default: 'AR' },
    name: { type: String, required: true },
    steps: [
      {
        daysOverdueFrom: { type: Number, required: true },
        daysOverdueTo: { type: Number, required: true },
        emailSubject: { type: String, required: true },
        emailTemplate: { type: String, required: true }
      }
    ],
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('DunningSchedule', dunningScheduleSchema);


