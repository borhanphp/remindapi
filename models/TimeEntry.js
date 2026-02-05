const mongoose = require('mongoose');

const TimeEntrySchema = new mongoose.Schema({
	organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true, required: true },
	project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', index: true, required: true },
	task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', index: true },
	user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, required: true },
	startTime: { type: Date, required: true },
	endTime: { type: Date },
	durationHours: { type: Number, default: 0 },
	notes: { type: String },
	billable: { type: Boolean, default: true },
	billingRate: { type: Number },
	billedAmount: { type: Number },
}, { timestamps: true });

module.exports = mongoose.model('TimeEntry', TimeEntrySchema);


