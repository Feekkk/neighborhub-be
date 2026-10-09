const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const prisma = require('../config/prisma');
const { signToken, getAdminCredentials, credentialsMatch } = require('../config/authConfig');

router.post('/register', async (req, res) => {
  try {
    const { username, email, password, phoneNumber, address, gender, birthday } = req.body || {};

    if (!username || !email || !password) {
      return res.status(400).json({
        error: 'Username, email, and password are required'
      });
    }

    if (gender && !['MALE', 'FEMALE'].includes(gender)) {
      return res.status(400).json({
        error: 'Invalid gender value'
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        username,
        email,
        password: hashedPassword,
        phoneNumber: phoneNumber || null,
        address: address || null,
        gender: gender || null,
        birthday: birthday ? new Date(birthday) : null
      }
    });

    const token = signToken({ userId: user.id }, '7d');

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        phoneNumber: user.phoneNumber,
        address: user.address,
        gender: user.gender,
        birthday: user.birthday
      }
    });
  } catch (error) {
    if (error.code === 'P2002') {
      if (error.meta?.target?.includes('username')) {
        return res.status(400).json({ error: 'Username already exists' });
      }
      if (error.meta?.target?.includes('email')) {
        return res.status(400).json({ error: 'Email already exists' });
      }
      if (error.meta?.target?.includes('phoneNumber')) {
        return res.status(400).json({ error: 'Phone number already exists' });
      }
    }
    if (error.code === 'INSECURE_JWT_SECRET') {
      return res.status(500).json({ error: 'Authentication is not configured.' });
    }
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { username, email, password } = req.body || {};

    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    if (!username && !email) {
      return res.status(400).json({ error: 'Username or email is required' });
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: username },
          { email: email }
        ]
      }
    });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const token = signToken({ userId: user.id }, '7d');
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      }
    });
  } catch (error) {
    if (error.code === 'INSECURE_JWT_SECRET') {
      return res.status(500).json({ error: 'Authentication is not configured.' });
    }
    res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/admin/login', async (req, res) => {
  try {
    const username = req.body?.username;
    const password = req.body?.password;
    const admin = getAdminCredentials();
    const usernameOk = credentialsMatch(username || '', admin ? admin.username : 'unconfigured-admin-user');
    const passwordOk = credentialsMatch(password || '', admin ? admin.password : 'unconfigured-admin-password');

    if (!admin || !usernameOk || !passwordOk) {
      return res.status(400).json({ error: 'Invalid admin credentials' });
    }

    const token = signToken({ userId: 'admin', role: 'admin' }, '24h');

    res.json({
      token,
      user: {
        id: 'admin',
        username: 'admin',
        role: 'admin'
      }
    });
  } catch (error) {
    if (error.code === 'INSECURE_JWT_SECRET') {
      return res.status(500).json({ error: 'Authentication is not configured.' });
    }
    res.status(500).json({ error: 'Admin login failed' });
  }
});

module.exports = router;
