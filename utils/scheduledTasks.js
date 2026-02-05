const { cleanupExpiredReservations } = require('./realTimeInventory');
const { Task, TaskAutomation, User } = require('../models');
const { sendEmail } = require('./notify');
const { isModuleEnabled } = require('../config/modules');
const { checkAndSendReminders } = require('../controllers/InvoiceReminderController');
const Organization = require('../models/Organization');
const subscriptionEmailService = require('../services/subscriptionEmailService');
const { getInvoiceUsage } = require('./subscriptionHelpers');



// Run cleanup every minute
const CLEANUP_INTERVAL = 60 * 1000; // 1 minute

/**
 * Start the scheduled tasks
 */
function startScheduledTasks() {
  console.log('[Scheduled Tasks] Starting all scheduled tasks...');

 

  // Start stock reservation expiry job (runs every hour)
  console.log('[Scheduled Tasks] Starting stock reservation expiry job...');

  // Schedule cleanup of expired reservations (legacy - runs every minute)
  setInterval(async () => {
    try {
      await cleanupExpiredReservations();
    } catch (error) {
      console.error('Error cleaning up expired reservations:', error);
    }
  }, CLEANUP_INTERVAL);

  // Invoice Reminder Check (Hourly)
  setInterval(async () => {
    try {
      await checkAndSendReminders();
    } catch (error) {
      console.error('Error in Invoice Reminder Check:', error);
    }
  }, 60 * 60 * 1000);

  // Trial Expiration Check (Daily at midnight)
  setInterval(async () => {
    try {
      await checkTrialExpirations();
    } catch (error) {
      console.error('Error in Trial Expiration Check:', error);
    }
  }, 24 * 60 * 60 * 1000); // Run daily

  // Run immediately on startup
  setTimeout(async () => {
    try {
      await checkTrialExpirations();
    } catch (error) {
      console.error('Error in initial Trial Expiration Check:', error);
    }
  }, 5000); // 5 seconds after startup

  // Usage Warning Check (Daily)
  setInterval(async () => {
    try {
      await checkUsageLimits();
    } catch (error) {
      console.error('Error in Usage Limit Check:', error);
    }
  }, 24 * 60 * 60 * 1000); // Run daily

  // Simple task reminders and recurrences, every 5 minutes
  setInterval(async () => {
    try {
      const now = new Date();
      const soon = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000); // 48h

      // Due-soon reminders
      const dueSoon = await Task.find({ dueDate: { $gte: now, $lte: soon }, status: { $in: ['backlog', 'todo', 'in-progress', 'blocked'] } })
        .populate('assigneeId', 'email name');
      for (const t of dueSoon) {
        if (t.assigneeId?.email) {
          await sendEmail({ to: t.assigneeId.email, subject: `Task due soon: ${t.title}`, html: `Task "${t.title}" is due by ${t.dueDate?.toISOString().slice(0, 10)}` });
        }
      }

      // Overdue pings
      const overdue = await Task.find({ dueDate: { $lt: now }, status: { $in: ['backlog', 'todo', 'in-progress', 'blocked'] } }).populate('assigneeId', 'email name');
      for (const t of overdue) {
        if (t.assigneeId?.email) {
          await sendEmail({ to: t.assigneeId.email, subject: `Task overdue: ${t.title}`, html: `Task "${t.title}" was due by ${t.dueDate?.toISOString().slice(0, 10)}` });
        }
      }

      // Rule-based auto-assignment (very simple evaluator)
      const activeRules = await (TaskAutomation.find ? TaskAutomation.find({ isActive: true, 'trigger.type': 'rule' }) : []);
      if (activeRules && activeRules.length) {
        for (const rule of activeRules) {
          const match = rule.trigger?.config?.match || 'all';
          const conditions = Array.isArray(rule.trigger?.config?.if) ? rule.trigger.config.if : [];
          const candidates = await Task.find({ organization: rule.organization, project: rule.project });
          for (const t of candidates) {
            const ok = conditions.length === 0 || (match === 'all'
              ? conditions.every(c => evalCond(t, c))
              : conditions.some(c => evalCond(t, c))
            );
            if (!ok) continue;
            if (rule.action?.type === 'assign' && rule.action?.config?.assigneeId && String(t.assigneeId || '') !== String(rule.action.config.assigneeId)) {
              await Task.updateOne({ _id: t._id }, { $set: { assigneeId: rule.action.config.assigneeId } });
            }
          }
        }
      }

      // Basic recurrence: when a recurring task is completed and has count left, create next occurrence
      const completedRecurring = await Task.find({ 'recurrence.type': { $exists: true }, completedAt: { $exists: true } });
      for (const t of completedRecurring) {
        // skip if until passed or count is 0
        const until = t.recurrence?.until ? new Date(t.recurrence.until) : null;
        if (until && now > until) continue;
        if (t.recurrence?.count !== undefined && t.recurrence.count <= 1) continue;

        const next = new Task({
          organization: t.organization,
          project: t.project,
          title: t.title,
          description: t.description,
          assigneeId: t.assigneeId,
          status: 'backlog',
          priority: t.priority,
          startDate: t.dueDate || now,
          dueDate: computeNextDueDate(t.dueDate || now, t.recurrence),
          estimatedHours: t.estimatedHours,
          labels: t.labels,
          recurrence: t.recurrence?.count ? { ...t.recurrence, count: t.recurrence.count - 1 } : t.recurrence
        });
        await next.save();
        // Clear recurrence on the completed task to avoid repeated spawns
        t.recurrence = undefined;
        await t.save();
      }
    } catch (err) {
      console.error('Project automations failed:', err?.message);
    }
  }, 5 * 60 * 1000);
}

function computeNextDueDate(from, recurrence) {
  const d = new Date(from);
  const interval = Math.max(1, recurrence?.interval || 1);
  switch (recurrence?.frequency) {
    case 'daily': d.setDate(d.getDate() + interval); break;
    case 'weekly': d.setDate(d.getDate() + 7 * interval); break;
    case 'monthly': d.setMonth(d.getMonth() + interval); break;
    case 'yearly': d.setFullYear(d.getFullYear() + interval); break;
    default: d.setDate(d.getDate() + interval);
  }
  return d;
}

function evalCond(task, cond) {
  try {
    const { field, operator, value } = cond || {};
    const left = get(task, field);
    switch (operator) {
      case 'eq': return String(left) === String(value);
      case 'neq': return String(left) !== String(value);
      case 'in': return Array.isArray(value) && value.map(String).includes(String(left));
      case 'contains': return Array.isArray(left) ? left.map(String).includes(String(value)) : (left || '').toString().includes(String(value));
      case 'gt': return Number(left) > Number(value);
      case 'lt': return Number(left) < Number(value);
      default: return false;
    }
  } catch { return false; }
}

function get(obj, path) {
  if (!path) return undefined;
  return path.split('.').reduce((acc, k) => (acc ? acc[k] : undefined), obj);
}

/**
 * Check for trial expirations and send notifications
 */
async function checkTrialExpirations() {
  console.log('[Trial Check] Checking trial expirations...');

  try {
    const now = new Date();

    // Find organizations with active trials
    const trialsEndingSoon = await Organization.find({
      'subscription.status': 'trial',
      'subscription.trialEndsAt': { $exists: true }
    });

    for (const org of trialsEndingSoon) {
      const trialEnd = new Date(org.subscription.trialEndsAt);
      const daysRemaining = Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24));

      // Find organization owner
      const owner = await User.findOne({ organization: org._id, isOwner: true });
      if (!owner) continue;

      // Send warning at 7, 3, and 1 days before expiration
      if (daysRemaining === 7 || daysRemaining === 3 || daysRemaining === 1) {
        console.log(`[Trial Check] Sending expiration warning to ${owner.email} (${daysRemaining} days remaining)`);
        await subscriptionEmailService.sendTrialExpiringEmail(owner, org, daysRemaining);
      }

      // Trial has expired
      if (daysRemaining <= 0 && org.subscription.status === 'trial') {
        console.log(`[Trial Check] Trial expired for organization ${org.name}, downgrading to free`);
        
        // Update organization
        org.subscription.status = 'expired';
        org.subscription.plan = 'free';
        
        // Update features to free plan
        const Subscription = require('../models/Subscription');
        org.features = Subscription.plans.free.features;
        
        await org.save();

        // Update all users in organization
        await User.updateMany(
          { organization: org._id },
          {
            $set: {
              plan: 'free',
              subscriptionStatus: 'active'
            }
          }
        );

        // Send trial expired email
        await subscriptionEmailService.sendTrialExpiredEmail(owner, org);
      }
    }

    console.log(`[Trial Check] Checked ${trialsEndingSoon.length} trial organizations`);
  } catch (error) {
    console.error('[Trial Check] Error:', error);
  }
}

/**
 * Check usage limits and send warnings
 */
async function checkUsageLimits() {
  console.log('[Usage Check] Checking usage limits...');

  try {
    // Find all free plan organizations
    const freeOrgs = await Organization.find({
      'subscription.plan': 'free',
      'subscription.status': { $in: ['active', 'trial'] }
    });

    for (const org of freeOrgs) {
      const usage = await getInvoiceUsage(org._id);

      // Send warning at 80% usage (4 out of 5 invoices)
      if (usage.used >= Math.floor(usage.limit * 0.8) && usage.remaining > 0) {
        const owner = await User.findOne({ organization: org._id, isOwner: true });
        
        if (owner) {
          console.log(`[Usage Check] Sending usage warning to ${owner.email} (${usage.used}/${usage.limit})`);
          await subscriptionEmailService.sendUsageLimitWarningEmail(owner, org, usage);
        }
      }
    }

    console.log(`[Usage Check] Checked ${freeOrgs.length} free plan organizations`);
  } catch (error) {
    console.error('[Usage Check] Error:', error);
  }
}

module.exports = {
  startScheduledTasks,
  checkTrialExpirations,
  checkUsageLimits
}; 