const mongoose = require('mongoose');

const SprintSchema = new mongoose.Schema({
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true,
  },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  goal: {
    type: String,
    trim: true,
  },
  sprintNumber: {
    type: Number,
    min: 1,
  },
  status: {
    type: String,
    enum: ['planned', 'active', 'completed', 'cancelled'],
    default: 'planned',
    index: true,
  },
  startDate: {
    type: Date,
    index: true,
  },
  endDate: {
    type: Date,
    index: true,
  },
  // Sprint metrics
  capacity: {
    totalPoints: { type: Number, default: 0 },
    totalHours: { type: Number, default: 0 },
    committedPoints: { type: Number, default: 0 },
    completedPoints: { type: Number, default: 0 },
    completedHours: { type: Number, default: 0 },
  },
  // Team capacity (hours per day per member)
  teamCapacity: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    hoursPerDay: { type: Number, default: 8, min: 0, max: 24 },
    daysAvailable: { type: Number, min: 0 },
    totalCapacity: { type: Number, default: 0 },
  }],
  // Velocity from previous sprints for planning
  plannedVelocity: {
    type: Number,
    min: 0,
  },
  actualVelocity: {
    type: Number,
    min: 0,
  },
  // Retrospective notes
  retrospective: {
    wentWell: [{ type: String }],
    needsImprovement: [{ type: String }],
    actionItems: [{
      description: String,
      assignee: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      completed: { type: Boolean, default: false },
    }],
  },
  // Sprint started/completed tracking
  startedAt: {
    type: Date,
  },
  startedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  completedAt: {
    type: Date,
  },
  completedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
}, {
  timestamps: true,
});

// Compound indexes
SprintSchema.index({ organization: 1, project: 1, status: 1 });
SprintSchema.index({ organization: 1, project: 1, startDate: -1 });
SprintSchema.index({ organization: 1, project: 1, sprintNumber: 1 });

// Method to calculate burndown data
SprintSchema.methods.getBurndownData = async function() {
  const Task = mongoose.model('Task');
  const tasks = await Task.find({ sprint: this._id });
  
  const days = [];
  const currentDate = new Date(this.startDate);
  const endDate = new Date(this.endDate);
  
  while (currentDate <= endDate) {
    const dayStart = new Date(currentDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(currentDate);
    dayEnd.setHours(23, 59, 59, 999);
    
    const remainingPoints = tasks.reduce((sum, task) => {
      if (task.status === 'done' && task.completedAt && task.completedAt <= dayEnd) {
        return sum;
      }
      return sum + (task.storyPoints || 0);
    }, 0);
    
    days.push({
      date: new Date(currentDate),
      remaining: remainingPoints,
    });
    
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return days;
};

// Method to start sprint
SprintSchema.methods.start = function(userId) {
  this.status = 'active';
  this.startedAt = new Date();
  this.startedBy = userId;
  if (!this.startDate) {
    this.startDate = new Date();
  }
  return this.save();
};

// Method to complete sprint
SprintSchema.methods.complete = async function(userId) {
  const Task = mongoose.model('Task');
  const tasks = await Task.find({ sprint: this._id });
  
  const completedPoints = tasks
    .filter(t => t.status === 'done')
    .reduce((sum, t) => sum + (t.storyPoints || 0), 0);
  
  this.status = 'completed';
  this.completedAt = new Date();
  this.completedBy = userId;
  this.capacity.completedPoints = completedPoints;
  this.actualVelocity = completedPoints;
  
  return this.save();
};

module.exports = mongoose.model('Sprint', SprintSchema);

