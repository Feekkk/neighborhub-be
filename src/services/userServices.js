const prisma = require('../config/prisma');
const bcrypt = require('bcrypt');
const crypto = require('node:crypto');
const pickFields = require('../utils/pickFields');

const USER_UPDATE_FIELDS = ['username', 'email', 'password', 'phoneNumber', 'address', 'gender', 'birthday'];
const nodemailer = require('nodemailer');

// Get all users (include new fields)
exports.getAllUsers = async () => {
  return prisma.user.findMany({
    select: {
      id: true,
      username: true,
      email: true,
      phoneNumber: true,    
      address: true,        
      gender: true,         
      birthday: true,       
      createdAt: true,
      updatedAt: true
    }
  });
};

// Get user by ID (include new fields)
exports.getUserById = async (id) => {
  return prisma.user.findUnique({ 
    where: { id: id },
    select: {
      id: true,
      username: true,
      email: true,
      phoneNumber: true,    
      address: true,        
      gender: true,         
      birthday: true,       
      createdAt: true,
      updatedAt: true
    }
  });
};

// Create new user (with optional fields)
exports.createUser = async (data) => {
  const { username, email, password, phoneNumber, address, gender, birthday } = data;
  
  // Hash password before storing
  const hashedPassword = await bcrypt.hash(password, 10);
  
  return prisma.user.create({ 
    data: {
      username,
      email,
      password: hashedPassword,
      phoneNumber: phoneNumber || null,
      address: address || null,
      gender: gender || null,
      birthday: birthday ? new Date(birthday) : null
    },
    select: {
      id: true,
      username: true,
      email: true,
      phoneNumber: true,
      address: true,
      gender: true,
      birthday: true,
      createdAt: true,
      updatedAt: true
    }
  });
};

exports.collectUserUpdate = (data) => {
  const updateData = pickFields(data, USER_UPDATE_FIELDS);
  if (typeof updateData.password !== 'string') {
    delete updateData.password;
  }
  return updateData;
};

// Update user (with optional fields)
exports.updateUser = async (id, data) => {
  const updateData = exports.collectUserUpdate(data);

  if (typeof updateData.password === 'string') {
    updateData.password = await bcrypt.hash(updateData.password, 10);
  }
  
  // Convert birthday string to Date object if provided
  if (updateData.birthday) {
    updateData.birthday = new Date(updateData.birthday);
  }
  
  return prisma.user.update({ 
    where: { id: id }, 
    data: updateData,
    select: {
      id: true,
      username: true,
      email: true,
      phoneNumber: true,
      address: true,
      gender: true,
      birthday: true,
      createdAt: true,
      updatedAt: true
    }
  });
};

// Delete user
exports.deleteUser = async (id) => {
  return prisma.user.delete({ where: { id: id } });
};

// Check if username exists (for validation)
exports.checkUsernameExists = async (username) => {
  const user = await prisma.user.findUnique({ where: { username } });
  return !!user;
};

// Check if email exists (for validation)
exports.checkEmailExists = async (email) => {
  const user = await prisma.user.findUnique({ where: { email } });
  return !!user;
};

// Check if phone number exists (for validation)
exports.checkPhoneExists = async (phoneNumber) => {
  if (!phoneNumber) return false;
  const user = await prisma.user.findFirst({ where: { phoneNumber } });
  return !!user;
};

// Get user by email (for password reset)
exports.getUserByEmail = async (email) => {
  return prisma.user.findUnique({ 
    where: { email },
    select: {
      id: true,
      username: true,
      email: true,
      resetToken: true,
      resetTokenExpiry: true
    }
  });
};

// Generate password reset token
exports.generateResetToken = async (email) => {
  const user = await prisma.user.findUnique({ where: { email } });
  
  if (!user) {
    throw new Error('User not found');
  }
  
  // Generate a secure random token
  const resetToken = crypto.randomBytes(32).toString('hex');
  
  // Set token expiry to 1 hour from now
  const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour
  
  // Update user with reset token
  await prisma.user.update({
    where: { email },
    data: {
      resetToken,
      resetTokenExpiry
    }
  });
  
  return { resetToken, user };
};

// Verify reset token
exports.verifyResetToken = async (token) => {
  const user = await prisma.user.findFirst({
    where: {
      resetToken: token,
      resetTokenExpiry: {
        gte: new Date() // Token must not be expired
      }
    },
    select: {
      id: true,
      email: true,
      username: true,
      resetToken: true,
      resetTokenExpiry: true
    }
  });
  
  return user;
};

// Reset password with token
exports.resetPasswordWithToken = async (token, newPassword) => {
  // Verify token first
  const user = await exports.verifyResetToken(token);
  
  if (!user) {
    throw new Error('Invalid or expired reset token');
  }
  
  // Hash the new password
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  
  // Update password and clear reset token
  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashedPassword,
      resetToken: null,
      resetTokenExpiry: null
    },
    select: {
      id: true,
      username: true,
      email: true,
      createdAt: true,
      updatedAt: true
    }
  });
  
  return updatedUser;
};

// Send password reset email
exports.sendPasswordResetEmail = async (email, resetToken) => {
  // Create email transporter
  const transporter = nodemailer.createTransporter({
    // Use Gmail or your preferred email service
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER, // Your email
      pass: process.env.EMAIL_PASSWORD // Your email password or app password
    }
  });
  
  // Create reset URL - adjust the base URL according to your Flutter app
  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
  
  // Email content
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Password Reset Request - NeighborHub',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333; text-align: center;">Password Reset Request</h2>
        <p>Hello,</p>
        <p>You have requested to reset your password for your NeighborHub account.</p>
        <p>Please click the button below to reset your password:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" 
             style="background-color: #007bff; color: white; padding: 12px 24px; 
                    text-decoration: none; border-radius: 5px; display: inline-block;">
            Reset Password
          </a>
        </div>
        <p>Or copy and paste this link in your browser:</p>
        <p style="word-break: break-all; color: #007bff;">${resetUrl}</p>
        <p><strong>This link will expire in 1 hour.</strong></p>
        <p>If you didn't request this password reset, please ignore this email.</p>
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
        <p style="color: #666; font-size: 12px; text-align: center;">
          NeighborHub - Community Management System
        </p>
      </div>
    `
  };
  
  // Send email
  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Email sending failed:', error);
    throw new Error('Failed to send reset email');
  }
};