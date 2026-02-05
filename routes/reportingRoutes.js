const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { requireOrganization } = require('../middleware/organization');
const { PERMISSIONS } = require('../utils/permissions');
const asyncHandler = require('../middleware/async');
const ReportingService = require('../services/reportingService');

router.use(protect, requireOrganization);

/**
 * @desc    Generate workload report
 * @route   GET /api/reports/workload
 * @access  Private
 */
router.get(
  '/workload',
  authorize(PERMISSIONS.PROJECTS_VIEW),
  asyncHandler(async (req, res) => {
    const userOrgId = req.user.organization._id || req.user.organization;
    
    const report = await ReportingService.generateWorkloadReport(
      userOrgId,
      req.query
    );

    res.status(200).json({
      success: true,
      data: report,
    });
  })
);

/**
 * @desc    Generate task completion report
 * @route   GET /api/reports/task-completion
 * @access  Private
 */
router.get(
  '/task-completion',
  authorize(PERMISSIONS.PROJECTS_VIEW),
  asyncHandler(async (req, res) => {
    const userOrgId = req.user.organization._id || req.user.organization;
    
    const report = await ReportingService.generateTaskCompletionReport(
      userOrgId,
      req.query
    );

    res.status(200).json({
      success: true,
      data: report,
    });
  })
);

/**
 * @desc    Generate time tracking summary
 * @route   GET /api/reports/time-tracking
 * @access  Private
 */
router.get(
  '/time-tracking',
  authorize(PERMISSIONS.TIME_VIEW),
  asyncHandler(async (req, res) => {
    const userOrgId = req.user.organization._id || req.user.organization;
    
    const report = await ReportingService.generateTimeTrackingSummary(
      userOrgId,
      req.query
    );

    res.status(200).json({
      success: true,
      data: report,
    });
  })
);

/**
 * @desc    Generate budget report
 * @route   GET /api/reports/budget
 * @access  Private
 */
router.get(
  '/budget',
  authorize(PERMISSIONS.PROJECTS_VIEW),
  asyncHandler(async (req, res) => {
    const userOrgId = req.user.organization._id || req.user.organization;
    const { projectId } = req.query;

    if (!projectId) {
      return res.status(400).json({
        success: false,
        message: 'Project ID is required',
      });
    }
    
    const report = await ReportingService.generateBudgetReport(
      userOrgId,
      projectId
    );

    res.status(200).json({
      success: true,
      data: report,
    });
  })
);

/**
 * @desc    Generate sprint velocity report
 * @route   GET /api/reports/sprint-velocity
 * @access  Private
 */
router.get(
  '/sprint-velocity',
  authorize(PERMISSIONS.PROJECTS_VIEW),
  asyncHandler(async (req, res) => {
    const userOrgId = req.user.organization._id || req.user.organization;
    const { projectId, lastNSprints } = req.query;

    if (!projectId) {
      return res.status(400).json({
        success: false,
        message: 'Project ID is required',
      });
    }
    
    const report = await ReportingService.generateSprintVelocityReport(
      userOrgId,
      projectId,
      lastNSprints ? parseInt(lastNSprints) : 6
    );

    res.status(200).json({
      success: true,
      data: report,
    });
  })
);

/**
 * @desc    Generate utilization report
 * @route   GET /api/reports/utilization
 * @access  Private
 */
router.get(
  '/utilization',
  authorize(PERMISSIONS.TIME_VIEW),
  asyncHandler(async (req, res) => {
    const userOrgId = req.user.organization._id || req.user.organization;
    
    const report = await ReportingService.generateUtilizationReport(
      userOrgId,
      req.query
    );

    res.status(200).json({
      success: true,
      data: report,
    });
  })
);

/**
 * @desc    Export report to CSV
 * @route   GET /api/reports/export/:type
 * @access  Private
 */
router.get(
  '/export/:type',
  authorize(PERMISSIONS.PROJECTS_VIEW),
  asyncHandler(async (req, res) => {
    const userOrgId = req.user.organization._id || req.user.organization;
    const { type } = req.params;

    let report;
    let reportType;

    switch (type) {
      case 'workload':
        report = await ReportingService.generateWorkloadReport(userOrgId, req.query);
        reportType = 'workload';
        break;
      case 'time-tracking':
        report = await ReportingService.generateTimeTrackingSummary(userOrgId, req.query);
        reportType = 'time-tracking';
        break;
      case 'sprint-velocity':
        const { projectId } = req.query;
        if (!projectId) {
          return res.status(400).json({
            success: false,
            message: 'Project ID is required',
          });
        }
        report = await ReportingService.generateSprintVelocityReport(userOrgId, projectId);
        reportType = 'sprint-velocity';
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid report type',
        });
    }

    const csv = ReportingService.exportToCSV(report, reportType);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${type}-report.csv"`);
    res.status(200).send(csv);
  })
);

module.exports = router;

