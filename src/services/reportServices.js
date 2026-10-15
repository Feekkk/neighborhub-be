// services
const prisma = require('../config/prisma');
const pickFields = require('../utils/pickFields');

const PUBLIC_REPORT_FIELDS = ['title', 'description', 'latitude', 'longitude', 'time', 'priority'];
const ADMIN_REPORT_FIELDS = [...PUBLIC_REPORT_FIELDS, 'resolvedAt', 'status'];

exports.buildReportCreateData = (data) => ({
  ...pickFields(data, PUBLIC_REPORT_FIELDS),
  status: 'OPEN',
});

exports.buildReportUpdateData = (data) => pickFields(data, ADMIN_REPORT_FIELDS);

// Get all reports (only OPEN status for regular users)
exports.getAllReports = async () => {
  return prisma.reportEmergency.findMany({
    where: {
      status: 'OPEN'
    }
  });
};

// Get all reports regardless of status (for admin/PDF generation)
exports.getAllReportsAdmin = async () => {
  return prisma.reportEmergency.findMany();
};

// Get reports by status
exports.getReportsByStatus = async (status) => {
  return prisma.reportEmergency.findMany({
    where: {
      status: status
    }
  });
};

exports.canViewReport = (report, user) => {
  if (!report) return false;
  if (user?.role === 'admin') return true;
  return report.status === 'OPEN';
};

exports.buildOpenReportWhere = (bounds) => {
  const { northEast, southWest } = bounds;
  return {
    status: 'OPEN',
    latitude: {
      gte: southWest.lat,
      lte: northEast.lat,
    },
    longitude: {
      gte: southWest.lng,
      lte: northEast.lng,
    },
  };
};

const TIME_WINDOWS = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
};

exports.buildTimeBasedWhere = (bounds, timeFilter = 'all') => {
  const where = { ...exports.buildOpenReportWhere(bounds) };
  const windowMs = TIME_WINDOWS[timeFilter];
  if (windowMs) {
    where.createdAt = { gte: new Date(Date.now() - windowMs) };
  }
  return where;
};

exports.getReportById = async (id) => {
  return prisma.reportEmergency.findUnique({ where: { id: id } });
};

// Create report
exports.createReport = async (data) => {
  return prisma.reportEmergency.create({ data: exports.buildReportCreateData(data) });
};

// Update report
exports.updateReport = async (id, data) => {
  return prisma.reportEmergency.update({
    where: { id: id },
    data: exports.buildReportUpdateData(data),
  });
};

// Delete report
exports.deleteReport = async (id) => {
  return prisma.reportEmergency.delete({ where: { id: id } });
};

// Heatmap Services

// Get reports within a bounding box for heatmap
exports.getReportsInBounds = async (bounds) => {
  return prisma.reportEmergency.findMany({
    where: exports.buildOpenReportWhere(bounds),
    select: {
      id: true,
      latitude: true,
      longitude: true,
      priority: true,
      createdAt: true,
      title: true
    }
  });
};

// Get heatmap data with clustering/aggregation by grid
exports.getHeatmapData = async (bounds, gridSize = 0.01) => {
  const reports = await prisma.reportEmergency.findMany({
    where: exports.buildOpenReportWhere(bounds),
    select: {
      latitude: true,
      longitude: true,
      priority: true,
      createdAt: true
    }
  });

  // Group reports by grid cells
  const gridData = {};
  
  reports.forEach(report => {
    // Round coordinates to grid size
    const gridLat = Math.round(report.latitude / gridSize) * gridSize;
    const gridLng = Math.round(report.longitude / gridSize) * gridSize;
    const gridKey = `${gridLat},${gridLng}`;
    
    if (!gridData[gridKey]) {
      gridData[gridKey] = {
        latitude: gridLat,
        longitude: gridLng,
        count: 0,
        highPriority: 0,
        mediumPriority: 0,
        lowPriority: 0,
        weight: 0
      };
    }
    
    gridData[gridKey].count++;
    
    // Count by priority
    switch (report.priority) {
      case 'HIGH':
        gridData[gridKey].highPriority++;
        gridData[gridKey].weight += 3; // High priority has more weight
        break;
      case 'MEDIUM':
        gridData[gridKey].mediumPriority++;
        gridData[gridKey].weight += 2;
        break;
      case 'LOW':
        gridData[gridKey].lowPriority++;
        gridData[gridKey].weight += 1;
        break;
    }
  });

  return Object.values(gridData);
};

// Get heatmap statistics
exports.getHeatmapStats = async (bounds) => {
  const boundsWhere = exports.buildOpenReportWhere(bounds);

  const totalReports = await prisma.reportEmergency.count({
    where: boundsWhere,
  });

  const priorityStats = await prisma.reportEmergency.groupBy({
    by: ['priority'],
    where: boundsWhere,
    _count: {
      priority: true
    }
  });

  const now = new Date();
  const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const recentStats = await Promise.all([
    prisma.reportEmergency.count({
      where: { ...boundsWhere, createdAt: { gte: last24Hours } }
    }),
    prisma.reportEmergency.count({
      where: { ...boundsWhere, createdAt: { gte: last7Days } }
    }),
    prisma.reportEmergency.count({
      where: { ...boundsWhere, createdAt: { gte: last30Days } }
    })
  ]);

  return {
    totalReports,
    priorityBreakdown: priorityStats.reduce((acc, stat) => {
      acc[stat.priority.toLowerCase()] = stat._count.priority;
      return acc;
    }, {}),
    recentActivity: {
      last24Hours: recentStats[0],
      last7Days: recentStats[1],
      last30Days: recentStats[2]
    }
  };
};

// Get time-based heatmap data
exports.getTimeBasedHeatmapData = async (bounds, timeFilter = 'all') => {
  return prisma.reportEmergency.findMany({
    where: exports.buildTimeBasedWhere(bounds, timeFilter),
    select: {
      id: true,
      latitude: true,
      longitude: true,
      priority: true,
      createdAt: true,
      title: true
    },
    orderBy: {
      createdAt: 'desc'
    }
  });
};