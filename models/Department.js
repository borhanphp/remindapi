const mongoose = require('mongoose');

const DepartmentSchema = new mongoose.Schema({
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true, required: true },
    name: { type: String, required: true },
    code: { type: String },
    description: { type: String },
    manager: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    parentDepartment: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' }
}, { timestamps: true });

DepartmentSchema.index({ organization: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Department', DepartmentSchema);
