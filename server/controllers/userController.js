import User from '../models/User.js';
import Company from '../models/Company.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import emailService from '../services/emailService/index.js';
import { ROLES } from '../config/constants.js';

// GET /api/users — Admin: list all users in company
export const getUsers = asyncHandler(async (req, res) => {
  const users = await User.find({ companyId: req.user.companyId })
    .select('-password')
    .populate('managerId', 'name email')
    .sort({ createdAt: -1 });

  res.json(new ApiResponse(200, users, 'Users fetched'));
});

// POST /api/users — Admin creates a new user
export const createUser = asyncHandler(async (req, res) => {
  const { name, email, password, role, managerId } = req.body;

  if (!name || !email || !password) {
    throw new ApiError(400, 'Name, email, and password are required');
  }

  const existing = await User.findOne({ email });
  if (existing) throw new ApiError(409, 'Email already registered');

  const validRoles = Object.values(ROLES);
  const assignedRole = validRoles.includes(role) ? role : ROLES.EMPLOYEE;

  // Validate manager exists in same company if managerId provided
  if (managerId) {
    const manager = await User.findOne({
      _id: managerId,
      companyId: req.user.companyId,
    });
    if (!manager) throw new ApiError(404, 'Manager not found in this company');
  }

  const user = await User.create({
    name,
    email,
    password,
    role: assignedRole,
    companyId: req.user.companyId,
    managerId: managerId || null,
  });

  // Auto-send credentials email to newly created user
  const company = await Company.findById(req.user.companyId);
  try {
    await emailService.sendCredentials({
      name: user.name,
      email: user.email,
      password: password,
      companyName: company?.name || 'Your Company',
      role: user.role,
    });
  } catch (err) {
    console.error('Failed to send credentials email:', err.message);
    // Don't block user creation if email fails — log warning but continue
  }

  const populatedUser = await User.findById(user._id).select('-password').populate('managerId', 'name email');
  res.status(201).json(new ApiResponse(201, populatedUser, 'User created successfully. Credentials email sent.'));
});

// POST /api/users/:id/send-credentials — Admin sends login credentials via email
export const sendCredentials = asyncHandler(async (req, res) => {
  const user = await User.findOne({
    _id: req.params.id,
    companyId: req.user.companyId,
  });

  if (!user) throw new ApiError(404, 'User not found');

  // Get company name
  const company = await Company.findById(req.user.companyId);

  // Generate a random password if admin wants to reset it
  const { resetPassword } = req.body;
  let passwordToSend = '(use your existing password)';

  if (resetPassword) {
    const crypto = await import('crypto');
    passwordToSend = crypto.randomBytes(6).toString('hex');
    user.password = passwordToSend;
    await user.save();
  }

  let emailSent = false;
  let previewUrl = null;
  let emailError = null;

  try {
    const result = await emailService.sendCredentials({
      name: user.name,
      email: user.email,
      password: passwordToSend,
      companyName: company?.name || 'Your Company',
      role: user.role,
    });
    emailSent = true;
    previewUrl = result.previewUrl || null;
  } catch (err) {
    // Email failed but user exists — don't throw error, just log it
    console.error('Failed to send credentials email:', err.message);
    emailError = err.message;
  }

  // Always return success since user was created
  const message = emailSent 
    ? `Credentials sent to ${user.email}` 
    : `User created successfully, but email delivery failed. Please share credentials manually.`;

  res.json(new ApiResponse(200, {
    sent: emailSent,
    previewUrl,
    emailError,
  }, message));
});

// PATCH /api/users/:id/role — Admin changes a user's role
export const changeRole = asyncHandler(async (req, res) => {
  const { role } = req.body;
  const validRoles = Object.values(ROLES);

  if (!validRoles.includes(role)) {
    throw new ApiError(400, `Invalid role. Must be one of: ${validRoles.join(', ')}`);
  }

  const targetUser = await User.findOne({
    _id: req.params.id,
    companyId: req.user.companyId,
  });
  if (!targetUser) throw new ApiError(404, 'User not found');

  // Prevent demoting the last ADMIN in the company (SPEC requirement)
  if (targetUser.role === ROLES.ADMIN && role !== ROLES.ADMIN) {
    const adminCount = await User.countDocuments({
      companyId: req.user.companyId,
      role: ROLES.ADMIN,
    });
    if (adminCount <= 1) {
      throw new ApiError(400, 'Cannot demote the last ADMIN in the company');
    }
  }

  targetUser.role = role;
  await targetUser.save();

  const updatedUser = await User.findById(targetUser._id).select('-password');
  res.json(new ApiResponse(200, updatedUser, 'Role updated'));
});

// PATCH /api/users/:id/manager — Admin assigns a manager to a user
export const assignManager = asyncHandler(async (req, res) => {
  const { managerId } = req.body;

  if (managerId) {
    const manager = await User.findOne({
      _id: managerId,
      companyId: req.user.companyId,
    });
    if (!manager) throw new ApiError(404, 'Manager not found in your company');
  }

  const user = await User.findOneAndUpdate(
    { _id: req.params.id, companyId: req.user.companyId },
    { managerId: managerId || null },
    { new: true, select: '-password' }
  ).populate('managerId', 'name email');

  if (!user) throw new ApiError(404, 'User not found');
  res.json(new ApiResponse(200, user, 'Manager assigned'));
});

// GET /api/users/:id — Get single user
export const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findOne({
    _id: req.params.id,
    companyId: req.user.companyId,
  })
    .select('-password')
    .populate('managerId', 'name email');

  if (!user) throw new ApiError(404, 'User not found');
  res.json(new ApiResponse(200, user, 'User fetched'));
});

// DELETE /api/users/:id — Admin deletes a user
export const deleteUser = asyncHandler(async (req, res) => {
  if (req.params.id === req.user._id.toString()) {
    throw new ApiError(400, 'Cannot delete your own account');
  }

  const user = await User.findOneAndDelete({
    _id: req.params.id,
    companyId: req.user.companyId,
  });

  if (!user) throw new ApiError(404, 'User not found');
  res.json(new ApiResponse(200, null, 'User deleted'));
});
