const mongoose = require('mongoose');

const MemberSchema = new mongoose.Schema({
	user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
	role: { type: String, enum: ['owner','manager','contributor','viewer'], default: 'contributor' },
	addedAt: { type: Date, default: Date.now }
}, { _id: true });

const ProjectSchema = new mongoose.Schema({
	organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true, required: true },
	name: { type: String, required: true, trim: true },
	description: { type: String },
	client: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
	owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
	members: { type: [MemberSchema], default: [] },
	visibility: { type: String, enum: ['org','members-only'], default: 'org', index: true },
	status: { type: String, enum: ['planned', 'active', 'on-hold', 'completed', 'cancelled'], default: 'planned', index: true },
	startDate: { type: Date },
	dueDate: { type: Date },
	// Project Management Enhancement: Tags for categorization
	tags: [{
		type: String,
		trim: true,
	}],
	// Project Management Enhancement: Health score
	healthScore: {
		value: { type: String, enum: ['red', 'yellow', 'green'], default: 'green' },
		reasons: [{ type: String }],
		lastCalculated: { type: Date, default: Date.now },
		autoCalculated: { type: Boolean, default: true },
	},
	// Custom fields for project-level data
	customFields: {
		type: Map,
		of: mongoose.Schema.Types.Mixed,
		default: {},
	},
	budget: {
		currency: { type: String, default: 'USD' },
		amountPlanned: { type: Number, default: 0 },
		amountActual: { type: Number, default: 0 },
		hoursPlanned: { type: Number, default: 0 },
		hoursActual: { type: Number, default: 0 },
		plannedByCategory: {
			labor: { type: Number, default: 0 },
			materials: { type: Number, default: 0 },
			services: { type: Number, default: 0 },
			other: { type: Number, default: 0 },
		},
		overrunThresholdPercent: { type: Number, default: 100 },
		overrunAlertSent: { type: Boolean, default: false },
	},
	settings: {
		defaultAssignee: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
		defaultPriority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
		// Project Management Enhancement: Sprint settings
		sprintLength: { type: Number, default: 14 }, // days
		velocityTracking: { type: Boolean, default: true },
		autoCalculateHealth: { type: Boolean, default: true },
		enableSubtasks: { type: Boolean, default: true },
		enableDependencies: { type: Boolean, default: true },
	},
	// Sprint history for velocity tracking
	completedSprints: [{
		sprint: { type: mongoose.Schema.Types.ObjectId, ref: 'Sprint' },
		velocity: Number,
		completedPoints: Number,
		completedAt: Date,
	}],
	clientPortal: {
		enabled: { type: Boolean, default: false },
		token: { type: String, index: true },
		sections: {
			progress: { type: Boolean, default: true },
			documents: { type: Boolean, default: true },
			invoices: { type: Boolean, default: true }
		}
	},
	attachments: [{ filename: String, url: String, size: Number, mimeType: String, category: { type: String, enum: ['proposal','design','contract','other'], default: 'other' }, uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, uploadedAt: { type: Date, default: Date.now } }],
	comments: [{ author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, text: String, createdAt: { type: Date, default: Date.now } }],
	history: [{ actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, action: String, from: mongoose.Schema.Types.Mixed, to: mongoose.Schema.Types.Mixed, createdAt: { type: Date, default: Date.now } }]
}, { timestamps: true });

module.exports = mongoose.model('Project', ProjectSchema);


