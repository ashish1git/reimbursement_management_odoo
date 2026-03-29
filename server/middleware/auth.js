import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';

/**
 * Verifies JWT from Authorization header or cookie and attaches req.user
 */
const authMiddleware = asyncHandler(async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies?.token) {
    token = req.cookies.token;
  }

  if (!token) {
    throw new ApiError(401, 'Access denied. No token provided.');
  }

  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  const user = await User.findById(decoded.id).select('-password').populate('companyId', 'name defaultCurrency country');

  if (!user) {
    throw new ApiError(401, 'User not found. Token is invalid.');
  }

  req.user = user;
  next();
});

export default authMiddleware;
