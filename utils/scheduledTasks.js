const { User } = require('../models');
const { checkAndSendReminders } = require('../controllers/InvoiceReminderController');
const { processRecurringReminders } = require('../controllers/recurringReminderController');
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

  // Recurring Reminders — daily at 6:00 AM UTC
  cron.schedule('0 6 * * *', async () => {
    try {
      console.log('[Scheduled Tasks] Processing recurring reminders...');
      await processRecurringReminders();
    } catch (error) {
      console.error('Error in Recurring Reminder Processing:', error);
    }
  });

  // Trial Expiry Check — daily at 9:00 AM UTC
  cron.schedule('0 9 * * *', async () => {
    try {
      console.log('[Trial Check] Checking trial expirations...');
      await checkTrialExpirations();
    } catch (error) {
      console.error('Error in Trial Expiry Check:', error);
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

  // Late Fee Application — daily at 7:00 AM UTC
  cron.schedule('0 7 * * *', async () => {
    try {
      console.log('[Late Fees] Checking for late fee application...');
      await applyLateFees();
    } catch (error) {
      console.error('Error in Late Fee Application:', error);
    }
  });

  // Run startup tasks after DB connects
  setTimeout(async () => {
    try {
      console.log('[Scheduled Tasks] Running initial invoice reminder check...');
      await checkAndSendReminders();
    } catch (error) {
      console.error('Error in initial Invoice Reminder Check:', error);
    }

    try {
      await backfillPortalTokens();
    } catch (error) {
      console.error('Error in portal token backfill:', error);
    }
  }, 10000);
}

async function backfillPortalTokens() {
  const InvoiceReminder = require('../models/InvoiceReminder');
  const { generatePortalToken } = require('./portalToken');

  const invoices = await InvoiceReminder.find({
    $or: [{ portalToken: { $exists: false } }, { portalToken: null }, { portalToken: '' }]
  }).select('_id');

  if (invoices.length === 0) return;

  console.log(`[Backfill] Generating portal tokens for ${invoices.length} invoices...`);
  let count = 0;
  for (const inv of invoices) {
    const token = generatePortalToken(inv._id);
    await InvoiceReminder.updateOne({ _id: inv._id }, { $set: { portalToken: token } });
    count++;
  }
  console.log(`[Backfill] Portal tokens generated for ${count} invoices.`);
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

/**
 * Check trial expirations: warn at 3 and 1 day before, downgrade when expired
 */
async function checkTrialExpirations() {
  console.log('[Trial Check] Checking trial expirations...');

  try {
    const Subscription = require('../models/Subscription');
    const now = new Date();

    const trialOrgs = await Organization.find({
      'subscription.status': 'trial',
      'subscription.trialEndsAt': { $exists: true, $ne: null }
    });

    for (const org of trialOrgs) {
      const trialEnd = new Date(org.subscription.trialEndsAt);
      const daysLeft = Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24));
      const owner = await User.findOne({ organization: org._id, isOwner: true });

      if (!owner) continue;

      if (daysLeft <= 0) {
        // Trial expired — downgrade to free
        console.log(`[Trial Check] Trial expired for org ${org.name}. Downgrading...`);

        const freeFeatures = Subscription.plans.free.features;
        org.subscription.plan = 'free';
        org.subscription.status = 'active';
        org.features = {
          maxInvoices: freeFeatures.maxInvoices,
          emailReminders: freeFeatures.emailReminders,
          basicReporting: freeFeatures.basicReporting,
          automatedSchedule: freeFeatures.automatedSchedule,
          prioritySupport: freeFeatures.prioritySupport,
          removeBranding: freeFeatures.removeBranding
        };
        await org.save();

        await User.updateMany(
          { organization: org._id },
          { $set: { plan: 'free', subscriptionStatus: 'active' } }
        );

        await subscriptionEmailService.sendTrialExpiredEmail(owner, org);
        console.log(`[Trial Check] Org ${org.name} downgraded to FREE`);
      } else if (daysLeft === 3 || daysLeft === 1) {
        // Send warning email
        console.log(`[Trial Check] Trial ending in ${daysLeft} day(s) for org ${org.name}`);
        await subscriptionEmailService.sendTrialExpiringEmail(owner, org, daysLeft);
      }
    }

    console.log(`[Trial Check] Checked ${trialOrgs.length} trial organizations`);
  } catch (error) {
    console.error('[Trial Check] Error:', error);
  }
}

/**
 * Apply late fees to overdue invoices based on organization settings
 */
async function applyLateFees() {
  const InvoiceReminder = require('../models/InvoiceReminder');
  const InvoiceSettings = require('../models/InvoiceSettings');

  try {
    const overdueInvoices = await InvoiceReminder.find({
      status: 'overdue',
      'lateFee.applied': { $ne: true },
    }).populate({ path: 'userId', select: 'organization' });

    const settingsCache = {};
    let applied = 0;

    for (const invoice of overdueInvoices) {
      const orgId = invoice.userId?.organization?.toString();
      if (!orgId) continue;

      if (!settingsCache[orgId]) {
        settingsCache[orgId] = await InvoiceSettings.findOne({ organization: orgId });
      }
      const settings = settingsCache[orgId];
      if (!settings?.lateFee?.enabled || !settings.lateFee.value) continue;

      const now = new Date();
      const dueDate = new Date(invoice.dueDate);
      const daysOverdue = Math.floor((now - dueDate) / (1000 * 60 * 60 * 24));

      if (daysOverdue <= (settings.lateFee.gracePeriodDays || 0)) continue;

      let feeAmount = 0;
      if (settings.lateFee.type === 'percentage') {
        feeAmount = Math.round(invoice.amount * (settings.lateFee.value / 100) * 100) / 100;
      } else {
        feeAmount = settings.lateFee.value;
      }

      invoice.lateFee = { applied: true, amount: feeAmount, appliedAt: now };
      await invoice.save();
      applied++;
    }

    console.log(`[Late Fees] Applied late fees to ${applied} invoices`);
  } catch (error) {
    console.error('[Late Fees] Error:', error);
  }
}

module.exports = {
  startScheduledTasks,
  checkUsageLimits,
  checkExpiredSubscriptions,
  checkTrialExpirations,
  applyLateFees
};