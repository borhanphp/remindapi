const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

class ReceiptGenerator {
  constructor(payment, invoice, customer) {
    this.payment = payment;
    this.invoice = invoice;
    this.customer = customer;
    this.doc = new PDFDocument({ margin: 50 });
  }

  generateHeader() {
    // Add company logo
    // this.doc.image('path/to/logo.png', 50, 45, { width: 50 })
    this.doc
      .fillColor('#444444')
      .fontSize(20)
      .text('Payment Receipt', 110, 57)
      .fontSize(10)
      .text('ACME Inc.', 200, 50, { align: 'right' })
      .text('123 Main Street', 200, 65, { align: 'right' })
      .text('New York, NY, 10025', 200, 80, { align: 'right' })
      .moveDown();
  }

  generateReceiptInfo() {
    this.doc
      .fillColor('#444444')
      .fontSize(20)
      .text('Receipt', 50, 160);

    this.generateHr(150);

    const customerInformationTop = 200;

    this.doc
      .fontSize(10)
      .text('Receipt Number:', 50, customerInformationTop)
      .font('Helvetica-Bold')
      .text(this.payment.receiptNumber, 150, customerInformationTop)
      .font('Helvetica')
      .text('Payment Date:', 50, customerInformationTop + 15)
      .text(this.formatDate(this.payment.paymentDate), 150, customerInformationTop + 15)
      .text('Payment Method:', 50, customerInformationTop + 30)
      .text(
        this.payment.paymentMethod.split('_').map(word => 
          word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' '),
        150,
        customerInformationTop + 30
      )
      .text('Status:', 50, customerInformationTop + 45)
      .text(
        this.payment.status.charAt(0).toUpperCase() + this.payment.status.slice(1),
        150,
        customerInformationTop + 45
      )
      .text('Reference:', 50, customerInformationTop + 60)
      .text(this.payment.reference || 'N/A', 150, customerInformationTop + 60)

      .text('Customer:', 300, customerInformationTop)
      .font('Helvetica-Bold')
      .text(this.customer.name, 400, customerInformationTop)
      .font('Helvetica')
      .text('Invoice Number:', 300, customerInformationTop + 15)
      .text(this.invoice.invoiceNumber, 400, customerInformationTop + 15)
      .text('Email:', 300, customerInformationTop + 30)
      .text(this.customer.email, 400, customerInformationTop + 30)
      .text('Address:', 300, customerInformationTop + 45)
      .text(this.customer.address, 400, customerInformationTop + 45)
      .moveDown();

    this.generateHr(customerInformationTop + 85);
  }

  generatePaymentDetails() {
    const paymentDetailsTop = 330;

    this.doc
      .fontSize(10)
      .text('Payment Details', 50, paymentDetailsTop)
      .moveDown();

    // Add payment method specific details
    if (this.payment.paymentMethod === 'bank_transfer' && this.payment.bankDetails) {
      this.doc
        .text('Bank Name:', 50, paymentDetailsTop + 20)
        .text(this.payment.bankDetails.bankName || 'N/A', 150, paymentDetailsTop + 20)
        .text('Account Number:', 50, paymentDetailsTop + 35)
        .text(this.payment.bankDetails.accountNumber || 'N/A', 150, paymentDetailsTop + 35)
        .text('Transaction ID:', 50, paymentDetailsTop + 50)
        .text(this.payment.bankDetails.transactionId || 'N/A', 150, paymentDetailsTop + 50);
    } else if (this.payment.paymentMethod === 'check' && this.payment.checkDetails) {
      this.doc
        .text('Check Number:', 50, paymentDetailsTop + 20)
        .text(this.payment.checkDetails.checkNumber || 'N/A', 150, paymentDetailsTop + 20)
        .text('Bank Name:', 50, paymentDetailsTop + 35)
        .text(this.payment.checkDetails.bankName || 'N/A', 150, paymentDetailsTop + 35)
        .text('Check Date:', 50, paymentDetailsTop + 50)
        .text(this.formatDate(this.payment.checkDetails.checkDate) || 'N/A', 150, paymentDetailsTop + 50);
    } else if (this.payment.paymentMethod === 'credit_card' && this.payment.cardDetails) {
      this.doc
        .text('Card Type:', 50, paymentDetailsTop + 20)
        .text(
          this.payment.cardDetails.cardType.charAt(0).toUpperCase() + 
          this.payment.cardDetails.cardType.slice(1) || 'N/A',
          150,
          paymentDetailsTop + 20
        )
        .text('Last 4 Digits:', 50, paymentDetailsTop + 35)
        .text(this.payment.cardDetails.lastFourDigits || 'N/A', 150, paymentDetailsTop + 35)
        .text('Transaction ID:', 50, paymentDetailsTop + 50)
        .text(this.payment.cardDetails.transactionId || 'N/A', 150, paymentDetailsTop + 50);
    }

    this.generateHr(paymentDetailsTop + 85);
  }

  generateTable() {
    const tableTop = 450;

    this.doc
      .fontSize(10)
      .text('Payment Summary', 50, tableTop)
      .moveDown();

    this.doc
      .fontSize(10)
      .text('Invoice Total:', 50, tableTop + 30)
      .text(`$${this.formatAmount(this.invoice.totalAmount)}`, 150, tableTop + 30)
      .text('Amount Paid:', 50, tableTop + 45)
      .text(`$${this.formatAmount(this.payment.amount)}`, 150, tableTop + 45)
      .text('Balance Due:', 50, tableTop + 60)
      .text(`$${this.formatAmount(this.invoice.balanceAmount)}`, 150, tableTop + 60)
      .moveDown();

    this.generateHr(tableTop + 85);
  }

  generateFooter() {
    this.doc
      .fontSize(10)
      .text(
        'This is a computer-generated receipt and does not require a signature.',
        50,
        this.doc.page.height - 100,
        { align: 'center', width: 500 }
      );
  }

  generateHr(y) {
    this.doc
      .strokeColor('#aaaaaa')
      .lineWidth(1)
      .moveTo(50, y)
      .lineTo(550, y)
      .stroke();
  }

  formatDate(date) {
    const d = new Date(date);
    return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
  }

  formatAmount(amount) {
    return amount.toFixed(2);
  }

  async generate() {
    const receiptDirectory = path.join(process.cwd(), 'uploads', 'receipts');
    if (!fs.existsSync(receiptDirectory)) {
      fs.mkdirSync(receiptDirectory, { recursive: true });
    }

    const filename = `${this.payment.receiptNumber}.pdf`;
    const filepath = path.join(receiptDirectory, filename);

    return new Promise((resolve, reject) => {
      const stream = fs.createWriteStream(filepath);
      this.doc.pipe(stream);

      this.generateHeader();
      this.generateReceiptInfo();
      this.generatePaymentDetails();
      this.generateTable();
      this.generateFooter();

      this.doc.end();

      stream.on('finish', () => resolve(filepath));
      stream.on('error', reject);
    });
  }
}

module.exports = ReceiptGenerator; 