const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const moment = require('moment');

/**
 * Generate a delivery challan PDF
 * @param {Object} delivery - Delivery object with populated references
 * @param {String} outputPath - Path to save the PDF
 * @returns {Promise<String>} - Path to the generated PDF
 */
async function generateDeliveryChallan(delivery, outputPath) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument();
      const writeStream = fs.createWriteStream(outputPath);
      
      doc.pipe(writeStream);

      // Add header
      doc.fontSize(20).text('DELIVERY CHALLAN', { align: 'center' });
      doc.moveDown();

      // Add challan details
      doc.fontSize(12);
      doc.text(`Challan No: ${delivery.deliveryNumber}`);
      doc.text(`Date: ${moment(delivery.scheduledDate).format('DD/MM/YYYY')}`);
      doc.text(`Order No: ${delivery.saleOrder.orderNumber}`);
      doc.moveDown();

      // Add company details (you should store this in environment or settings)
      doc.text('From:');
      doc.text('Your Company Name');
      doc.text('Company Address');
      doc.text('Contact: +1234567890');
      doc.moveDown();

      // Add customer details
      doc.text('To:');
      doc.text(delivery.customer.name);
      doc.text(`${delivery.shippingAddress.street}`);
      doc.text(`${delivery.shippingAddress.city}, ${delivery.shippingAddress.state}`);
      doc.text(`${delivery.shippingAddress.postalCode}, ${delivery.shippingAddress.country}`);
      doc.moveDown();

      // Add items table
      const tableTop = doc.y;
      doc.text('Item', 50, tableTop);
      doc.text('Quantity', 300, tableTop);
      doc.text('Packages', 400, tableTop);

      doc.moveDown();
      let yPosition = doc.y;

      delivery.items.forEach((item, index) => {
        doc.text(item.product.name, 50, yPosition);
        doc.text(item.quantity.toString(), 300, yPosition);
        doc.text(item.packageNumbers.join(', '), 400, yPosition);
        yPosition += 20;
      });

      // Add a line below the items
      doc.moveTo(50, yPosition).lineTo(550, yPosition).stroke();
      doc.moveDown();

      // Add shipping details
      doc.moveDown();
      doc.text('Shipping Method: ' + delivery.shippingMethod);
      if (delivery.shippingCarrier) {
        doc.text('Carrier: ' + delivery.shippingCarrier);
      }
      if (delivery.trackingNumber) {
        doc.text('Tracking Number: ' + delivery.trackingNumber);
      }

      // Add special instructions if any
      if (delivery.specialInstructions) {
        doc.moveDown();
        doc.text('Special Instructions:');
        doc.text(delivery.specialInstructions);
      }

      // Add signature blocks
      doc.moveDown();
      doc.moveDown();
      doc.text('Authorized Signatory', 50, doc.y);
      doc.text('Received By', 400, doc.y);

      doc.end();

      writeStream.on('finish', () => {
        resolve(outputPath);
      });

      writeStream.on('error', (error) => {
        reject(error);
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Generate a packing slip PDF
 * @param {Object} delivery - Delivery object with populated references
 * @param {String} outputPath - Path to save the PDF
 * @returns {Promise<String>} - Path to the generated PDF
 */
async function generatePackingSlip(delivery, outputPath) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument();
      const writeStream = fs.createWriteStream(outputPath);
      
      doc.pipe(writeStream);

      // Add header
      doc.fontSize(20).text('PACKING SLIP', { align: 'center' });
      doc.moveDown();

      // Add basic details
      doc.fontSize(12);
      doc.text(`Packing Slip No: ${delivery.deliveryNumber}`);
      doc.text(`Order No: ${delivery.saleOrder.orderNumber}`);
      doc.text(`Date: ${moment(delivery.scheduledDate).format('DD/MM/YYYY')}`);
      doc.moveDown();

      // Add package details
      delivery.packages.forEach((pkg, index) => {
        doc.text(`Package ${index + 1} of ${delivery.packages.length}`);
        doc.text(`Package Number: ${pkg.packageNumber}`);
        
        if (pkg.weight) {
          doc.text(`Weight: ${pkg.weight.value} ${pkg.weight.unit}`);
        }
        
        if (pkg.dimensions) {
          doc.text(`Dimensions: ${pkg.dimensions.length}x${pkg.dimensions.width}x${pkg.dimensions.height} ${pkg.dimensions.unit}`);
        }
        
        doc.moveDown();
        
        // Add items table for this package
        const tableTop = doc.y;
        doc.text('Item', 50, tableTop);
        doc.text('Quantity', 300, tableTop);
        
        doc.moveDown();
        let yPosition = doc.y;
        
        pkg.items.forEach(item => {
          doc.text(item.product.name, 50, yPosition);
          doc.text(item.quantity.toString(), 300, yPosition);
          yPosition += 20;
        });
        
        doc.moveDown();
        doc.moveDown();
      });

      // Add shipping details
      doc.moveDown();
      doc.text('Ship To:');
      doc.text(delivery.customer.name);
      doc.text(`${delivery.shippingAddress.street}`);
      doc.text(`${delivery.shippingAddress.city}, ${delivery.shippingAddress.state}`);
      doc.text(`${delivery.shippingAddress.postalCode}, ${delivery.shippingAddress.country}`);
      
      if (delivery.specialInstructions) {
        doc.moveDown();
        doc.text('Special Instructions:');
        doc.text(delivery.specialInstructions);
      }

      doc.end();

      writeStream.on('finish', () => {
        resolve(outputPath);
      });

      writeStream.on('error', (error) => {
        reject(error);
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Generate a credit note PDF
 * @param {Object} saleReturn - Sale return object with populated references
 * @param {String} outputPath - Path to save the PDF
 * @returns {Promise<String>} - Path to the generated PDF
 */
async function generateCreditNote(saleReturn, outputPath) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument();
      const writeStream = fs.createWriteStream(outputPath);
      
      doc.pipe(writeStream);

      // Add header
      doc.fontSize(20).text('CREDIT NOTE', { align: 'center' });
      doc.moveDown();

      // Add credit note details
      doc.fontSize(12);
      doc.text(`Credit Note No: ${saleReturn.creditNote.number}`);
      doc.text(`Date: ${moment(saleReturn.creditNote.issuedDate).format('DD/MM/YYYY')}`);
      doc.text(`Return No: ${saleReturn.returnNumber}`);
      doc.text(`Invoice No: ${saleReturn.saleInvoice.invoiceNumber}`);
      doc.moveDown();

      // Add company details
      doc.text('From:');
      doc.text('Your Company Name');
      doc.text('Company Address');
      doc.text('Contact: +1234567890');
      doc.moveDown();

      // Add customer details
      doc.text('To:');
      doc.text(saleReturn.customer.name);
      doc.text(saleReturn.customer.email);
      doc.text(saleReturn.customer.phone);
      if (saleReturn.customer.address) {
        doc.text(saleReturn.customer.address);
      }
      doc.moveDown();

      // Add items table
      const tableTop = doc.y;
      doc.text('Item', 50, tableTop);
      doc.text('Quantity', 200, tableTop);
      doc.text('Reason', 300, tableTop);
      doc.text('Amount', 400, tableTop);

      doc.moveDown();
      let yPosition = doc.y;

      saleReturn.items.forEach((item) => {
        doc.text(item.product.name, 50, yPosition);
        doc.text(item.quantity.toString(), 200, yPosition);
        doc.text(item.reason, 300, yPosition);
        // You might want to calculate individual item amounts if available
        yPosition += 20;
      });

      // Add a line below the items
      doc.moveTo(50, yPosition).lineTo(550, yPosition).stroke();
      doc.moveDown();

      // Add total amount
      doc.moveDown();
      doc.fontSize(12).text('Total Credit Amount:', 300, doc.y);
      doc.fontSize(12).text(`$${saleReturn.refundAmount.toFixed(2)}`, 400, doc.y);

      // Add terms and conditions
      doc.moveDown();
      doc.moveDown();
      doc.fontSize(10).text('Terms and Conditions:', 50, doc.y);
      doc.fontSize(8).text('1. This credit note is valid for future purchases only.', 50, doc.y + 15);
      doc.fontSize(8).text('2. Credit amount must be used within 12 months from the date of issue.', 50, doc.y + 25);

      // Add signature blocks
      doc.moveDown();
      doc.moveDown();
      doc.fontSize(10).text('Authorized Signatory', 50, doc.y);
      doc.text('_______________________', 50, doc.y + 20);

      doc.end();

      writeStream.on('finish', () => {
        resolve(outputPath);
      });

      writeStream.on('error', (error) => {
        reject(error);
      });
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = {
  generateDeliveryChallan,
  generatePackingSlip,
  generateCreditNote
}; 