const mongoose = require('mongoose');

const RoleSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: false // Temporarily optional during migration
    },
    name: {
      type: String,
      required: [true, 'Role name is required'],
      trim: true,
      lowercase: true,
      maxlength: [50, 'Role name cannot be more than 50 characters']
    },
    description: {
      type: String,
      maxlength: [200, 'Description cannot be more than 200 characters']
    },
    permissions: {
      type: [String],
      required: true
    },
    isCustom: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

// Create index for organization-specific role names
RoleSchema.index({ organization: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Role', RoleSchema); 