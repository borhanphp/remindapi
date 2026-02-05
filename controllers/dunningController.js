const SaleInvoice = require('../models/SaleInvoice');
const VendorBill = require('../models/PurchaseInvoice');
const Customer = require('../models/Customer');
const Supplier = require('../models/Supplier');
const DunningSchedule = require('../models/DunningSchedule');
const { sendEmail } = require('../utils/notify');

// List schedules
exports.listSchedules = async (req, res, next) => {
  try {
    const items = await DunningSchedule.find({ organization: req.user.organization }).sort({ createdAt: -1 });
    res.json({ success: true, data: items });
  } catch (err) { next(err); }
};

// Create/update schedule
exports.upsertSchedule = async (req, res, next) => {
  try {
    const { id } = req.params;
    const payload = { ...req.body, organization: req.user.organization };
    const doc = id
      ? await DunningSchedule.findOneAndUpdate({ _id: id, organization: req.user.organization }, payload, { new: true, upsert: false })
      : await DunningSchedule.create(payload);
    res.json({ success: true, data: doc });
  } catch (err) { next(err); }
};

// Run dunning for AR/AP (manual trigger)
exports.runDunning = async (req, res, next) => {
  try {
    const { type = 'AR' } = req.body;
    const schedules = await DunningSchedule.find({ organization: req.user.organization, type, isActive: true });
    if (schedules.length === 0) return res.json({ success: true, message: 'No active dunning schedules' });

    const today = new Date();
    const results = [];

    if (type === 'AR') {
      const invoices = await SaleInvoice.find({ organization: req.user.organization, balanceAmount: { $gt: 0 } }).populate('customer', 'name email');
      for (const inv of invoices) {
        const daysOverdue = inv.dueDate && today > inv.dueDate ? Math.floor((today - inv.dueDate) / 86400000) : 0;
        for (const schedule of schedules) {
          const step = schedule.steps.find(s => daysOverdue >= s.daysOverdueFrom && daysOverdue <= s.daysOverdueTo);
          if (step && inv.customer?.email) {
            const subject = step.emailSubject.replace('{{invoiceNumber}}', inv.invoiceNumber);
            const html = step.emailTemplate
              .replace('{{customerName}}', inv.customer.name)
              .replace('{{invoiceNumber}}', inv.invoiceNumber)
              .replace('{{amount}}', String(inv.balanceAmount))
              .replace('{{dueDate}}', inv.dueDate ? inv.dueDate.toDateString() : '');
            const send = await sendEmail({ to: inv.customer.email, subject, html, text: html });
            results.push({ invoice: inv._id, sent: send.success });
          }
        }
      }
    } else {
      const bills = await VendorBill.find({ organization: req.user.organization, paymentDue: { $gt: 0 } }).populate('supplier', 'name email');
      for (const bill of bills) {
        const daysOverdue = bill.dueDate && today > bill.dueDate ? Math.floor((today - bill.dueDate) / 86400000) : 0;
        for (const schedule of schedules) {
          const step = schedule.steps.find(s => daysOverdue >= s.daysOverdueFrom && daysOverdue <= s.daysOverdueTo);
          if (step && bill.supplier?.email) {
            const subject = step.emailSubject.replace('{{billNumber}}', bill.invoiceNumber || bill.billNumber || 'Bill');
            const html = step.emailTemplate
              .replace('{{supplierName}}', bill.supplier.name)
              .replace('{{billNumber}}', bill.invoiceNumber || bill.billNumber || 'Bill')
              .replace('{{amount}}', String(bill.paymentDue))
              .replace('{{dueDate}}', bill.dueDate ? bill.dueDate.toDateString() : '');
            const send = await sendEmail({ to: bill.supplier.email, subject, html, text: html });
            results.push({ bill: bill._id, sent: send.success });
          }
        }
      }
    }

    res.json({ success: true, data: results });
  } catch (err) { next(err); }
};


