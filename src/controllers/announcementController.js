const announcementService = require('../services/announcementServices');

exports.getAllAnnouncements = async (req, res) => {
  try {
    const announcements = await announcementService.getAllAnnouncements();
    res.json(announcements);
  } catch (err) {
    res.status(500).json({ error: 'Request failed' });
  }
};

exports.getAnnouncementsWithExpiration = async (req, res) => {
  try {
    const announcements = await announcementService.getAnnouncementsWithExpirationInfo();
    res.json(announcements);
  } catch (err) {
    res.status(500).json({ error: 'Request failed' });
  }
};

exports.getExpiringAnnouncements = async (req, res) => {
  try {
    const announcements = await announcementService.getExpiringAnnouncements();
    res.json({
      count: announcements.length,
      announcements: announcements
    });
  } catch (err) {
    res.status(500).json({ error: 'Request failed' });
  }
};

exports.getAnnouncementById = async (req, res) => {
  try {
    const announcement = await announcementService.getAnnouncementById(req.params.id);
    if (!announcement) return res.status(404).json({ error: 'Announcement not found' });
    res.json(announcement);
  } catch (err) {
    res.status(500).json({ error: 'Request failed' });
  }
};

exports.createAnnouncement = async (req, res) => {
  try {
    const announcement = await announcementService.createAnnouncement(req.body);
    res.status(201).json(announcement);
  } catch (err) {
    res.status(400).json({ error: 'Invalid request' });
  }
};

exports.updateAnnouncement = async (req, res) => {
  try {
    const announcement = await announcementService.updateAnnouncement(req.params.id, req.body);
    res.json(announcement);
  } catch (err) {
    res.status(400).json({ error: 'Invalid request' });
  }
};

exports.deleteAnnouncement = async (req, res) => {
  try {
    await announcementService.deleteAnnouncement(req.params.id);
    res.status(204).send();
  } catch (err) {
    res.status(400).json({ error: 'Invalid request' });
  }
};

exports.performCleanup = async (req, res) => {
  try {
    const result = await announcementService.performCleanup();
    res.json({
      message: 'Cleanup completed successfully',
      result: result
    });
  } catch (err) {
    res.status(500).json({ error: 'Request failed' });
  }
};