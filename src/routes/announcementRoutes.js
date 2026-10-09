const express = require('express');
const router = express.Router();
const announcementController = require('../controllers/announcementController');
const requireAdmin = require('../middlewares/authMiddleware').requireAdmin;

router.get('/', announcementController.getAllAnnouncements);
router.get('/with-expiration', announcementController.getAnnouncementsWithExpiration);
router.get('/expiring', announcementController.getExpiringAnnouncements);
router.get('/:id', announcementController.getAnnouncementById);

router.post('/', requireAdmin, announcementController.createAnnouncement);
router.put('/:id', requireAdmin, announcementController.updateAnnouncement);
router.delete('/:id', requireAdmin, announcementController.deleteAnnouncement);
router.post('/cleanup', requireAdmin, announcementController.performCleanup);

module.exports = router;
