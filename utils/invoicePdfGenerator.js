const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');

async function generateInvoicePdf(invoice, user, options = {}) {
    return new Promise(async (resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 50, size: 'A4' });
            const chunks = [];

            doc.on('data', chunk => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);

            const companyName = user.companyName || user.name || 'Unknown';
            const invoiceRef = invoice.invoiceNumber || 'N/A';
            const amount = invoice.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            const currency = invoice.currency || 'USD';
            const currencySymbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : `${currency} `;
            const dueDate = new Date(invoice.dueDate).toLocaleDateString('en-US', {
                year: 'numeric', month: 'long', day: 'numeric'
            });
            const createdDate = new Date(invoice.createdAt).toLocaleDateString('en-US', {
                year: 'numeric', month: 'long', day: 'numeric'
            });
            const statusLabel = (invoice.status || 'draft').toUpperCase();

            // Header with optional logo
            let headerY = 50;
            if (options.headerLogo) {
                try {
                    const logoPath = path.join(__dirname, '..', options.headerLogo);
                    if (fs.existsSync(logoPath)) {
                        doc.image(logoPath, 50, headerY, { height: 40 });
                        headerY += 5;
                    } else {
                        doc.fontSize(24).fillColor('#1a1a2e').text(companyName, 50, headerY);
                    }
                } catch {
                    doc.fontSize(24).fillColor('#1a1a2e').text(companyName, 50, headerY);
                }
            } else {
                doc.fontSize(24).fillColor('#1a1a2e').text(companyName, 50, headerY);
            }

            doc.fontSize(10).fillColor('#666666').text('INVOICE', 400, 50, { align: 'right' });
            doc.fontSize(18).fillColor('#1a1a2e').text(`#${invoiceRef}`, 400, 65, { align: 'right' });

            // Status badge
            const statusColors = { PAID: '#16a34a', OVERDUE: '#dc2626', DRAFT: '#ca8a04', SENT: '#2563eb' };
            const statusColor = statusColors[statusLabel] || '#666666';
            doc.fontSize(10).fillColor(statusColor).text(statusLabel, 400, 90, { align: 'right' });

            // Divider
            doc.moveTo(50, 115).lineTo(545, 115).strokeColor('#e5e7eb').stroke();

            // Bill To section
            let y = 135;
            doc.fontSize(9).fillColor('#999999').text('BILL TO', 50, y);
            doc.fontSize(12).fillColor('#1a1a2e').text(invoice.clientName, 50, y + 15);
            doc.fontSize(10).fillColor('#666666').text(invoice.clientEmail, 50, y + 32);
            if (invoice.clientPhone) {
                doc.text(invoice.clientPhone, 50, y + 47);
            }

            // Invoice details
            doc.fontSize(9).fillColor('#999999').text('INVOICE DATE', 350, y, { align: 'right' });
            doc.fontSize(10).fillColor('#1a1a2e').text(createdDate, 350, y + 15, { align: 'right' });
            doc.fontSize(9).fillColor('#999999').text('DUE DATE', 350, y + 40, { align: 'right' });
            doc.fontSize(10).fillColor('#1a1a2e').text(dueDate, 350, y + 55, { align: 'right' });

            // Amount section
            y = 260;
            doc.moveTo(50, y).lineTo(545, y).strokeColor('#e5e7eb').stroke();

            // Table header
            y += 15;
            doc.fontSize(9).fillColor('#999999');
            doc.text('DESCRIPTION', 50, y);
            doc.text('AMOUNT', 400, y, { align: 'right' });

            y += 20;
            doc.moveTo(50, y).lineTo(545, y).strokeColor('#f3f4f6').stroke();

            // Line item
            y += 10;
            doc.fontSize(11).fillColor('#1a1a2e');
            const description = invoice.invoiceNumber
                ? `Invoice #${invoice.invoiceNumber}`
                : `Invoice for ${invoice.clientName}`;
            doc.text(description, 50, y);
            doc.text(`${currencySymbol}${amount}`, 400, y, { align: 'right' });

            // Late fee line (if applicable)
            const lateFeeAmt = invoice.lateFee?.applied ? invoice.lateFee.amount : 0;
            if (lateFeeAmt > 0) {
                y += 25;
                doc.fontSize(10).fillColor('#dc2626');
                doc.text('Late Fee', 50, y);
                doc.text(`${currencySymbol}${lateFeeAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 400, y, { align: 'right' });
            }

            // Total
            const totalDue = invoice.amount + lateFeeAmt - (invoice.paidAmount || 0);
            y += 40;
            doc.moveTo(300, y).lineTo(545, y).strokeColor('#e5e7eb').stroke();
            y += 15;

            if (lateFeeAmt > 0 || (invoice.paidAmount || 0) > 0) {
                doc.fontSize(10).fillColor('#999999').text('Subtotal', 300, y);
                doc.fontSize(10).fillColor('#1a1a2e').text(`${currencySymbol}${amount}`, 400, y, { align: 'right' });
                y += 18;

                if (lateFeeAmt > 0) {
                    doc.fontSize(10).fillColor('#999999').text('Late Fee', 300, y);
                    doc.fontSize(10).fillColor('#dc2626').text(`${currencySymbol}${lateFeeAmt.toFixed(2)}`, 400, y, { align: 'right' });
                    y += 18;
                }

                if ((invoice.paidAmount || 0) > 0) {
                    doc.fontSize(10).fillColor('#999999').text('Paid', 300, y);
                    doc.fontSize(10).fillColor('#16a34a').text(`-${currencySymbol}${invoice.paidAmount.toFixed(2)}`, 400, y, { align: 'right' });
                    y += 18;
                }

                doc.moveTo(300, y).lineTo(545, y).strokeColor('#e5e7eb').stroke();
                y += 10;
            }

            doc.fontSize(12).fillColor('#999999').text('Total Due', 300, y);
            doc.fontSize(16).fillColor('#1a1a2e').text(
                `${currencySymbol}${totalDue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                400, y - 2, { align: 'right' }
            );

            // Notes/Terms
            if (options.notes || options.terms) {
                y += 45;
                doc.moveTo(50, y).lineTo(545, y).strokeColor('#e5e7eb').stroke();
                y += 15;
                if (options.notes) {
                    doc.fontSize(9).fillColor('#999999').text('NOTES', 50, y);
                    y += 14;
                    doc.fontSize(9).fillColor('#666666').text(options.notes, 50, y, { width: 495 });
                    y += doc.heightOfString(options.notes, { width: 495 }) + 10;
                }
                if (options.terms) {
                    doc.fontSize(9).fillColor('#999999').text('TERMS', 50, y);
                    y += 14;
                    doc.fontSize(9).fillColor('#666666').text(options.terms, 50, y, { width: 495 });
                }
            }

            // Payment link + QR code
            const actionLink = invoice.portalToken
                ? `${process.env.FRONTEND_URL}/pay/${invoice.portalToken}`
                : invoice.paymentLink;

            if (actionLink) {
                y = Math.max(y + 30, 550);
                doc.moveTo(50, y).lineTo(545, y).strokeColor('#e5e7eb').stroke();
                y += 20;

                doc.fontSize(11).fillColor('#1a1a2e').text('Payment', 50, y);
                y += 18;
                doc.fontSize(9).fillColor('#2563eb').text(actionLink, 50, y, { link: actionLink });

                try {
                    const qrDataUrl = await QRCode.toDataURL(actionLink, { width: 100, margin: 1 });
                    const qrBuffer = Buffer.from(qrDataUrl.split(',')[1], 'base64');
                    doc.image(qrBuffer, 440, y - 15, { width: 80 });
                } catch {
                    // QR generation failed silently
                }
            }

            // Footer
            const footerY = 750;
            doc.moveTo(50, footerY).lineTo(545, footerY).strokeColor('#e5e7eb').stroke();

            if (options.footerLogo) {
                try {
                    const logoPath = path.join(__dirname, '..', options.footerLogo);
                    if (fs.existsSync(logoPath)) {
                        doc.image(logoPath, 240, footerY + 8, { height: 20 });
                    }
                } catch {
                    // skip
                }
            }

            const footerText = options.removeBranding
                ? companyName
                : 'Generated by ZeeRemind | zeeremind.com';
            doc.fontSize(8).fillColor('#999999').text(footerText, 50, footerY + 10, {
                align: 'center', width: 495
            });

            doc.end();
        } catch (err) {
            reject(err);
        }
    });
}

module.exports = { generateInvoicePdf };
