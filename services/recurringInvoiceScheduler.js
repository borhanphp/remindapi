const cron = require('node-cron');
const RecurringInvoice = require('../models/RecurringInvoice');
const CustomInvoice = require('../models/CustomInvoice');
const InvoiceSettings = require('../models/InvoiceSettings');
const { generateInvoiceNumber } = require('../utils/invoiceNumberGenerator');
const { sendInvoiceEmail } = require('./invoiceEmailService');

/**
 * Process due recurring invoices
 * Generates new invoices from active recurring invoice templates
 */
const processRecurringInvoices = async () => {
  try {
    console.log('[Recurring Invoice Scheduler] Starting processing...');

    // Find all active recurring invoices that are due
    const dueRecurringInvoices = await RecurringInvoice.find({
      status: 'active',
      nextGenerationDate: { $lte: new Date() }
    })
      .populate('customer')
      .populate('template');

    console.log(`[Recurring Invoice Scheduler] Found ${dueRecurringInvoices.length} due recurring invoices`);

    const results = {
      success: 0,
      failed: 0,
      errors: []
    };

    // Process each recurring invoice
    for (const recurringInvoice of dueRecurringInvoices) {
      try {
        await generateInvoiceFromRecurring(recurringInvoice);
        results.success++;
      } catch (error) {
        console.error(`[Recurring Invoice Scheduler] Error processing recurring invoice ${recurringInvoice._id}:`, error);
        results.failed++;
        results.errors.push({
          recurringInvoiceId: recurringInvoice._id,
          error: error.message
        });
      }
    }

    console.log('[Recurring Invoice Scheduler] Processing complete:', results);
    return results;
  } catch (error) {
    console.error('[Recurring Invoice Scheduler] Critical error:', error);
    throw error;
  }
};

/**
 * Generate invoice from recurring invoice template
 * @param {Object} recurringInvoice - Recurring invoice document
 */
const generateInvoiceFromRecurring = async (recurringInvoice) => {
  try {
    console.log(`[Recurring Invoice Scheduler] Generating invoice for recurring invoice ${recurringInvoice._id}`);

    // Get invoice settings for number generation
    const settings = await InvoiceSettings.findOne({ 
      organization: recurringInvoice.organization 
    });

    // Calculate due date based on payment terms
    const invoiceDate = new Date();
    const dueDate = new Date(invoiceDate);
    const dueDays = extractDueDays(recurringInvoice.paymentTerms);
    dueDate.setDate(dueDate.getDate() + dueDays);

    // Generate new invoice number
    const invoiceNumber = await generateInvoiceNumber(
      recurringInvoice.organization,
      'invoice',
      settings
    );

    // Create invoice data
    const invoiceData = {
      invoiceNumber,
      organization: recurringInvoice.organization,
      customer: recurringInvoice.customer._id,
      template: recurringInvoice.template,
      invoiceDate,
      dueDate,
      paymentTerms: recurringInvoice.paymentTerms,
      currency: recurringInvoice.currency,
      lineItems: recurringInvoice.lineItems,
      customFields: recurringInvoice.customFields,
      subtotal: recurringInvoice.subtotal,
      totalTax: recurringInvoice.totalTax,
      totalDiscount: recurringInvoice.totalDiscount,
      shippingCost: recurringInvoice.shippingCost,
      totalAmount: recurringInvoice.totalAmount,
      notes: recurringInvoice.notes,
      terms: recurringInvoice.terms,
      recurringInvoice: recurringInvoice._id,
      status: 'draft',
      createdBy: recurringInvoice.createdBy
    };

    // Create the invoice
    const invoice = await CustomInvoice.create(invoiceData);

    console.log(`[Recurring Invoice Scheduler] Created invoice ${invoice.invoiceNumber}`);

    // Send email if auto-send is enabled
    let emailSent = false;
    let emailError = null;
    
    if (recurringInvoice.autoSend) {
      try {
        const recipients = recurringInvoice.emailRecipients.length > 0 
          ? recurringInvoice.emailRecipients 
          : [recurringInvoice.customer.email];

        for (const recipient of recipients) {
          if (recipient) {
            await sendInvoiceEmail(invoice._id, invoice.organization, { to: recipient });
          }
        }
        
        emailSent = true;
        console.log(`[Recurring Invoice Scheduler] Email sent for invoice ${invoice.invoiceNumber}`);
      } catch (error) {
        emailError = error.message;
        console.error(`[Recurring Invoice Scheduler] Failed to send email for invoice ${invoice.invoiceNumber}:`, error);
      }
    }

    // Update recurring invoice
    recurringInvoice.lastGenerationDate = new Date();
    recurringInvoice.nextGenerationDate = recurringInvoice.calculateNextDate();
    recurringInvoice.totalGenerated += 1;

    // Add to generation history
    recurringInvoice.generationHistory.push({
      generatedAt: new Date(),
      invoice: invoice._id,
      invoiceNumber: invoice.invoiceNumber,
      sent: emailSent,
      sentAt: emailSent ? new Date() : null,
      error: emailError
    });

    // Check if recurring invoice should be completed
    if (recurringInvoice.endDate && recurringInvoice.nextGenerationDate > recurringInvoice.endDate) {
      recurringInvoice.status = 'completed';
      console.log(`[Recurring Invoice Scheduler] Recurring invoice ${recurringInvoice._id} marked as completed`);
    }

    await recurringInvoice.save();

    return invoice;
  } catch (error) {
    console.error(`[Recurring Invoice Scheduler] Error generating invoice:`, error);
    
    // Log error in generation history
    recurringInvoice.generationHistory.push({
      generatedAt: new Date(),
      sent: false,
      error: error.message
    });
    
    await recurringInvoice.save();
    
    throw error;
  }
};

/**
 * Extract due days from payment terms string
 * @param {String} paymentTerms - Payment terms (e.g., "Net 30", "Due on Receipt")
 * @returns {Number} Number of days
 */
const extractDueDays = (paymentTerms) => {
  if (!paymentTerms) return 30;
  
  // Match patterns like "Net 30", "Net30", "30 days", etc.
  const match = paymentTerms.match(/\d+/);
  if (match) {
    return parseInt(match[0]);
  }
  
  // Handle special cases
  if (paymentTerms.toLowerCase().includes('receipt')) {
    return 0;
  }
  
  // Default to 30 days
  return 30;
};

/**
 * Start the recurring invoice scheduler
 * Runs daily at 2:00 AM
 */
const startScheduler = () => {
  // Run every day at 2:00 AM
  // Cron format: minute hour day month dayOfWeek
  const schedule = '0 2 * * *';
  
  console.log('[Recurring Invoice Scheduler] Starting scheduler with cron:', schedule);
  
  const task = cron.schedule(schedule, async () => {
    console.log('[Recurring Invoice Scheduler] Cron job triggered');
    try {
      await processRecurringInvoices();
    } catch (error) {
      console.error('[Recurring Invoice Scheduler] Cron job failed:', error);
    }
  });

  // Also run once on startup (after 30 seconds)
  setTimeout(async () => {
    console.log('[Recurring Invoice Scheduler] Running initial check');
    try {
      await processRecurringInvoices();
    } catch (error) {
      console.error('[Recurring Invoice Scheduler] Initial check failed:', error);
    }
  }, 30000);

  return task;
};

/**
 * Stop the scheduler
 * @param {Object} task - Cron task instance
 */
const stopScheduler = (task) => {
  if (task) {
    task.stop();
    console.log('[Recurring Invoice Scheduler] Scheduler stopped');
  }
};

/**
 * Manual trigger for testing
 */
const triggerManual = async () => {
  console.log('[Recurring Invoice Scheduler] Manual trigger initiated');
  return await processRecurringInvoices();
};

module.exports = {
  processRecurringInvoices,
  generateInvoiceFromRecurring,
  startScheduler,
  stopScheduler,
  triggerManual
};

