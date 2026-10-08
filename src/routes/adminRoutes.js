const express = require('express');
const router = express.Router();
const schedulerService = require('../services/schedulerService');
const CleanupService = require('../services/cleanupService');
const reportController = require('../controllers/reportController');
const requireAdmin = require('../middlewares/authMiddleware').requireAdmin;

// Get scheduler status (admin only)
router.get('/scheduler/status', requireAdmin, (req, res) => {
  try {
    const status = schedulerService.getStatus();
    res.json({
      message: 'Scheduler status retrieved successfully',
      status: status,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get expiring announcements count (admin only)
router.get('/announcements/expiring-summary', requireAdmin, async (req, res) => {
  try {
    const expiringAnnouncements = await CleanupService.getExpiringAnnouncements();
    res.json({
      message: 'Expiring announcements summary',
      count: expiringAnnouncements.length,
      announcements: expiringAnnouncements.map(ann => ({
        id: ann.id,
        title: ann.title,
        createdAt: ann.createdAt,
        daysRemaining: Math.ceil((new Date(ann.createdAt).getTime() + (30 * 24 * 60 * 60 * 1000) - Date.now()) / (1000 * 60 * 60 * 24))
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Force cleanup (admin only)
router.post('/cleanup/force', requireAdmin, async (req, res) => {
  try {
    const result = await CleanupService.performManualCleanup();
    res.json({
      message: 'Manual cleanup executed',
      result: result
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin report management routes
router.get('/reports/all', requireAdmin, reportController.getAllReportsAdmin);
router.get('/reports/status/:status', requireAdmin, reportController.getReportsByStatus);
router.put('/reports/:id/status', requireAdmin, reportController.updateReportStatus);

module.exports = router;
