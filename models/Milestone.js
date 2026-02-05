const mongoose = require('mongoose');

const MilestoneSchema = new mongoose.Schema({
	organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true, required: true },
	project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', index: true, required: true },
	name: { type: String, required: true },
	description: { type: String },
	startDate: { type: Date },
	dueDate: { type: Date },
	completedAt: { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('Milestone', MilestoneSchema);


