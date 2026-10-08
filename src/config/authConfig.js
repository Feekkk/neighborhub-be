const jwt = require('jsonwebtoken');
const crypto = require('node:crypto');

const MIN_JWT_SECRET_LENGTH = 32;
const MIN_ADMIN_PASSWORD_LENGTH = 12;

const INSECURE_JWT_SECRETS = new Set([
  'your-super-secret-jwt-key-here',
  'your_long_secure_jwt_secret_key_here',
]);

const INSECURE_ADMIN_USERNAMES = new Set([
  'admin-account',
]);

const INSECURE_ADMIN_PASSWORD_HASHES = new Set([
  '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9',
  '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8',
  '057ba03d6c44104863dc7361fe4578965d1887360f90a0895882e58a6248fc86',
]);

function isSecureJwtSecret(secret) {
  return typeof secret === 'string'
    && secret.length >= MIN_JWT_SECRET_LENGTH
    && secret.trim() === secret
    && !INSECURE_JWT_SECRETS.has(secret);
}

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!isSecureJwtSecret(secret)) {
    const error = new Error('JWT_SECRET is not configured securely');
    error.code = 'INSECURE_JWT_SECRET';
    throw error;
  }
  return secret;
}

function signToken(payload, expiresIn) {
  return jwt.sign(payload, getJwtSecret(), { expiresIn, algorithm: 'HS256' });
}

function passwordIsBlocked(password) {
  const hash = crypto.createHash('sha256').update(String(password)).digest('hex');
  return INSECURE_ADMIN_PASSWORD_HASHES.has(hash);
}

function getAdminCredentials() {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  if (typeof username !== 'string' || typeof password !== 'string') {
    return null;
  }
  if (!username || INSECURE_ADMIN_USERNAMES.has(username)) {
    return null;
  }
  if (password.length < MIN_ADMIN_PASSWORD_LENGTH || passwordIsBlocked(password)) {
    return null;
  }
  return { username, password };
}

function credentialsMatch(provided, expected) {
  const left = Buffer.from(String(provided));
  const right = Buffer.from(String(expected));
  if (left.length !== right.length) {
    crypto.timingSafeEqual(left, left);
    return false;
  }
  return crypto.timingSafeEqual(left, right);
}

module.exports = {
  getJwtSecret,
  signToken,
  getAdminCredentials,
  credentialsMatch,
};
