const { isModuleEnabled } = require('../config/modules');

class IntegrationService {
  
  /**
   * Handle sale transaction - create COGS and inventory reduction entries
   */
  static async handleSaleTransaction(saleData, userId) {
    if (!isModuleEnabled('accounting')) {
      return null; // Skip if accounting module is disabled
    }
    
    try {
      const { items, organizationId, saleId } = saleData;
      
    
      
      return { success: true, message: 'Accounting entries created for sale' };
    } catch (error) {
      console.error('Error creating accounting entries for sale:', error);
      // Don't throw error - let the sale complete even if accounting fails
      return { success: false, message: error.message };
    }
  }
  
  /**
   * Handle purchase transaction - create inventory increase entries
   */
  static async handlePurchaseTransaction(purchaseData, userId) {
    if (!isModuleEnabled('accounting')) {
      return null;
    }
    
    try {
      const { items, organizationId, purchaseId } = purchaseData;
      
    
      
      return { success: true, message: 'Accounting entries created for purchase' };
    } catch (error) {
      console.error('Error creating accounting entries for purchase:', error);
      return { success: false, message: error.message };
    }
  }
  
  /**
   * Handle stock adjustment - create inventory adjustment entries
   */
  static async handleStockAdjustment(adjustmentData, userId) {
    if (!isModuleEnabled('accounting')) {
      return null;
    }
    
    try {
      const { productId, adjustmentValue, organizationId, adjustmentId, adjustmentType } = adjustmentData;
      const ChartOfAccount = require('../models/ChartOfAccount');
      
      // Get inventory account and appropriate expense/equity account based on adjustment type
      const inventoryAccount = await ChartOfAccount.findOne({ 
        organization: organizationId, 
        accountCode: '1300', 
        isSystemAccount: true 
      });
      
      let offsetAccount;
      let description = '';
      
      switch (adjustmentType) {
        case 'damaged':
          offsetAccount = await ChartOfAccount.findOne({ 
            organization: organizationId, 
            accountCode: '5110' // Inventory Write-off (Damaged)
          });
          description = 'Inventory write-off - Damaged goods';
          break;
        case 'lost':
          offsetAccount = await ChartOfAccount.findOne({ 
            organization: organizationId, 
            accountCode: '5120' // Inventory Write-off (Lost)
          });
          description = 'Inventory write-off - Lost goods';
          break;
        case 'expired':
          offsetAccount = await ChartOfAccount.findOne({ 
            organization: organizationId, 
            accountCode: '5130' // Inventory Write-off (Expired)
          });
          description = 'Inventory write-off - Expired goods';
          break;
        case 'opening_stock':
          offsetAccount = await ChartOfAccount.findOne({ 
            organization: organizationId, 
            accountCode: '3000' // Owner Equity for opening balance
          });
          description = 'Opening inventory balance';
          break;
        case 'returned':
          offsetAccount = await ChartOfAccount.findOne({ 
            organization: organizationId, 
            accountCode: '5100' // Inventory Adjustments
          });
          description = 'Inventory adjustment - Goods returned';
          break;
        default:
          offsetAccount = await ChartOfAccount.findOne({ 
            organization: organizationId, 
            accountCode: '5100' // General Inventory Adjustments
          });
          description = 'Inventory adjustment';
      }
      
      // Create default accounts if they don't exist
      if (!offsetAccount) {
        offsetAccount = await ChartOfAccount.findOne({ 
          organization: organizationId, 
          accountCode: '5100'
        });
        if (!offsetAccount) {
          offsetAccount = await ChartOfAccount.findOne({ 
            organization: organizationId, 
            accountCode: '3000'
          });
        }
      }
      
      if (!inventoryAccount || !offsetAccount) {
        return { success: false, message: 'Required accounts not found' };
      }
      
      const absValue = Math.abs(adjustmentValue);
      let journalLines = [];
      
      if (adjustmentValue > 0) {
        // Increase in inventory
        journalLines = [
          {
            account: inventoryAccount._id,
            description: description,
            debitAmount: absValue,
            creditAmount: 0
          },
          {
            account: offsetAccount._id,
            description: description,
            debitAmount: 0,
            creditAmount: absValue
          }
        ];
      } else {
        // Decrease in inventory (damaged, lost, expired)
        journalLines = [
          {
            account: offsetAccount._id,
            description: description,
            debitAmount: absValue,
            creditAmount: 0
          },
          {
            account: inventoryAccount._id,
            description: description,
            debitAmount: 0,
            creditAmount: absValue
          }
        ];
      }
      
      const entryData = {
        entryDate: new Date(),
        description: description,
        journalLines,
        organization: organizationId,
        sourceDocument: {
          documentType: 'StockAdjustment',
          documentId: adjustmentId
        }
      };
      
      
      return { success: true, message: 'Accounting entry created for stock adjustment' };
    } catch (error) {
      console.error('Error creating accounting entry for stock adjustment:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Handle customer payment - create cash and AR entries
   */
  static async handleCustomerPayment(paymentData, userId) {
    if (!isModuleEnabled('accounting')) {
      return null;
    }
    
    try {
      const { amount, paymentMethod, customerId, invoiceId, organizationId, paymentId } = paymentData;
      
      // Get necessary accounts
      const ChartOfAccount = require('../models/ChartOfAccount');
      let cashAccountCode = '1000'; // Default cash account
      
      // Use different cash accounts based on payment method
      switch (paymentMethod) {
        case 'bank_transfer':
          cashAccountCode = '1010'; // Bank account
          break;
        case 'credit_card':
          cashAccountCode = '1000'; // Cash account (or could be a specific credit card receivable account)
          break;
        case 'check':
          cashAccountCode = '1000'; // Cash account
          break;
        default:
          cashAccountCode = '1000'; // Cash account
      }
      
      const [cashAccount, arAccount] = await Promise.all([
        ChartOfAccount.findOne({ organization: organizationId, accountCode: cashAccountCode }),
        ChartOfAccount.findOne({ organization: organizationId, accountCode: '1200' }) // Accounts Receivable
      ]);
      
      if (cashAccount && arAccount) {
        const entryData = {
          entryDate: new Date(),
          description: `Customer payment received - Invoice ${invoiceId}`,
          journalLines: [
            {
              account: cashAccount._id,
              description: `Payment received via ${paymentMethod}`,
              debitAmount: amount,
              creditAmount: 0
            },
            {
              account: arAccount._id,
              description: `Payment against customer receivable`,
              debitAmount: 0,
              creditAmount: amount
            }
          ],
          organization: organizationId,
          sourceDocument: {
            documentType: 'SalePayment',
            documentId: paymentId
          }
        };
        
        
        return { success: true, message: 'Accounting entries created for customer payment' };
      } else {
        return { success: false, message: 'Required accounts not found' };
      }
    } catch (error) {
      console.error('Error creating accounting entries for payment:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Handle sale invoice creation - create AR and revenue entries
   */
  static async handleSaleInvoice(invoiceData, userId) {
    if (!isModuleEnabled('accounting')) {
      return null;
    }
    
    try {
      const { totalAmount, customerId, invoiceId, organizationId, items, taxAmount } = invoiceData;
      
      // Get necessary accounts
      const ChartOfAccount = require('../models/ChartOfAccount');
      const [arAccount, revenueAccount, taxAccount] = await Promise.all([
        ChartOfAccount.findOne({ organization: organizationId, accountCode: '1200' }), // Accounts Receivable
        ChartOfAccount.findOne({ organization: organizationId, accountCode: '4000' }),  // Sales Revenue
        ChartOfAccount.findOne({ organization: organizationId, accountCode: '2100' })   // Sales Tax Payable
      ]);
      
      if (arAccount && revenueAccount) {
        const journalLines = [
          {
            account: arAccount._id,
            description: `Customer receivable`,
            debitAmount: totalAmount,
            creditAmount: 0
          }
        ];
        
        // Add revenue line (net of tax if tax is separate)
        const netRevenue = taxAmount && taxAccount ? totalAmount - taxAmount : totalAmount;
        journalLines.push({
          account: revenueAccount._id,
          description: `Sales revenue`,
          debitAmount: 0,
          creditAmount: netRevenue
        });
        
        // Add tax liability if applicable
        if (taxAmount && taxAmount > 0 && taxAccount) {
          journalLines.push({
            account: taxAccount._id,
            description: `Sales tax payable`,
            debitAmount: 0,
            creditAmount: taxAmount
          });
        }
        
        const entryData = {
          entryDate: new Date(),
          description: `Sale invoice created - ${invoiceId}`,
          journalLines,
          organization: organizationId,
          sourceDocument: {
            documentType: 'SaleInvoice',
            documentId: invoiceId
          }
        };
        
        
        return { success: true, message: 'Accounting entries created for sale invoice' };
      } else {
        return { success: false, message: 'Required accounts not found' };
      }
    } catch (error) {
      console.error('Error creating accounting entries for sale invoice:', error);
      return { success: false, message: error.message };
    }
  }
  
  /**
   * Handle sale return - create entries to reverse AR and credit inventory
   */
  static async handleSaleReturn(returnData, userId) {
    if (!isModuleEnabled('accounting')) {
      return null;
    }
    
    try {
      const { returnId, invoiceId, customerId, organizationId, items, refundAmount, restockItems } = returnData;
      const ChartOfAccount = require('../models/ChartOfAccount');
      
      // Get necessary accounts
      const [arAccount, revenueAccount, salesReturnsAccount, inventoryAccount, cogsAccount] = await Promise.all([
        ChartOfAccount.findOne({ organization: organizationId, accountCode: '1200' }), // Accounts Receivable
        ChartOfAccount.findOne({ organization: organizationId, accountCode: '4000' }), // Sales Revenue
        ChartOfAccount.findOne({ organization: organizationId, accountCode: '4100' }), // Sales Returns & Allowances
        ChartOfAccount.findOne({ organization: organizationId, accountCode: '1300' }), // Inventory
        ChartOfAccount.findOne({ organization: organizationId, accountCode: '5000' })  // Cost of Goods Sold
      ]);
      
      if (!arAccount || !revenueAccount || !inventoryAccount || !cogsAccount) {
        return { success: false, message: 'Required accounts not found' };
      }
      
      // Use sales returns account if available, otherwise reverse revenue directly
      const revenueOffsetAccount = salesReturnsAccount || revenueAccount;
      
      // Journal entry for the return: Reverse the sale
      // Dr. Sales Returns / Cr. Accounts Receivable
      const journalLines = [
        {
          account: revenueOffsetAccount._id,
          description: `Sale return - Invoice ${invoiceId}`,
          debitAmount: refundAmount,
          creditAmount: 0
        },
        {
          account: arAccount._id,
          description: `Sale return - Reduce customer receivable`,
          debitAmount: 0,
          creditAmount: refundAmount
        }
      ];
      
      // If items are being restocked, reverse the COGS entry
      // Dr. Inventory / Cr. COGS
      if (restockItems && restockItems.length > 0) {
        let totalCOGS = 0;
        for (const item of restockItems) {
          totalCOGS += (item.unitCost || 0) * item.quantity;
        }
        
        if (totalCOGS > 0) {
          journalLines.push(
            {
              account: inventoryAccount._id,
              description: `Sale return - Restock inventory`,
              debitAmount: totalCOGS,
              creditAmount: 0
            },
            {
              account: cogsAccount._id,
              description: `Sale return - Reverse COGS`,
              debitAmount: 0,
              creditAmount: totalCOGS
            }
          );
        }
      }
      
      const entryData = {
        entryDate: new Date(),
        description: `Sale return processed - Return ${returnId}`,
        journalLines,
        organization: organizationId,
        sourceDocument: {
          documentType: 'SaleReturn',
          documentId: returnId
        }
      };
      
      
      return { success: true, message: 'Accounting entries created for sale return' };
    } catch (error) {
      console.error('Error creating accounting entries for sale return:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Handle purchase invoice - create AP and inventory entries
   */
  static async handlePurchaseInvoice(invoiceData, userId) {
    if (!isModuleEnabled('accounting')) {
      return null;
    }
    
    try {
      const { totalAmount, vendorId, invoiceId, organizationId, items, taxAmount } = invoiceData;
      const ChartOfAccount = require('../models/ChartOfAccount');
      
      // Get necessary accounts
      const [apAccount, inventoryAccount, taxAccount] = await Promise.all([
        ChartOfAccount.findOne({ organization: organizationId, accountCode: '2000' }), // Accounts Payable
        ChartOfAccount.findOne({ organization: organizationId, accountCode: '1300' }), // Inventory
        ChartOfAccount.findOne({ organization: organizationId, accountCode: '2100' })  // Tax Payable
      ]);
      
      if (!apAccount || !inventoryAccount) {
        return { success: false, message: 'Required accounts not found' };
      }
      
      // Calculate inventory value
      let inventoryValue = 0;
      for (const item of items) {
        inventoryValue += (item.unitCost || item.cost || 0) * item.quantity;
      }
      
      const journalLines = [
        {
          account: inventoryAccount._id,
          description: `Purchase - Inventory increase`,
          debitAmount: inventoryValue,
          creditAmount: 0
        }
      ];
      
      // Add input tax if applicable
      if (taxAmount && taxAmount > 0 && taxAccount) {
        journalLines.push({
          account: taxAccount._id,
          description: `Purchase - Input Tax`,
          debitAmount: taxAmount,
          creditAmount: 0
        });
      }
      
      // Credit AP for total
      journalLines.push({
        account: apAccount._id,
        description: `Purchase - Vendor payable`,
        debitAmount: 0,
        creditAmount: totalAmount
      });
      
      const entryData = {
        entryDate: new Date(),
        description: `Purchase invoice - ${invoiceId}`,
        journalLines,
        organization: organizationId,
        sourceDocument: {
          documentType: 'PurchaseInvoice',
          documentId: invoiceId
        }
      };
      
      
      return { success: true, message: 'Accounting entries created for purchase invoice' };
    } catch (error) {
      console.error('Error creating accounting entries for purchase invoice:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Initialize accounting integration for existing organization
   */
  static async initializeAccountingForOrganization(organizationId, userId) {
    if (!isModuleEnabled('accounting')) {
      throw new Error('Accounting module is not enabled');
    }
    
    try {
      // Initialize chart of accounts
      
      return {
        success: true,
        message: 'Accounting system initialized successfully',
        data: { accountsCreated: accounts.length }
      };
    } catch (error) {
      throw new Error(`Failed to initialize accounting: ${error.message}`);
    }
  }
  
  /**
   * Get integration status for an organization
   */
  static async getIntegrationStatus(organizationId) {
    const status = {
      modules: {
        inventory: isModuleEnabled('inventory'),
        accounting: isModuleEnabled('accounting')
      },
      integration: {
        enabled: isModuleEnabled('inventory') && isModuleEnabled('accounting'),
        accountingInitialized: false
      }
    };
    
    if (isModuleEnabled('accounting')) {
      // Check if chart of accounts exists
      const ChartOfAccount = require('../models/ChartOfAccount');
      const accountCount = await ChartOfAccount.countDocuments({ organization: organizationId });
      status.integration.accountingInitialized = accountCount > 0;
    }
    
    return status;
  }
  
  /**
   * Sync existing inventory data to accounting (one-time migration)
   */
  static async syncInventoryToAccounting(organizationId, userId) {
    if (!isModuleEnabled('accounting') || !isModuleEnabled('inventory')) {
      throw new Error('Both inventory and accounting modules must be enabled');
    }
    
    try {
      // Get current inventory values
      const Product = require('../models/Product');
      const products = await Product.find({ organization: organizationId });
      
      const journalLines = [];
      let totalInventoryValue = 0;
      
      for (let product of products) {
        const inventoryValue = (product.stock || 0) * (product.cost || 0);
        if (inventoryValue > 0) {
          totalInventoryValue += inventoryValue;
        }
      }
      
      if (totalInventoryValue > 0) {
        // Get system accounts
        const ChartOfAccount = require('../models/ChartOfAccount');
        const [inventoryAccount, equityAccount] = await Promise.all([
          ChartOfAccount.findOne({ organization: organizationId, accountCode: '1300', isSystemAccount: true }),
          ChartOfAccount.findOne({ organization: organizationId, accountCode: '3000' })
        ]);
        
        // Create opening balance entry
        const entryData = {
          entryDate: new Date(),
          description: 'Opening inventory balance',
          journalLines: [
            {
              account: inventoryAccount._id,
              description: 'Opening inventory balance',
              debitAmount: totalInventoryValue,
              creditAmount: 0
            },
            {
              account: equityAccount._id,
              description: 'Opening inventory balance',
              debitAmount: 0,
              creditAmount: totalInventoryValue
            }
          ],
          organization: organizationId,
          sourceDocument: {
            documentType: 'Manual'
          }
        };
        
        
        return {
          success: true,
          message: 'Inventory synced to accounting successfully',
          data: { totalInventoryValue, productsProcessed: products.length }
        };
      }
      
      return {
        success: true,
        message: 'No inventory value to sync',
        data: { totalInventoryValue: 0, productsProcessed: 0 }
      };
      
    } catch (error) {
      throw new Error(`Failed to sync inventory to accounting: ${error.message}`);
    }
  }
}

module.exports = IntegrationService; 