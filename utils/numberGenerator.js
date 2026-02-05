const Quotation = require('../models/Quotation');
const SaleOrder = require('../models/SaleOrder');

const generateQuotationNumber = async () => {
  try {
    // Get the latest quotation
    const latestQuotation = await Quotation.findOne()
      .sort({ quotationNumber: -1 })
      .select('quotationNumber');

    let nextNumber = 1;
    
    if (latestQuotation) {
      // Extract the number from the quotation number (e.g., "QT-0001" -> 1)
      const currentNumber = parseInt(latestQuotation.quotationNumber.split('-')[1]);
      nextNumber = currentNumber + 1;
    }

    // Format the number with leading zeros (e.g., 1 -> "QT-0001")
    return `QT-${nextNumber.toString().padStart(4, '0')}`;
  } catch (error) {
    throw new Error('Error generating quotation number');
  }
};

const generateOrderNumber = async () => {
  try {
    // Get the latest order
    const latestOrder = await SaleOrder.findOne()
      .sort({ orderNumber: -1 })
      .select('orderNumber');

    let nextNumber = 1;
    
    if (latestOrder) {
      // Extract the number from the order number (e.g., "SO-0001" -> 1)
      const currentNumber = parseInt(latestOrder.orderNumber.split('-')[1]);
      nextNumber = currentNumber + 1;
    }

    // Format the number with leading zeros (e.g., 1 -> "SO-0001")
    return `SO-${nextNumber.toString().padStart(4, '0')}`;
  } catch (error) {
    throw new Error('Error generating order number');
  }
};

module.exports = {
  generateQuotationNumber,
  generateOrderNumber
}; 