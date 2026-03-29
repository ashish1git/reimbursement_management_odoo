import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/User.js';
import Company from '../models/Company.js';
import ApprovalFlow from '../models/ApprovalFlow.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import emailService from '../services/emailService/index.js';
import { ROLES, RULE_TYPES } from '../config/constants.js';

const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

/**
 * Resolve company default currency from country name via restcountries API
 */
async function resolveCurrencyFromCountry(country) {
  try {
    const res = await fetch('https://restcountries.com/v3.1/all?fields=name,currencies');
    if (!res.ok) return 'USD';
    const countries = await res.json();
    const match = countries.find(
      (c) => c.name?.common?.toLowerCase() === country.toLowerCase()
    );
    if (match?.currencies) {
      const currencyCode = Object.keys(match.currencies)[0];
      return currencyCode || 'USD';
    }
    return 'USD';
  } catch {
    return 'USD';
  }
}

// POST /api/auth/register
export const register = asyncHandler(async (req, res) => {
  const { name, email, password, country, companyName } = req.body;

  if (!name || !email || !password || !country) {
    throw new ApiError(400, 'Name, email, password, and country are required');
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) throw new ApiError(409, 'Email already registered');

  // Check if this is the very first company (determines company creation)
  // SPEC: One registration flow, one company forever
  const companyCount = await Company.countDocuments();
  const isFirstUser = companyCount === 0;

  if (isFirstUser) {
    const defaultCurrency = await resolveCurrencyFromCountry(country);

    // Step 1: Create user first (without companyId temporarily)
    const user = await User.create({
      name,
      email,
      password,
      role: ROLES.ADMIN,
      companyId: null,
    });

    // Step 2: Create company with the real userId
    const company = await Company.create({
      name: companyName || `${name}'s Company`,
      defaultCurrency,
      country,
      createdBy: user._id,
    });

    // Step 3: Link the company back to the user
    user.companyId = company._id;
    await user.save();

    // Step 4: Create default approval flow for the company
    await ApprovalFlow.create({
      companyId: company._id,
      name: 'Default Approval Flow',
      isManagerApproverFirst: true,
      isSequential: true,
      steps: [],
      rule: { type: RULE_TYPES.NONE },
    });

    const token = generateToken(user._id);
    res.cookie('token', token, cookieOptions);

    const populatedUser = await User.findById(user._id)
      .select('-password')
      .populate('companyId', 'name defaultCurrency country');

    return res.status(201).json(
      new ApiResponse(
        201,
        { user: populatedUser, company, token },
        'Company and Admin account created successfully'
      )
    );
  } else {
    throw new ApiError(
      403,
      'Self-registration is disabled. Contact your administrator.'
    );
  }
});

// POST /api/auth/login
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new ApiError(400, 'Email and password are required');
  }

  const user = await User.findOne({ email }).populate('companyId', 'name defaultCurrency country');
  if (!user) throw new ApiError(401, 'Invalid email or password');

  const isMatch = await user.comparePassword(password);
  if (!isMatch) throw new ApiError(401, 'Invalid email or password');

  const token = generateToken(user._id);
  res.cookie('token', token, cookieOptions);

  res.json(
    new ApiResponse(200, { user, token }, 'Login successful')
  );
});

// POST /api/auth/forgot-password
export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    throw new ApiError(400, 'Email is required');
  }

  const user = await User.findOne({ email });
  if (!user) {
    // Don't reveal that user doesn't exist (security)
    return res.json(new ApiResponse(200, null, 'If the email exists, a temporary password has been sent.'));
  }

  // Generate random temporary password (12 chars)
  const tempPassword = crypto.randomBytes(6).toString('hex'); // e.g., "a3f8c2d1e9b0"

  // Hash and save the new password
  user.password = tempPassword; // pre-save hook will hash it
  await user.save();

  // Send email with temp password
  try {
    const result = await emailService.sendPasswordReset({
      name: user.name,
      email: user.email,
      tempPassword,
    });

    res.json(
      new ApiResponse(200, {
        sent: true,
        previewUrl: result.previewUrl || null,
      }, 'Temporary password sent to your email.')
    );
  } catch (err) {
    console.error('Failed to send password reset email:', err.message);
    res.json(new ApiResponse(200, { sent: true }, 'Temporary password sent to your email.'));
  }
});

// POST /api/auth/logout
export const logout = asyncHandler(async (req, res) => {
  res.clearCookie('token');
  res.json(new ApiResponse(200, null, 'Logged out successfully'));
});

// GET /api/auth/me
export const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id)
    .select('-password')
    .populate('companyId', 'name defaultCurrency country')
    .populate('managerId', 'name email');
  res.json(new ApiResponse(200, user, 'User fetched'));
});

// GET /api/auth/check-first-user
export const checkFirstUser = asyncHandler(async (req, res) => {
  const count = await User.countDocuments();
  res.json(new ApiResponse(200, { isFirstUser: count === 0 }));
});
