const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const authMiddleware = require('../middlewares/authMiddleware');
const requireAdmin = authMiddleware.requireAdmin;

router.get('/pdf/all', requireAdmin, reportController.generateAllReportsPDF);
router.get('/pdf/:id', requireAdmin, reportController.generateSingleReportPDF);

router.get('/heatmap/data', authMiddleware, reportController.getHeatmapData);
router.get('/heatmap/bounds', authMiddleware, reportController.getReportsInBounds);
router.get('/heatmap/stats', authMiddleware, reportController.getHeatmapStats);
router.get('/heatmap/time-based', authMiddleware, reportController.getTimeBasedHeatmapData);

router.get('/', authMiddleware, reportController.getAllReports);
router.get('/:id', authMiddleware, reportController.getReportById);
router.post('/', reportController.createReport);
router.put('/:id', requireAdmin, reportController.updateReport);
router.delete('/:id', requireAdmin, reportController.deleteReport);

module.exports = router;
