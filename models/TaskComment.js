const mongoose = require('mongoose');

const MentionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  notified: { type: Boolean, default: false },
}, { _id: false });

const ReactionSchema = new mongoose.Schema({
  emoji: { type: String, required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
}, { _id: true });

const TaskCommentSchema = new mongoose.Schema({
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true,
  },
  task: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
    required: true,
    index: true,
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  content: {
    type: String,
    required: true,
    trim: true,
  },
  // Support for rich text or markdown
  contentType: {
    type: String,
    enum: ['plain', 'markdown', 'html'],
    default: 'plain',
  },
  // @mentions in the comment
  mentions: [MentionSchema],
  // Reactions (emoji responses)
  reactions: [ReactionSchema],
  // Attachments in comment
  attachments: [{
    filename: { type: String, required: true },
    url: { type: String, required: true },
    size: Number,
    mimeType: String,
    uploadedAt: { type: Date, default: Date.now },
  }],
  // Parent comment for threaded discussions
  parentComment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TaskComment',
  },
  // Edit tracking
  edited: {
    type: Boolean,
    default: false,
  },
  editedAt: {
    type: Date,
  },
  // Soft delete
  deleted: {
    type: Boolean,
    default: false,
  },
  deletedAt: {
    type: Date,
  },
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
}, {
  timestamps: true,
});

// Indexes for efficient queries
TaskCommentSchema.index({ task: 1, createdAt: -1 });
TaskCommentSchema.index({ organization: 1, author: 1 });
TaskCommentSchema.index({ organization: 1, task: 1, deleted: 1 });
TaskCommentSchema.index({ 'mentions.user': 1, 'mentions.notified': 1 });

// Virtual for reply count
TaskCommentSchema.virtual('replyCount', {
  ref: 'TaskComment',
  localField: '_id',
  foreignField: 'parentComment',
  count: true,
});

// Method to add reaction
TaskCommentSchema.methods.addReaction = function(emoji, userId) {
  // Remove existing reaction from this user for this emoji
  this.reactions = this.reactions.filter(r => 
    !(r.emoji === emoji && r.user.toString() === userId.toString())
  );
  this.reactions.push({ emoji, user: userId });
  return this.save();
};

// Method to remove reaction
TaskCommentSchema.methods.removeReaction = function(emoji, userId) {
  this.reactions = this.reactions.filter(r => 
    !(r.emoji === emoji && r.user.toString() === userId.toString())
  );
  return this.save();
};

module.exports = mongoose.model('TaskComment', TaskCommentSchema);

