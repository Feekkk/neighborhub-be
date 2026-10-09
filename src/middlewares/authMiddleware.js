const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../config/authConfig');

const authMiddleware = (req, res, next) => {
  const authHeader = req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  const token = authHeader.slice('Bearer '.length).trim();

  if (!token || token === 'null' || token === 'undefined') {
    return res.status(401).json({ error: 'Access denied. Invalid token format.' });
  }

  let secret;
  try {
    secret = getJwtSecret();
  } catch {
    return res.status(500).json({ error: 'Authentication is not configured.' });
  }

  try {
    const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] });
    if (typeof decoded.exp !== 'number') {
      return res.status(401).json({ error: 'Invalid token.' });
    }
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token.' });
  }
};

const requireAdmin = (req, res, next) => {
  authMiddleware(req, res, () => {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required.' });
    }
    next();
  });
};

module.exports = authMiddleware;
module.exports.requireAdmin = requireAdmin;
