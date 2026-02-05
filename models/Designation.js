const mongoose = require('mongoose');

const DesignationSchema = new mongoose.Schema({
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true, required: true },
    title: { type: String, required: true },
    code: { type: String },
    description: { type: String },
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
    level: { type: Number, default: 1 },  // Job level/grade
    responsibilities: [{ type: String }],
    status: { type: String, enum: ['active', 'inactive'], default: 'active' }
}, { timestamps: true });

DesignationSchema.index({ organization: 1, title: 1 }, { unique: true });

module.exports = mongoose.model('Designation', DesignationSchema);
