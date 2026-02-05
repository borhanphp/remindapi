const mongoose = require('mongoose');

const TaskAutomationSchema = new mongoose.Schema({
	organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true, required: true },
	project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', index: true, required: true },
	name: { type: String, required: true },
	description: { type: String },
	isActive: { type: Boolean, default: true },
	trigger: {
		// e.g., { type: 'due-soon', daysBefore: 2 } or { type: 'recurrence' } or { type: 'rule', config: { match: 'any'|'all', if: [ { field, operator, value } ] } }
		type: { type: String, enum: ['due-soon', 'overdue', 'recurrence', 'rule'], required: true },
		config: { type: Object, default: {} },
	},
	action: {
		// e.g., { type: 'email-reminder' } or { type: 'create-recurring-task' } or { type: 'assign', config: { assignee: userId } }
		type: { type: String, enum: ['email-reminder', 'create-task', 'assign'], required: true },
		config: { type: Object, default: {} },
	}
}, { timestamps: true });

module.exports = mongoose.model('TaskAutomation', TaskAutomationSchema);


