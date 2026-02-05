const mongoose = require('mongoose');

const CrmEventSchema = new mongoose.Schema({
  organization: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Organization', 
    index: true, 
    required: true 
  },
  
  // Event details
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  type: { 
    type: String, 
    enum: ['meeting', 'call', 'task', 'deadline', 'reminder'], 
    default: 'meeting',
    index: true 
  },
  
  // Timing
  startTime: { type: Date, required: true, index: true },
  endTime: { type: Date, required: true },
  allDay: { type: Boolean, default: false },
  timezone: { type: String, default: 'UTC' },
  
  // Location
  location: { type: String, trim: true },
  meetingUrl: { type: String, trim: true }, // For virtual meetings
  
  // Related entities
  relatedType: { 
    type: String, 
    enum: ['lead', 'deal', 'account', 'contact', 'customer', 'opportunity'], 
    index: true 
  },
  relatedId: { type: mongoose.Schema.Types.ObjectId, index: true },
  relatedName: { type: String, trim: true }, // Denormalized for quick display
  
  // Attendees
  organizer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  attendees: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: ['pending', 'accepted', 'declined', 'tentative'], default: 'pending' },
    responseAt: { type: Date }
  }],
  
  // Status
  status: { 
    type: String, 
    enum: ['scheduled', 'in_progress', 'completed', 'cancelled', 'no_show'], 
    default: 'scheduled',
    index: true 
  },
  
  // Reminders
  reminders: [{
    type: { type: String, enum: ['email', 'notification'], default: 'email' },
    minutesBefore: { type: Number, default: 15 },
    sent: { type: Boolean, default: false },
    sentAt: { type: Date }
  }],
  
  // Recurrence
  isRecurring: { type: Boolean, default: false },
  recurrence: {
    frequency: { type: String, enum: ['daily', 'weekly', 'monthly', 'yearly'] },
    interval: { type: Number, default: 1 },
    endDate: { type: Date },
    count: { type: Number }, // Number of occurrences
    byWeekday: [{ type: Number }], // 0=Sunday, 1=Monday, etc.
    byMonthday: [{ type: Number }] // Day of month
  },
  parentEvent: { type: mongoose.Schema.Types.ObjectId, ref: 'CrmEvent' }, // For recurring events
  
  // Outcome (for completed events)
  outcome: {
    notes: { type: String },
    nextAction: { type: String },
    nextActionDate: { type: Date },
    rating: { type: Number, min: 1, max: 5 }
  },
  
  // Activity log integration
  activityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Activity' },
  
  // Meta
  tags: [{ type: String, trim: true }],
  isPrivate: { type: Boolean, default: false },
  color: { type: String, default: '#4F46E5' }, // For calendar display
  
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  
}, { timestamps: true });

// Indexes
CrmEventSchema.index({ organization: 1, startTime: 1 });
CrmEventSchema.index({ organization: 1, organizer: 1, startTime: 1 });
CrmEventSchema.index({ organization: 1, relatedType: 1, relatedId: 1 });
CrmEventSchema.index({ organization: 1, status: 1, startTime: 1 });

// Virtual for duration
CrmEventSchema.virtual('durationMinutes').get(function() {
  if (this.startTime && this.endTime) {
    return Math.round((this.endTime - this.startTime) / (1000 * 60));
  }
  return 0;
});

module.exports = mongoose.model('CrmEvent', CrmEventSchema);

