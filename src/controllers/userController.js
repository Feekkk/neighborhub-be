const userService = require('../services/userServices');

exports.getAllUsers = async (req, res) => {
  try {
    const users = await userService.getAllUsers();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Request failed' });
  }
};

exports.getUserById = async (req, res) => {
  try {
    const user = await userService.getUserById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Request failed' });
  }
};

exports.createUser = async (req, res) => {
  try {
    const { username, email, password, phoneNumber, address, gender, birthday } = req.body;
    
    // Basic validation
    if (!username || !email || !password) {
      return res.status(400).json({ 
        error: 'Username, email, and password are required' 
      });
    }
    
    // Validate gender if provided
    if (gender && !['MALE', 'FEMALE'].includes(gender)) {
      return res.status(400).json({ 
        error: 'Invalid gender value' 
      });
    }
    
    // Check if username already exists
    if (await userService.checkUsernameExists(username)) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    
    // Check if email already exists
    if (await userService.checkEmailExists(email)) {
      return res.status(400).json({ error: 'Email already exists' });
    }
    
    // Check if phone number already exists (if provided)
    if (phoneNumber && await userService.checkPhoneExists(phoneNumber)) {
      return res.status(400).json({ error: 'Phone number already exists' });
    }
    
    const user = await userService.createUser(req.body);
    res.status(201).json(user);
  } catch (err) {
    res.status(400).json({ error: 'Invalid request' });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { username, email, phoneNumber, gender } = req.body;
    const userId = req.params.id;
    
    // Validate gender if provided
    if (gender && !['MALE', 'FEMALE'].includes(gender)) {
      return res.status(400).json({ 
        error: 'Invalid gender value' 
      });
    }
    
    // Check if username is being changed and already exists
    if (username) {
      const existingUser = await userService.checkUsernameExists(username);
      if (existingUser) {
        const currentUser = await userService.getUserById(userId);
        if (currentUser && currentUser.username !== username) {
          return res.status(400).json({ error: 'Username already exists' });
        }
      }
    }
    
    // Check if email is being changed and already exists
    if (email) {
      const existingUser = await userService.checkEmailExists(email);
      if (existingUser) {
        const currentUser = await userService.getUserById(userId);
        if (currentUser && currentUser.email !== email) {
          return res.status(400).json({ error: 'Email already exists' });
        }
      }
    }
    
    // Check if phone number is being changed and already exists
    if (phoneNumber) {
      const existingUser = await userService.checkPhoneExists(phoneNumber);
      if (existingUser) {
        const currentUser = await userService.getUserById(userId);
        if (currentUser && currentUser.phoneNumber !== phoneNumber) {
          return res.status(400).json({ error: 'Phone number already exists' });
        }
      }
    }
    
    const user = await userService.updateUser(userId, req.body);
    res.json(user);
  } catch (err) {
    res.status(400).json({ error: 'Invalid request' });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    await userService.deleteUser(req.params.id);
    res.status(204).send();
  } catch (err) {
    res.status(400).json({ error: 'Invalid request' });
  }
};

// Request password reset
exports.requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    // Check if user exists
    const user = await userService.getUserByEmail(email);
    if (!user) {
      // Don't reveal if email exists or not for security
      return res.json({ 
        message: 'If the email exists, a password reset link has been sent' 
      });
    }
    
    // Generate reset token
    const { resetToken } = await userService.generateResetToken(email);
    
    // Send email
    await userService.sendPasswordResetEmail(email, resetToken);
    
    res.json({ 
      message: 'If the email exists, a password reset link has been sent' 
    });
  } catch {
    res.status(500).json({ error: 'Failed to process password reset request' });
  }
};

// Verify reset token
exports.verifyResetToken = async (req, res) => {
  try {
    const { token } = req.params;
    
    if (!token) {
      return res.status(400).json({ error: 'Reset token is required' });
    }
    
    const user = await userService.verifyResetToken(token);
    
    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }
    
    res.json({ 
      valid: true, 
      message: 'Token is valid',
      email: user.email // Can be used to show which account is being reset
    });
  } catch (err) {
    res.status(500).json({ error: 'Request failed' });
  }
};

// Reset password with token
exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    
    if (!token || !newPassword) {
      return res.status(400).json({ 
        error: 'Token and new password are required' 
      });
    }
    
    // Validate password strength
    if (newPassword.length < 6) {
      return res.status(400).json({ 
        error: 'Password must be at least 6 characters long' 
      });
    }
    
    const user = await userService.resetPasswordWithToken(token, newPassword);
    
    res.json({ 
      message: 'Password reset successfully',
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      }
    });
  } catch (err) {
    if (err.message === 'Invalid or expired reset token') {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }
    res.status(500).json({ error: 'Request failed' });
  }
};