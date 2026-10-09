const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middlewares/authMiddleware');
const requireAdmin = authMiddleware.requireAdmin;

const allowSelfOrAdmin = (req, res, next) => {
  authMiddleware(req, res, () => {
    if (req.user.role === 'admin' || req.user.userId === req.params.id) {
      return next();
    }
    return res.status(403).json({ error: 'Access denied.' });
  });
};

router.get('/', requireAdmin, userController.getAllUsers);
router.get('/:id', allowSelfOrAdmin, userController.getUserById);

router.post('/', requireAdmin, userController.createUser);
router.put('/:id', allowSelfOrAdmin, userController.updateUser);
router.delete('/:id', requireAdmin, userController.deleteUser);

module.exports = router;
