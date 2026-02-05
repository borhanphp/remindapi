const mongoose = require('mongoose');

const HRMSettingsSchema = new mongoose.Schema({
    organization: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        index: true,
        required: true,
        unique: true
    },

    // Leave Policy
    leavePolicy: {
        annualLeave: { type: Number, default: 20 },
        sickLeave: { type: Number, default: 10 },
        casualLeave: { type: Number, default: 5 },
        maternityLeave: { type: Number, default: 90 },
        paternityLeave: { type: Number, default: 14 },
        unpaidLeaveAllowed: { type: Boolean, default: true },
        carryForwardAllowed: { type: Boolean, default: true },
        maxCarryForwardDays: { type: Number, default: 5 },
        leaveEncashmentAllowed: { type: Boolean, default: false },
    },

    // Working Hours
    workingHours: {
        startTime: { type: String, default: '09:00' },
        endTime: { type: String, default: '18:00' },
        breakDuration: { type: Number, default: 60 }, // minutes
        workingDaysPerWeek: { type: Number, default: 5 },
        weekendDays: [{ type: String, enum: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] }],
        flexibleHours: { type: Boolean, default: false },
        graceMinutes: { type: Number, default: 15 }, // late grace period
    },

    // Probation Settings
    probation: {
        defaultPeriodMonths: { type: Number, default: 3 },
        extendable: { type: Boolean, default: true },
        maxExtensionMonths: { type: Number, default: 3 },
        reviewBeforeEnd: { type: Number, default: 14 }, // days before probation ends
    },

    // Overtime Settings
    overtime: {
        enabled: { type: Boolean, default: true },
        multiplier: { type: Number, default: 1.5 },
        weekendMultiplier: { type: Number, default: 2 },
        holidayMultiplier: { type: Number, default: 2.5 },
        maxMonthlyHours: { type: Number, default: 40 },
        requiresApproval: { type: Boolean, default: true },
    },

    // Attendance Settings
    attendance: {
        allowRemoteClock: { type: Boolean, default: false },
        requireLocationTracking: { type: Boolean, default: false },
        autoClockOutEnabled: { type: Boolean, default: true },
        autoClockOutTime: { type: String, default: '20:00' },
        halfDayThresholdHours: { type: Number, default: 4 },
    },

    // Notification Settings
    notifications: {
        leaveRequestNotify: { type: Boolean, default: true },
        attendanceAlerts: { type: Boolean, default: true },
        payrollReminders: { type: Boolean, default: true },
        birthdayReminders: { type: Boolean, default: true },
        probationEndReminders: { type: Boolean, default: true },
    }

}, { timestamps: true });

// Ensure weekend days default
HRMSettingsSchema.pre('save', function (next) {
    if (!this.workingHours.weekendDays || this.workingHours.weekendDays.length === 0) {
        this.workingHours.weekendDays = ['saturday', 'sunday'];
    }
    next();
});

module.exports = mongoose.model('HRMSettings', HRMSettingsSchema);
