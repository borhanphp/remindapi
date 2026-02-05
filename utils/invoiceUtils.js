const Invoice = require('../models/Invoice');

/**
 * Generates a unique invoice number in the format INV-YYYYMMDD-XXXX
 * where XXXX is a sequential number padded with zeros
 */
const generateInvoiceNumber = async () => {
  try {
    // Get current date components
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateString = `${year}${month}${day}`;
    
    // Find the latest invoice for today
    const latestInvoice = await Invoice.findOne({
      invoiceNumber: new RegExp(`INV-${dateString}-\\d{4}$`)
    }).sort({ invoiceNumber: -1 });

    let sequentialNumber = 1;
    if (latestInvoice) {
      // Extract the sequential number from the latest invoice and increment it
      const match = latestInvoice.invoiceNumber.match(/\d{4}$/);
      if (match) {
        sequentialNumber = parseInt(match[0]) + 1;
      }
    }

    // Generate the new invoice number
    return `INV-${dateString}-${String(sequentialNumber).padStart(4, '0')}`;
  } catch (error) {
    console.error('Error generating invoice number:', error);
    throw new Error('Failed to generate invoice number');
  }
};

module.exports = {
  generateInvoiceNumber
}; 