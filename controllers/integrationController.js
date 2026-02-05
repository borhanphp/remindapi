const IntegrationService = require('../services/integrationService');
const { isModuleEnabled } = require('../config/modules');
const asyncHandler = require('../middleware/async');
const { Activity } = require('../models');

// Get integration status
const getIntegrationStatus = async (req, res) => {
  try {
    const status = await IntegrationService.getIntegrationStatus(req.user.organization);
    
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Initialize accounting for organization
const initializeAccounting = async (req, res) => {
  try {
    const result = await IntegrationService.initializeAccountingForOrganization(
      req.user.organization,
      req.user.userId
    );
    
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Sync inventory to accounting
const syncInventoryToAccounting = async (req, res) => {
  try {
    const result = await IntegrationService.syncInventoryToAccounting(
      req.user.organization,
      req.user.userId
    );
    
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Test integration (for development/testing)
const testIntegration = async (req, res) => {
  try {
    const { type, data } = req.body;
    
    let result;
    switch (type) {
      case 'sale':
        result = await IntegrationService.handleSaleTransaction(
          { ...data, organizationId: req.user.organization },
          req.user.userId
        );
        break;
        
      case 'purchase':
        result = await IntegrationService.handlePurchaseTransaction(
          { ...data, organizationId: req.user.organization },
          req.user.userId
        );
        break;
        
      case 'adjustment':
        result = await IntegrationService.handleStockAdjustment(
          { ...data, organizationId: req.user.organization },
          req.user.userId
        );
        break;
        
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid integration test type'
        });
    }
    
    res.json({
      success: true,
      data: result,
      message: 'Integration test completed'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  getIntegrationStatus,
  initializeAccounting,
  syncInventoryToAccounting,
  testIntegration,
  // Webhook stubs for automatic logging
  gmailWebhook: asyncHandler(async (req, res) => {
    // TODO: Parse Gmail Pub/Sub; example creates a placeholder activity
    await Activity.create({
      organization: req.user.organization,
      type: 'email',
      subject: req.body?.subject || 'Email Received',
      content: (req.body && JSON.stringify(req.body).slice(0, 1000)) || '',
      relatedType: req.body?.relatedType || 'customer',
      relatedId: req.body?.relatedId,
      owner: req.user.userId,
      timestamp: new Date()
    });
    res.json({ success: true });
  }),
  twilioWebhook: asyncHandler(async (req, res) => {
    const { From, To, CallStatus, relatedType, relatedId } = req.body || {};
    await Activity.create({
      organization: req.user.organization,
      type: 'call',
      subject: `Call ${CallStatus || 'event'}`,
      content: `From ${From || ''} to ${To || ''}`,
      relatedType: relatedType || 'customer',
      relatedId,
      owner: req.user.userId,
      timestamp: new Date()
    });
    res.json({ success: true });
  }),
  calendarWebhook: asyncHandler(async (req, res) => {
    const { summary, start, relatedType, relatedId } = req.body || {};
    await Activity.create({
      organization: req.user.organization,
      type: 'meeting',
      subject: summary || 'Meeting',
      content: (req.body && JSON.stringify(req.body).slice(0, 1000)) || '',
      relatedType: relatedType || 'customer',
      relatedId,
      owner: req.user.userId,
      timestamp: start?.dateTime ? new Date(start.dateTime) : new Date()
    });
    res.json({ success: true });
  })
}; 