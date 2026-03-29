import ApiError from '../utils/ApiError.js';

/**
 * Central error handling middleware
 * Catches all errors passed via next(err) and formats consistent responses
 */
const errorHandler = (err, req, res, next) => {
  let error = err;

  // Handle Mongoose validation errors
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    error = new ApiError(400, 'Validation Error', messages);
  }

  // Handle Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    error = new ApiError(409, `${field} already exists`);
  }

  // Handle Mongoose CastError (invalid ObjectId)
  if (err.name === 'CastError') {
    error = new ApiError(400, `Invalid ${err.path}: ${err.value}`);
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    error = new ApiError(401, 'Invalid token. Please login again.');
  }
  if (err.name === 'TokenExpiredError') {
    error = new ApiError(401, 'Token expired. Please login again.');
  }

  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal Server Error';

  console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} - ${statusCode}: ${message}`);
  if (process.env.NODE_ENV === 'development') {
    console.error(err.stack);
  }

  res.status(statusCode).json({
    success: false,
    message,
    errors: error.errors || [],
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

export default errorHandler;
