const { Task, TaskAutomation, User } = require('../models');
const { sendEmail } = require('./notify');
const { isModuleEnabled } = require('../config/modules');
const { checkAndSendReminders } = require('../controllers/InvoiceReminderController');
const Organization = require('../models/Organization');
const subscriptionEmailService = require('../services/subscriptionEmailService');
const { getInvoiceUsage } = require('./subscriptionHelpers');
const cron = require('node-cron');


/**
 * Start the scheduled tasks using node-cron for reliable fixed-time scheduling
 */
function startScheduledTasks() {
  console.log('[Scheduled Tasks] Starting all scheduled tasks...');

  // Invoice Reminder Check — every hour at minute 0
  cron.schedule('0 * * * *', async () => {
    try {
      console.log('[Scheduled Tasks] Running hourly invoice reminder check...');
      await checkAndSendReminders();
    } catch (error) {
      console.error('Error in Invoice Reminder Check:', error);
    }
  });

  // Expired Subscription Check — daily at midnight UTC
  cron.schedule('0 0 * * *', async () => {
    try {
      console.log('[Subscription Check] Running expired subscription check...');
      await checkExpiredSubscriptions();
    } catch (error) {
      console.error('Error in Expired Subscription Check:', error);
    }
  });

  // Usage Warning Check — daily at 8:00 AM UTC
  cron.schedule('0 8 * * *', async () => {
    try {
      await checkUsageLimits();
    } catch (error) {
      console.error('Error in Usage Limit Check:', error);
    }
  });

  // Project task reminders and recurrences — every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try {
      // Check if Task model exists and has data
      if (!Task || typeof Task.find !== 'function') {
        return; // Skip project automation for single-purpose apps
      }

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
      if (TaskAutomation && typeof TaskAutomation.find === 'function') {
        const activeRules = await TaskAutomation.find({ isActive: true, 'trigger.type': 'rule' });
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
      // Only log if it's not a model-not-found error
      if (!err?.message?.includes('find')) {
        console.error('Project automations failed:', err?.message);
      }
    }
  });

  // Run invoice reminder check once on startup (after 10 seconds to let DB connect)
  setTimeout(async () => {
    try {
      console.log('[Scheduled Tasks] Running initial invoice reminder check...');
      await checkAndSendReminders();
    } catch (error) {
      console.error('Error in initial Invoice Reminder Check:', error);
    }
  }, 10000);
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
 * Check for expired subscriptions past grace period and auto-downgrade
 */
async function checkExpiredSubscriptions() {
  console.log('[Subscription Check] Checking for expired subscriptions...');

  try {
    const Subscription = require('../models/Subscription');

    // Find all organizations with past_due status
    const pastDueOrgs = await Organization.find({
      'subscription.status': 'past_due'
    });

    let downgraded = 0;

    for (const org of pastDueOrgs) {
      // Find the subscription record to get currentPeriodEnd
      const subscription = await Subscription.findOne({
        organization: org._id
      }).sort({ createdAt: -1 });

      if (!subscription || !subscription.currentPeriodEnd) {
        continue;
      }

      // Calculate grace period end (7 days after currentPeriodEnd)
      const gracePeriodEnd = new Date(subscription.currentPeriodEnd);
      gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 7);

      // Check if grace period has expired
      if (new Date() > gracePeriodEnd) {
        console.log(`[Subscription Check] Grace period expired for org ${org.name} (${org._id}). Downgrading...`);

        // Downgrade organization
        const freeFeatures = Subscription.plans.free.features;
        org.subscription.plan = 'free';
        org.subscription.status = 'cancelled';
        org.features = {
          maxInvoices: freeFeatures.maxInvoices,
          emailReminders: freeFeatures.emailReminders,
          basicReporting: freeFeatures.basicReporting,
          automatedSchedule: freeFeatures.automatedSchedule,
          prioritySupport: freeFeatures.prioritySupport,
          removeBranding: freeFeatures.removeBranding
        };
        await org.save();

        // Update all users in the organization
        await User.updateMany(
          { organization: org._id },
          {
            $set: {
              plan: 'free',
              subscriptionStatus: 'cancelled'
            }
          }
        );

        // Update subscription record
        await Subscription.findOneAndUpdate(
          { organization: org._id },
          {
            status: 'cancelled',
            cancelledAt: new Date(),
            plan: 'free'
          }
        );

        // Send downgrade notification email to the org owner
        const owner = await User.findOne({ organization: org._id, isOwner: true });
        if (owner) {
          await subscriptionEmailService.sendSubscriptionDowngradedEmail(owner, org);
        }

        downgraded++;
        console.log(`[Subscription Check] Org ${org.name} downgraded to FREE`);
      }
    }

    console.log(`[Subscription Check] Checked ${pastDueOrgs.length} past_due orgs, downgraded ${downgraded}`);
  } catch (error) {
    console.error('[Subscription Check] Error:', error);
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
      'subscription.status': 'active'
    });

    for (const org of freeOrgs) {
      const usage = await getInvoiceUsage(org._id);

      // Send warning at 80% usage
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
  checkUsageLimits,
  checkExpiredSubscriptions
};