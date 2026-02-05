const EmailTemplate = require('../models/EmailTemplate');
const EmailCampaign = require('../models/EmailCampaign');
const EmailSequence = require('../models/EmailSequence');
const EmailSequenceEnrollment = require('../models/EmailSequenceEnrollment');
const EmailLog = require('../models/EmailLog');
const EmailUnsubscribe = require('../models/EmailUnsubscribe');
const Segment = require('../models/Segment');
const Lead = require('../models/Lead');
const Contact = require('../models/Contact');
const Customer = require('../models/Customer');
const crypto = require('crypto');

// ============================================
// EMAIL TEMPLATES
// ============================================

exports.createTemplate = async (req, res, next) => {
  try {
    const { name, subject, body, bodyHtml, category, variables, tags } = req.body;
    
    const template = await EmailTemplate.create({
      organization: req.user.organization,
      name,
      subject,
      body,
      bodyHtml,
      category,
      variables,
      tags,
      createdBy: req.user._id
    });
    
    res.status(201).json({ success: true, data: template });
  } catch (error) {
    next(error);
  }
};

exports.getTemplates = async (req, res, next) => {
  try {
    const { category, search, page = 1, limit = 20 } = req.query;
    
    const query = { organization: req.user.organization };
    if (category) query.category = category;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { subject: { $regex: search, $options: 'i' } }
      ];
    }
    
    const skip = (page - 1) * limit;
    const [templates, total] = await Promise.all([
      EmailTemplate.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('createdBy', 'name email'),
      EmailTemplate.countDocuments(query)
    ]);
    
    res.json({
      success: true,
      data: templates,
      pagination: { page: parseInt(page), limit: parseInt(limit), total }
    });
  } catch (error) {
    next(error);
  }
};

exports.getTemplate = async (req, res, next) => {
  try {
    const template = await EmailTemplate.findOne({
      _id: req.params.id,
      organization: req.user.organization
    }).populate('createdBy', 'name email');
    
    if (!template) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }
    
    res.json({ success: true, data: template });
  } catch (error) {
    next(error);
  }
};

exports.updateTemplate = async (req, res, next) => {
  try {
    const { name, subject, body, bodyHtml, category, variables, tags, isActive } = req.body;
    
    const template = await EmailTemplate.findOneAndUpdate(
      { _id: req.params.id, organization: req.user.organization },
      { name, subject, body, bodyHtml, category, variables, tags, isActive },
      { new: true, runValidators: true }
    );
    
    if (!template) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }
    
    res.json({ success: true, data: template });
  } catch (error) {
    next(error);
  }
};

exports.deleteTemplate = async (req, res, next) => {
  try {
    const template = await EmailTemplate.findOneAndDelete({
      _id: req.params.id,
      organization: req.user.organization
    });
    
    if (!template) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }
    
    res.json({ success: true, message: 'Template deleted' });
  } catch (error) {
    next(error);
  }
};

// ============================================
// EMAIL CAMPAIGNS
// ============================================

exports.createCampaign = async (req, res, next) => {
  try {
    const {
      name, subject, body, bodyHtml, template,
      recipientType, segment, recipientList,
      scheduledAt, fromName, fromEmail, replyTo,
      trackOpens, trackClicks, tags
    } = req.body;
    
    // Calculate total recipients
    let totalRecipients = 0;
    if (recipientType === 'list' && recipientList) {
      totalRecipients = recipientList.length;
    } else if (recipientType === 'segment' && segment) {
      // Get segment customer count
      const segmentDoc = await Segment.findById(segment);
      if (segmentDoc) {
        const customers = await Customer.find({
          organization: req.user.organization,
          ...segmentDoc.criteria
        }).countDocuments();
        totalRecipients = customers;
      }
    }
    
    const campaign = await EmailCampaign.create({
      organization: req.user.organization,
      name, subject, body, bodyHtml, template,
      recipientType, segment, recipientList,
      totalRecipients,
      scheduledAt: scheduledAt || null,
      status: scheduledAt ? 'scheduled' : 'draft',
      fromName, fromEmail, replyTo,
      trackOpens, trackClicks,
      tags,
      createdBy: req.user._id
    });
    
    res.status(201).json({ success: true, data: campaign });
  } catch (error) {
    next(error);
  }
};

exports.getCampaigns = async (req, res, next) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    
    const query = { organization: req.user.organization };
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { subject: { $regex: search, $options: 'i' } }
      ];
    }
    
    const skip = (page - 1) * limit;
    const [campaigns, total] = await Promise.all([
      EmailCampaign.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('createdBy', 'name email')
        .populate('template', 'name')
        .populate('segment', 'name'),
      EmailCampaign.countDocuments(query)
    ]);
    
    res.json({
      success: true,
      data: campaigns,
      pagination: { page: parseInt(page), limit: parseInt(limit), total }
    });
  } catch (error) {
    next(error);
  }
};

exports.getCampaign = async (req, res, next) => {
  try {
    const campaign = await EmailCampaign.findOne({
      _id: req.params.id,
      organization: req.user.organization
    })
      .populate('createdBy', 'name email')
      .populate('template', 'name subject body')
      .populate('segment', 'name description');
    
    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }
    
    res.json({ success: true, data: campaign });
  } catch (error) {
    next(error);
  }
};

exports.updateCampaign = async (req, res, next) => {
  try {
    const campaign = await EmailCampaign.findOne({
      _id: req.params.id,
      organization: req.user.organization
    });
    
    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }
    
    // Prevent updating sent campaigns
    if (campaign.status === 'sent' || campaign.status === 'sending') {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot update campaign that is sent or sending' 
      });
    }
    
    const {
      name, subject, body, bodyHtml, template,
      recipientType, segment, recipientList,
      scheduledAt, fromName, fromEmail, replyTo,
      trackOpens, trackClicks, tags, status
    } = req.body;
    
    Object.assign(campaign, {
      name, subject, body, bodyHtml, template,
      recipientType, segment, recipientList,
      scheduledAt, fromName, fromEmail, replyTo,
      trackOpens, trackClicks, tags, status
    });
    
    await campaign.save();
    
    res.json({ success: true, data: campaign });
  } catch (error) {
    next(error);
  }
};

exports.deleteCampaign = async (req, res, next) => {
  try {
    const campaign = await EmailCampaign.findOneAndDelete({
      _id: req.params.id,
      organization: req.user.organization
    });
    
    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }
    
    res.json({ success: true, message: 'Campaign deleted' });
  } catch (error) {
    next(error);
  }
};

exports.sendCampaign = async (req, res, next) => {
  try {
    const campaign = await EmailCampaign.findOne({
      _id: req.params.id,
      organization: req.user.organization
    });
    
    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }
    
    if (campaign.status === 'sent' || campaign.status === 'sending') {
      return res.status(400).json({ 
        success: false, 
        message: 'Campaign already sent or sending' 
      });
    }
    
    // Get recipients
    let recipients = [];
    
    if (campaign.recipientType === 'list') {
      recipients = campaign.recipientList.map(email => ({ email }));
    } else if (campaign.recipientType === 'segment' && campaign.segment) {
      const segmentDoc = await Segment.findById(campaign.segment);
      if (segmentDoc) {
        const customers = await Customer.find({
          organization: req.user.organization,
          ...segmentDoc.criteria
        }).select('email name');
        recipients = customers.filter(c => c.email).map(c => ({
          email: c.email,
          name: c.name,
          recipientType: 'customer',
          recipientId: c._id
        }));
      }
    }
    
    // Filter out unsubscribed emails
    const unsubscribedEmails = await EmailUnsubscribe.find({
      organization: req.user.organization,
      email: { $in: recipients.map(r => r.email) },
      isActive: true
    }).select('email');
    
    const unsubSet = new Set(unsubscribedEmails.map(u => u.email));
    recipients = recipients.filter(r => !unsubSet.has(r.email));
    
    // Create email logs for each recipient
    const emailLogs = recipients.map(recipient => ({
      organization: req.user.organization,
      campaign: campaign._id,
      to: recipient.email,
      from: campaign.fromEmail,
      subject: campaign.subject,
      body: campaign.body,
      bodyHtml: campaign.bodyHtml,
      recipientType: recipient.recipientType || 'other',
      recipientId: recipient.recipientId,
      recipientName: recipient.name,
      status: 'queued',
      trackingId: crypto.randomBytes(16).toString('hex'),
      sentBy: req.user._id
    }));
    
    await EmailLog.insertMany(emailLogs);
    
    // Update campaign
    campaign.status = 'sending';
    campaign.sentAt = new Date();
    campaign.stats.sent = recipients.length;
    await campaign.save();
    
    // In production, this would trigger actual email sending via queue/worker
    // For now, we'll mark them as sent immediately
    setTimeout(async () => {
      await EmailLog.updateMany(
        { campaign: campaign._id, status: 'queued' },
        { status: 'sent', sentAt: new Date() }
      );
      
      campaign.status = 'sent';
      campaign.completedAt = new Date();
      await campaign.save();
    }, 1000);
    
    res.json({ 
      success: true, 
      message: `Campaign queued for ${recipients.length} recipients`,
      data: campaign 
    });
  } catch (error) {
    next(error);
  }
};

exports.getCampaignStats = async (req, res, next) => {
  try {
    const campaign = await EmailCampaign.findOne({
      _id: req.params.id,
      organization: req.user.organization
    });
    
    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }
    
    // Get detailed stats from email logs
    const logs = await EmailLog.find({ campaign: campaign._id });
    
    const stats = {
      sent: logs.filter(l => l.status === 'sent' || l.status === 'delivered').length,
      delivered: logs.filter(l => l.status === 'delivered').length,
      bounced: logs.filter(l => l.status === 'bounced').length,
      failed: logs.filter(l => l.status === 'failed').length,
      opened: logs.filter(l => l.opened).length,
      clicked: logs.filter(l => l.clicked).length,
      uniqueOpens: new Set(logs.filter(l => l.opened).map(l => l.to)).size,
      uniqueClicks: new Set(logs.filter(l => l.clicked).map(l => l.to)).size,
      totalOpens: logs.reduce((sum, l) => sum + (l.openCount || 0), 0),
      totalClicks: logs.reduce((sum, l) => sum + (l.clickCount || 0), 0),
    };
    
    stats.openRate = stats.sent > 0 ? ((stats.uniqueOpens / stats.sent) * 100).toFixed(2) : 0;
    stats.clickRate = stats.sent > 0 ? ((stats.uniqueClicks / stats.sent) * 100).toFixed(2) : 0;
    stats.bounceRate = stats.sent > 0 ? ((stats.bounced / stats.sent) * 100).toFixed(2) : 0;
    
    // Update campaign stats
    campaign.stats = {
      ...campaign.stats.toObject(),
      ...stats,
      openRate: parseFloat(stats.openRate),
      clickRate: parseFloat(stats.clickRate),
      bounceRate: parseFloat(stats.bounceRate)
    };
    await campaign.save();
    
    res.json({ success: true, data: stats });
  } catch (error) {
    next(error);
  }
};

// ============================================
// EMAIL SEQUENCES (DRIP CAMPAIGNS)
// ============================================

exports.createSequence = async (req, res, next) => {
  try {
    const {
      name, description, steps, status,
      enrollmentTrigger, triggerConditions, segment,
      exitOnReply, exitOnClick, exitOnConversion,
      fromName, fromEmail, replyTo, tags
    } = req.body;
    
    const sequence = await EmailSequence.create({
      organization: req.user.organization,
      name, description, steps, status,
      enrollmentTrigger, triggerConditions, segment,
      exitOnReply, exitOnClick, exitOnConversion,
      fromName, fromEmail, replyTo, tags,
      createdBy: req.user._id
    });
    
    res.status(201).json({ success: true, data: sequence });
  } catch (error) {
    next(error);
  }
};

exports.getSequences = async (req, res, next) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    
    const query = { organization: req.user.organization };
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    const skip = (page - 1) * limit;
    const [sequences, total] = await Promise.all([
      EmailSequence.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('createdBy', 'name email')
        .populate('segment', 'name'),
      EmailSequence.countDocuments(query)
    ]);
    
    res.json({
      success: true,
      data: sequences,
      pagination: { page: parseInt(page), limit: parseInt(limit), total }
    });
  } catch (error) {
    next(error);
  }
};

exports.getSequence = async (req, res, next) => {
  try {
    const sequence = await EmailSequence.findOne({
      _id: req.params.id,
      organization: req.user.organization
    })
      .populate('createdBy', 'name email')
      .populate('segment', 'name description');
    
    if (!sequence) {
      return res.status(404).json({ success: false, message: 'Sequence not found' });
    }
    
    res.json({ success: true, data: sequence });
  } catch (error) {
    next(error);
  }
};

exports.updateSequence = async (req, res, next) => {
  try {
    const {
      name, description, steps, status,
      enrollmentTrigger, triggerConditions, segment,
      exitOnReply, exitOnClick, exitOnConversion,
      fromName, fromEmail, replyTo, tags
    } = req.body;
    
    const sequence = await EmailSequence.findOneAndUpdate(
      { _id: req.params.id, organization: req.user.organization },
      {
        name, description, steps, status,
        enrollmentTrigger, triggerConditions, segment,
        exitOnReply, exitOnClick, exitOnConversion,
        fromName, fromEmail, replyTo, tags
      },
      { new: true, runValidators: true }
    );
    
    if (!sequence) {
      return res.status(404).json({ success: false, message: 'Sequence not found' });
    }
    
    res.json({ success: true, data: sequence });
  } catch (error) {
    next(error);
  }
};

exports.deleteSequence = async (req, res, next) => {
  try {
    const sequence = await EmailSequence.findOneAndDelete({
      _id: req.params.id,
      organization: req.user.organization
    });
    
    if (!sequence) {
      return res.status(404).json({ success: false, message: 'Sequence not found' });
    }
    
    res.json({ success: true, message: 'Sequence deleted' });
  } catch (error) {
    next(error);
  }
};

exports.enrollInSequence = async (req, res, next) => {
  try {
    const { recipientType, recipientId, recipientEmail, recipientName } = req.body;
    
    const sequence = await EmailSequence.findOne({
      _id: req.params.id,
      organization: req.user.organization,
      status: 'active'
    });
    
    if (!sequence) {
      return res.status(404).json({ success: false, message: 'Sequence not found or not active' });
    }
    
    // Check if already enrolled
    const existing = await EmailSequenceEnrollment.findOne({
      sequence: sequence._id,
      recipientEmail,
      status: { $in: ['active', 'paused'] }
    });
    
    if (existing) {
      return res.status(400).json({ 
        success: false, 
        message: 'Recipient already enrolled in this sequence' 
      });
    }
    
    // Check unsubscribe status
    const unsubscribed = await EmailUnsubscribe.findOne({
      organization: req.user.organization,
      email: recipientEmail,
      isActive: true
    });
    
    if (unsubscribed) {
      return res.status(400).json({ 
        success: false, 
        message: 'Recipient has unsubscribed from emails' 
      });
    }
    
    // Calculate next step time
    const firstStep = sequence.steps.sort((a, b) => a.order - b.order)[0];
    const nextStepAt = new Date();
    if (firstStep) {
      nextStepAt.setDate(nextStepAt.getDate() + (firstStep.delayDays || 0));
      nextStepAt.setHours(nextStepAt.getHours() + (firstStep.delayHours || 0));
    }
    
    const enrollment = await EmailSequenceEnrollment.create({
      organization: req.user.organization,
      sequence: sequence._id,
      recipientType,
      recipientId,
      recipientEmail,
      recipientName,
      status: 'active',
      currentStep: 0,
      nextStepAt,
      enrolledBy: req.user._id
    });
    
    // Update sequence stats
    sequence.stats.enrolled += 1;
    sequence.stats.active += 1;
    await sequence.save();
    
    res.status(201).json({ success: true, data: enrollment });
  } catch (error) {
    next(error);
  }
};

exports.getSequenceEnrollments = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    
    const query = { 
      sequence: req.params.id,
      organization: req.user.organization 
    };
    if (status) query.status = status;
    
    const skip = (page - 1) * limit;
    const [enrollments, total] = await Promise.all([
      EmailSequenceEnrollment.find(query)
        .sort({ enrolledAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      EmailSequenceEnrollment.countDocuments(query)
    ]);
    
    res.json({
      success: true,
      data: enrollments,
      pagination: { page: parseInt(page), limit: parseInt(limit), total }
    });
  } catch (error) {
    next(error);
  }
};

// ============================================
// UNSUBSCRIBE MANAGEMENT
// ============================================

exports.unsubscribe = async (req, res, next) => {
  try {
    const { email, reason, reasonCategory, feedback, campaign, sequence } = req.body;
    
    const unsubscribe = await EmailUnsubscribe.findOneAndUpdate(
      { 
        organization: req.user.organization, 
        email: email.toLowerCase().trim() 
      },
      {
        reason,
        reasonCategory,
        feedback,
        campaign,
        sequence,
        method: 'link',
        isActive: true,
        unsubscribedAt: new Date()
      },
      { upsert: true, new: true }
    );
    
    // Exit any active sequence enrollments
    await EmailSequenceEnrollment.updateMany(
      {
        organization: req.user.organization,
        recipientEmail: email.toLowerCase().trim(),
        status: 'active'
      },
      {
        status: 'exited',
        exitReason: 'unsubscribed',
        exitedAt: new Date()
      }
    );
    
    res.json({ success: true, message: 'Successfully unsubscribed', data: unsubscribe });
  } catch (error) {
    next(error);
  }
};

exports.getUnsubscribes = async (req, res, next) => {
  try {
    const { search, page = 1, limit = 50 } = req.query;
    
    const query = { organization: req.user.organization, isActive: true };
    if (search) {
      query.email = { $regex: search, $options: 'i' };
    }
    
    const skip = (page - 1) * limit;
    const [unsubscribes, total] = await Promise.all([
      EmailUnsubscribe.find(query)
        .sort({ unsubscribedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('campaign', 'name')
        .populate('sequence', 'name'),
      EmailUnsubscribe.countDocuments(query)
    ]);
    
    res.json({
      success: true,
      data: unsubscribes,
      pagination: { page: parseInt(page), limit: parseInt(limit), total }
    });
  } catch (error) {
    next(error);
  }
};

exports.resubscribe = async (req, res, next) => {
  try {
    const { email } = req.body;
    
    const unsubscribe = await EmailUnsubscribe.findOneAndUpdate(
      { 
        organization: req.user.organization, 
        email: email.toLowerCase().trim() 
      },
      {
        isActive: false,
        resubscribedAt: new Date()
      },
      { new: true }
    );
    
    if (!unsubscribe) {
      return res.status(404).json({ success: false, message: 'Email not found in unsubscribe list' });
    }
    
    res.json({ success: true, message: 'Successfully resubscribed', data: unsubscribe });
  } catch (error) {
    next(error);
  }
};

// ============================================
// EMAIL ANALYTICS
// ============================================

exports.getEmailAnalytics = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    
    const query = { organization: req.user.organization };
    if (startDate || endDate) {
      query.sentAt = {};
      if (startDate) query.sentAt.$gte = new Date(startDate);
      if (endDate) query.sentAt.$lte = new Date(endDate);
    }
    
    const [
      totalSent,
      totalOpened,
      totalClicked,
      totalBounced,
      campaigns,
      sequences,
      unsubscribes
    ] = await Promise.all([
      EmailLog.countDocuments({ ...query, status: { $in: ['sent', 'delivered'] } }),
      EmailLog.countDocuments({ ...query, opened: true }),
      EmailLog.countDocuments({ ...query, clicked: true }),
      EmailLog.countDocuments({ ...query, status: 'bounced' }),
      EmailCampaign.countDocuments({ organization: req.user.organization, status: 'sent' }),
      EmailSequence.countDocuments({ organization: req.user.organization, status: 'active' }),
      EmailUnsubscribe.countDocuments({ organization: req.user.organization, isActive: true })
    ]);
    
    const analytics = {
      totalSent,
      totalOpened,
      totalClicked,
      totalBounced,
      openRate: totalSent > 0 ? ((totalOpened / totalSent) * 100).toFixed(2) : 0,
      clickRate: totalSent > 0 ? ((totalClicked / totalSent) * 100).toFixed(2) : 0,
      bounceRate: totalSent > 0 ? ((totalBounced / totalSent) * 100).toFixed(2) : 0,
      activeCampaigns: campaigns,
      activeSequences: sequences,
      totalUnsubscribes: unsubscribes
    };
    
    res.json({ success: true, data: analytics });
  } catch (error) {
    next(error);
  }
};

// ============================================
// ADDITIONAL CONTROLLER METHODS
// ============================================

// Duplicate template
exports.duplicateTemplate = async (req, res, next) => {
  try {
    const template = await EmailTemplate.findOne({
      _id: req.params.id,
      organization: req.user.organization
    });
    
    if (!template) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }
    
    const newTemplate = await EmailTemplate.create({
      organization: req.user.organization,
      name: `${template.name} (Copy)`,
      subject: template.subject,
      body: template.body,
      bodyHtml: template.bodyHtml,
      category: template.category,
      variables: template.variables,
      tags: template.tags,
      createdBy: req.user._id
    });
    
    res.status(201).json({ success: true, data: newTemplate });
  } catch (error) {
    next(error);
  }
};

// Schedule campaign
exports.scheduleCampaign = async (req, res, next) => {
  try {
    const { scheduledAt } = req.body;
    
    const campaign = await EmailCampaign.findOneAndUpdate(
      { _id: req.params.id, organization: req.user.organization },
      { status: 'scheduled', scheduledAt: new Date(scheduledAt) },
      { new: true }
    );
    
    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }
    
    res.json({ success: true, data: campaign });
  } catch (error) {
    next(error);
  }
};

// Pause campaign
exports.pauseCampaign = async (req, res, next) => {
  try {
    const campaign = await EmailCampaign.findOneAndUpdate(
      { _id: req.params.id, organization: req.user.organization },
      { status: 'paused' },
      { new: true }
    );
    
    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }
    
    res.json({ success: true, data: campaign });
  } catch (error) {
    next(error);
  }
};

// Resume campaign
exports.resumeCampaign = async (req, res, next) => {
  try {
    const campaign = await EmailCampaign.findOne({
      _id: req.params.id,
      organization: req.user.organization
    });
    
    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }
    
    campaign.status = campaign.scheduledAt && new Date(campaign.scheduledAt) > new Date() ? 'scheduled' : 'draft';
    await campaign.save();
    
    res.json({ success: true, data: campaign });
  } catch (error) {
    next(error);
  }
};

// Cancel campaign
exports.cancelCampaign = async (req, res, next) => {
  try {
    const campaign = await EmailCampaign.findOneAndUpdate(
      { _id: req.params.id, organization: req.user.organization },
      { status: 'cancelled' },
      { new: true }
    );
    
    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }
    
    res.json({ success: true, data: campaign });
  } catch (error) {
    next(error);
  }
};

// Get campaign recipients
exports.getCampaignRecipients = async (req, res, next) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    
    const campaign = await EmailCampaign.findOne({
      _id: req.params.id,
      organization: req.user.organization
    });
    
    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }
    
    const skip = (page - 1) * limit;
    const logs = await EmailLog.find({ campaign: campaign._id })
      .sort({ sentAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await EmailLog.countDocuments({ campaign: campaign._id });
    
    res.json({
      success: true,
      data: logs,
      pagination: { page: parseInt(page), limit: parseInt(limit), total }
    });
  } catch (error) {
    next(error);
  }
};

// Activate sequence
exports.activateSequence = async (req, res, next) => {
  try {
    const sequence = await EmailSequence.findOneAndUpdate(
      { _id: req.params.id, organization: req.user.organization },
      { status: 'active' },
      { new: true }
    );
    
    if (!sequence) {
      return res.status(404).json({ success: false, message: 'Sequence not found' });
    }
    
    res.json({ success: true, data: sequence });
  } catch (error) {
    next(error);
  }
};

// Pause sequence
exports.pauseSequence = async (req, res, next) => {
  try {
    const sequence = await EmailSequence.findOneAndUpdate(
      { _id: req.params.id, organization: req.user.organization },
      { status: 'paused' },
      { new: true }
    );
    
    if (!sequence) {
      return res.status(404).json({ success: false, message: 'Sequence not found' });
    }
    
    res.json({ success: true, data: sequence });
  } catch (error) {
    next(error);
  }
};

// Archive sequence
exports.archiveSequence = async (req, res, next) => {
  try {
    const sequence = await EmailSequence.findOneAndUpdate(
      { _id: req.params.id, organization: req.user.organization },
      { status: 'archived' },
      { new: true }
    );
    
    if (!sequence) {
      return res.status(404).json({ success: false, message: 'Sequence not found' });
    }
    
    res.json({ success: true, data: sequence });
  } catch (error) {
    next(error);
  }
};

// Get sequence stats
exports.getSequenceStats = async (req, res, next) => {
  try {
    const sequence = await EmailSequence.findOne({
      _id: req.params.id,
      organization: req.user.organization
    });
    
    if (!sequence) {
      return res.status(404).json({ success: false, message: 'Sequence not found' });
    }
    
    const enrollments = await EmailSequenceEnrollment.find({ sequence: sequence._id });
    
    const stats = {
      totalEnrolled: enrollments.length,
      active: enrollments.filter(e => e.status === 'active').length,
      completed: enrollments.filter(e => e.status === 'completed').length,
      exited: enrollments.filter(e => e.status === 'exited').length,
      totalEmailsSent: enrollments.reduce((sum, e) => sum + (e.totalEmailsSent || 0), 0),
      totalOpens: enrollments.reduce((sum, e) => sum + (e.totalOpens || 0), 0),
      totalClicks: enrollments.reduce((sum, e) => sum + (e.totalClicks || 0), 0),
      replied: enrollments.filter(e => e.replied).length,
      converted: enrollments.filter(e => e.converted).length
    };
    
    res.json({ success: true, data: stats });
  } catch (error) {
    next(error);
  }
};

// Pause enrollment
exports.pauseEnrollment = async (req, res, next) => {
  try {
    const enrollment = await EmailSequenceEnrollment.findOneAndUpdate(
      { _id: req.params.id, organization: req.user.organization },
      { status: 'paused' },
      { new: true }
    );
    
    if (!enrollment) {
      return res.status(404).json({ success: false, message: 'Enrollment not found' });
    }
    
    res.json({ success: true, data: enrollment });
  } catch (error) {
    next(error);
  }
};

// Resume enrollment
exports.resumeEnrollment = async (req, res, next) => {
  try {
    const enrollment = await EmailSequenceEnrollment.findOneAndUpdate(
      { _id: req.params.id, organization: req.user.organization },
      { status: 'active' },
      { new: true }
    );
    
    if (!enrollment) {
      return res.status(404).json({ success: false, message: 'Enrollment not found' });
    }
    
    res.json({ success: true, data: enrollment });
  } catch (error) {
    next(error);
  }
};

// Exit enrollment
exports.exitEnrollment = async (req, res, next) => {
  try {
    const { reason } = req.body;
    
    const enrollment = await EmailSequenceEnrollment.findOneAndUpdate(
      { _id: req.params.id, organization: req.user.organization },
      { 
        status: 'exited', 
        exitedAt: new Date(),
        exitReason: reason || 'manual'
      },
      { new: true }
    );
    
    if (!enrollment) {
      return res.status(404).json({ success: false, message: 'Enrollment not found' });
    }
    
    res.json({ success: true, data: enrollment });
  } catch (error) {
    next(error);
  }
};

// Get email logs
exports.getEmailLogs = async (req, res, next) => {
  try {
    const { status, campaign, sequence, page = 1, limit = 50 } = req.query;
    
    const query = { organization: req.user.organization };
    if (status) query.status = status;
    if (campaign) query.campaign = campaign;
    if (sequence) query.sequence = sequence;
    
    const skip = (page - 1) * limit;
    const [logs, total] = await Promise.all([
      EmailLog.find(query)
        .sort({ sentAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('campaign', 'name')
        .populate('sequence', 'name'),
      EmailLog.countDocuments(query)
    ]);
    
    res.json({
      success: true,
      data: logs,
      pagination: { page: parseInt(page), limit: parseInt(limit), total }
    });
  } catch (error) {
    next(error);
  }
};

// Get single email log
exports.getEmailLog = async (req, res, next) => {
  try {
    const log = await EmailLog.findOne({
      _id: req.params.id,
      organization: req.user.organization
    })
      .populate('campaign', 'name')
      .populate('sequence', 'name')
      .populate('sentBy', 'name email');
    
    if (!log) {
      return res.status(404).json({ success: false, message: 'Email log not found' });
    }
    
    res.json({ success: true, data: log });
  } catch (error) {
    next(error);
  }
};

// Resend email
exports.resendEmail = async (req, res, next) => {
  try {
    const log = await EmailLog.findOne({
      _id: req.params.id,
      organization: req.user.organization
    });
    
    if (!log) {
      return res.status(404).json({ success: false, message: 'Email log not found' });
    }
    
    // Create new log entry for resend
    const newLog = await EmailLog.create({
      organization: log.organization,
      campaign: log.campaign,
      sequence: log.sequence,
      to: log.to,
      from: log.from,
      subject: log.subject,
      body: log.body,
      bodyHtml: log.bodyHtml,
      recipientType: log.recipientType,
      recipientId: log.recipientId,
      recipientName: log.recipientName,
      status: 'queued',
      trackingId: crypto.randomBytes(16).toString('hex'),
      sentBy: req.user._id
    });
    
    // In production, trigger actual email sending
    setTimeout(async () => {
      await EmailLog.findByIdAndUpdate(newLog._id, {
        status: 'sent',
        sentAt: new Date()
      });
    }, 1000);
    
    res.json({ success: true, message: 'Email queued for resending', data: newLog });
  } catch (error) {
    next(error);
  }
};

// Add to unsubscribe list
exports.addUnsubscribe = async (req, res, next) => {
  try {
    const { email, reason, reasonCategory } = req.body;
    
    const unsubscribe = await EmailUnsubscribe.findOneAndUpdate(
      { organization: req.user.organization, email: email.toLowerCase().trim() },
      {
        reason,
        reasonCategory,
        method: 'manual',
        isActive: true,
        unsubscribedAt: new Date()
      },
      { upsert: true, new: true }
    );
    
    res.json({ success: true, data: unsubscribe });
  } catch (error) {
    next(error);
  }
};

// Remove from unsubscribe list (resubscribe)
exports.removeUnsubscribe = async (req, res, next) => {
  try {
    const unsubscribe = await EmailUnsubscribe.findOneAndUpdate(
      { _id: req.params.id, organization: req.user.organization },
      { isActive: false, resubscribedAt: new Date() },
      { new: true }
    );
    
    if (!unsubscribe) {
      return res.status(404).json({ success: false, message: 'Unsubscribe record not found' });
    }
    
    res.json({ success: true, message: 'Email resubscribed', data: unsubscribe });
  } catch (error) {
    next(error);
  }
};

// Get email analytics overview
exports.getEmailAnalyticsOverview = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    
    const query = { organization: req.user.organization };
    if (startDate || endDate) {
      query.sentAt = {};
      if (startDate) query.sentAt.$gte = new Date(startDate);
      if (endDate) query.sentAt.$lte = new Date(endDate);
    }
    
    const [overview, topCampaigns, topTemplates] = await Promise.all([
      EmailLog.aggregate([
        { $match: query },
        {
          $group: {
            _id: null,
            totalSent: { $sum: 1 },
            totalOpened: { $sum: { $cond: ['$opened', 1, 0] } },
            totalClicked: { $sum: { $cond: ['$clicked', 1, 0] } },
            totalBounced: { $sum: { $cond: [{ $eq: ['$status', 'bounced'] }, 1, 0] } }
          }
        }
      ]),
      EmailLog.aggregate([
        { $match: { ...query, campaign: { $exists: true } } },
        {
          $group: {
            _id: '$campaign',
            sent: { $sum: 1 },
            opened: { $sum: { $cond: ['$opened', 1, 0] } },
            clicked: { $sum: { $cond: ['$clicked', 1, 0] } }
          }
        },
        { $sort: { sent: -1 } },
        { $limit: 5 },
        {
          $lookup: {
            from: 'emailcampaigns',
            localField: '_id',
            foreignField: '_id',
            as: 'campaign'
          }
        },
        { $unwind: '$campaign' }
      ]),
      EmailLog.aggregate([
        { $match: { ...query, template: { $exists: true } } },
        {
          $group: {
            _id: '$template',
            sent: { $sum: 1 },
            opened: { $sum: { $cond: ['$opened', 1, 0] } }
          }
        },
        { $sort: { sent: -1 } },
        { $limit: 5 },
        {
          $lookup: {
            from: 'emailtemplates',
            localField: '_id',
            foreignField: '_id',
            as: 'template'
          }
        },
        { $unwind: '$template' }
      ])
    ]);
    
    const stats = overview[0] || { totalSent: 0, totalOpened: 0, totalClicked: 0, totalBounced: 0 };
    stats.openRate = stats.totalSent > 0 ? ((stats.totalOpened / stats.totalSent) * 100).toFixed(2) : 0;
    stats.clickRate = stats.totalSent > 0 ? ((stats.totalClicked / stats.totalSent) * 100).toFixed(2) : 0;
    stats.bounceRate = stats.totalSent > 0 ? ((stats.totalBounced / stats.totalSent) * 100).toFixed(2) : 0;
    
    res.json({
      success: true,
      data: {
        overview: stats,
        topCampaigns,
        topTemplates
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get email performance trends
exports.getEmailPerformance = async (req, res, next) => {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    
    const performance = await EmailLog.aggregate([
      {
        $match: {
          organization: req.user.organization,
          sentAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$sentAt' }
          },
          sent: { $sum: 1 },
          opened: { $sum: { $cond: ['$opened', 1, 0] } },
          clicked: { $sum: { $cond: ['$clicked', 1, 0] } },
          bounced: { $sum: { $cond: [{ $eq: ['$status', 'bounced'] }, 1, 0] } }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    
    res.json({ success: true, data: performance });
  } catch (error) {
    next(error);
  }
};

// Track email open (public route)
exports.trackEmailOpen = async (req, res, next) => {
  try {
    const { trackingId } = req.params;
    
    const log = await EmailLog.findOne({ trackingId });
    
    if (log) {
      log.opened = true;
      if (!log.openedAt) log.openedAt = new Date();
      log.openCount = (log.openCount || 0) + 1;
      log.lastOpenedAt = new Date();
      await log.save();
    }
    
    // Return 1x1 transparent pixel
    res.writeHead(200, {
      'Content-Type': 'image/gif',
      'Content-Length': 43
    });
    res.end(Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64'));
  } catch (error) {
    next(error);
  }
};

// Track email click (public route)
exports.trackEmailClick = async (req, res, next) => {
  try {
    const { trackingId } = req.params;
    const { url } = req.query;
    
    const log = await EmailLog.findOne({ trackingId });
    
    if (log) {
      log.clicked = true;
      if (!log.clickedAt) log.clickedAt = new Date();
      log.clickCount = (log.clickCount || 0) + 1;
      log.lastClickedAt = new Date();
      
      const existingLink = log.clickedLinks.find(l => l.url === url);
      if (existingLink) {
        existingLink.count += 1;
        existingLink.clickedAt = new Date();
      } else {
        log.clickedLinks.push({ url, clickedAt: new Date(), count: 1 });
      }
      
      await log.save();
    }
    
    // Redirect to actual URL
    res.redirect(url || 'https://www.zeeventory.com');
  } catch (error) {
    next(error);
  }
};

// Show unsubscribe page (public route)
exports.showUnsubscribePage = async (req, res, next) => {
  try {
    const { trackingId } = req.params;
    
    const log = await EmailLog.findOne({ trackingId });
    
    if (!log) {
      return res.status(404).send('Unsubscribe link not found');
    }
    
    // Return simple HTML page
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Unsubscribe</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
          h1 { color: #333; }
          form { margin-top: 20px; }
          select, textarea, button { width: 100%; padding: 10px; margin: 10px 0; }
          button { background: #4F46E5; color: white; border: none; cursor: pointer; }
          button:hover { background: #4338CA; }
        </style>
      </head>
      <body>
        <h1>Unsubscribe from Emails</h1>
        <p>We're sorry to see you go. Please let us know why you're unsubscribing:</p>
        <form method="POST">
          <select name="reasonCategory">
            <option value="too_frequent">Emails are too frequent</option>
            <option value="not_relevant">Content not relevant</option>
            <option value="never_subscribed">I never subscribed</option>
            <option value="spam">This is spam</option>
            <option value="other">Other</option>
          </select>
          <textarea name="feedback" placeholder="Additional feedback (optional)" rows="4"></textarea>
          <button type="submit">Unsubscribe</button>
        </form>
      </body>
      </html>
    `);
  } catch (error) {
    next(error);
  }
};

// Process unsubscribe (public route)
exports.processUnsubscribe = async (req, res, next) => {
  try {
    const { trackingId } = req.params;
    const { reasonCategory, feedback } = req.body;
    
    const log = await EmailLog.findOne({ trackingId });
    
    if (!log) {
      return res.status(404).send('Unsubscribe link not found');
    }
    
    await EmailUnsubscribe.findOneAndUpdate(
      { organization: log.organization, email: log.to.toLowerCase().trim() },
      {
        reasonCategory,
        feedback,
        emailLog: log._id,
        campaign: log.campaign,
        sequence: log.sequence,
        method: 'link',
        isActive: true,
        unsubscribedAt: new Date()
      },
      { upsert: true }
    );
    
    // Exit any active sequence enrollments
    await EmailSequenceEnrollment.updateMany(
      {
        organization: log.organization,
        recipientEmail: log.to.toLowerCase().trim(),
        status: 'active'
      },
      {
        status: 'exited',
        exitReason: 'unsubscribed',
        exitedAt: new Date()
      }
    );
    
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Unsubscribed</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; text-align: center; }
          h1 { color: #10B981; }
        </style>
      </head>
      <body>
        <h1>✓ You've been unsubscribed</h1>
        <p>You will no longer receive emails from us.</p>
        <p>If this was a mistake, please contact us.</p>
      </body>
      </html>
    `);
  } catch (error) {
    next(error);
  }
};