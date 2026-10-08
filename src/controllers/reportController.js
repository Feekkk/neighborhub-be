const reportService = require('../services/reportServices');
const pdfService = require('../services/pdfServices');

function singleReportDisposition(id) {
  const safeId = String(id).replace(/[^a-zA-Z0-9-]/g, '') || 'report';
  return `attachment; filename="emergency-report-${safeId}.pdf"`;
}

exports.getAllEvents = async (req, res) => {
  try {
    const reports = await reportService.getAllReports();
    res.json(reports);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getReportById = async (req, res) => {
  try {
    const report = await reportService.getReportById(req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createReport = async (req, res) => {
  try {
    const report = await reportService.createReport(req.body);
    res.status(201).json(report);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.updateReport = async (req, res) => {
  try {
    const report = await reportService.updateReport(req.params.id, req.body);
    res.json(report);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.deleteReport = async (req, res) => {
  try {
    await reportService.deleteReport(req.params.id);
    res.status(204).send();
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Generate PDF for all emergency reports
exports.generateAllReportsPDF = async (req, res) => {
  try {
    const pdfBuffer = await pdfService.generateEmergencyReportsPDF();
    
    // Set response headers for PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="emergency-reports.pdf"');
    res.setHeader('Content-Length', pdfBuffer.length);
    
    // Send PDF buffer
    res.send(pdfBuffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Generate PDF for a specific emergency report
exports.generateSingleReportPDF = async (req, res) => {
  try {
    const pdfBuffer = await pdfService.generateSingleReportPDF(req.params.id);
    
    // Set response headers for PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', singleReportDisposition(req.params.id));
    res.setHeader('Content-Length', pdfBuffer.length);
    
    // Send PDF buffer
    res.send(pdfBuffer);
  } catch (err) {
    if (err.message === 'Report not found') {
      res.status(404).json({ error: 'Report not found' });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
};

exports.getAllReports = async (req, res) => {
  try {
    const reports = await reportService.getAllReports();
    res.json(reports);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Admin function to get all reports regardless of status
exports.getAllReportsAdmin = async (req, res) => {
  try {
    const reports = await reportService.getAllReportsAdmin();
    res.json(reports);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update report status (for admin to mark as resolved/closed)
exports.updateReportStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['OPEN', 'RESOLVED', 'CLOSED'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be OPEN, RESOLVED, or CLOSED' });
    }
    
    const report = await reportService.updateReport(req.params.id, { status });
    res.json(report);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Get reports by status
exports.getReportsByStatus = async (req, res) => {
  try {
    const { status } = req.params;
    const reports = await reportService.getReportsByStatus(status);
    res.json(reports);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Heatmap Controllers

// Get heatmap data for Google Maps
exports.getHeatmapData = async (req, res) => {
  try {
    const { neLat, neLng, swLat, swLng, gridSize } = req.query;
    
    // Validate required parameters
    if (!neLat || !neLng || !swLat || !swLng) {
      return res.status(400).json({ 
        error: 'Missing required parameters: neLat, neLng, swLat, swLng' 
      });
    }

    const bounds = {
      northEast: { lat: parseFloat(neLat), lng: parseFloat(neLng) },
      southWest: { lat: parseFloat(swLat), lng: parseFloat(swLng) }
    };

    const grid = gridSize ? parseFloat(gridSize) : 0.01;
    const heatmapData = await reportService.getHeatmapData(bounds, grid);
    
    res.json({
      success: true,
      data: heatmapData,
      bounds: bounds,
      gridSize: grid,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get reports within bounds for markers
exports.getReportsInBounds = async (req, res) => {
  try {
    const { neLat, neLng, swLat, swLng } = req.query;
    
    if (!neLat || !neLng || !swLat || !swLng) {
      return res.status(400).json({ 
        error: 'Missing required parameters: neLat, neLng, swLat, swLng' 
      });
    }

    const bounds = {
      northEast: { lat: parseFloat(neLat), lng: parseFloat(neLng) },
      southWest: { lat: parseFloat(swLat), lng: parseFloat(swLng) }
    };

    const reports = await reportService.getReportsInBounds(bounds);
    
    res.json({
      success: true,
      data: reports,
      count: reports.length,
      bounds: bounds
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get heatmap statistics
exports.getHeatmapStats = async (req, res) => {
  try {
    const { neLat, neLng, swLat, swLng } = req.query;
    
    if (!neLat || !neLng || !swLat || !swLng) {
      return res.status(400).json({ 
        error: 'Missing required parameters: neLat, neLng, swLat, swLng' 
      });
    }

    const bounds = {
      northEast: { lat: parseFloat(neLat), lng: parseFloat(neLng) },
      southWest: { lat: parseFloat(swLat), lng: parseFloat(swLng) }
    };

    const stats = await reportService.getHeatmapStats(bounds);
    
    res.json({
      success: true,
      stats: stats,
      bounds: bounds
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get time-filtered heatmap data
exports.getTimeBasedHeatmapData = async (req, res) => {
  try {
    const { neLat, neLng, swLat, swLng, timeFilter } = req.query;
    
    if (!neLat || !neLng || !swLat || !swLng) {
      return res.status(400).json({ 
        error: 'Missing required parameters: neLat, neLng, swLat, swLng' 
      });
    }

    const bounds = {
      northEast: { lat: parseFloat(neLat), lng: parseFloat(neLng) },
      southWest: { lat: parseFloat(swLat), lng: parseFloat(swLng) }
    };

    const timeFilterValue = timeFilter || 'all';
    const reports = await reportService.getTimeBasedHeatmapData(bounds, timeFilterValue);
    
    res.json({
      success: true,
      data: reports,
      count: reports.length,
      bounds: bounds,
      timeFilter: timeFilterValue
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};