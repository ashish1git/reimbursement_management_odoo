import ApiError from '../utils/ApiError.js';

/**
 * Role-based access control middleware
 * Usage: roleMiddleware('ADMIN', 'MANAGER')
 */
const roleMiddleware = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      throw new ApiError(401, 'Authentication required.');
    }
    if (!roles.includes(req.user.role)) {
      throw new ApiError(
        403,
        `Access denied. Required roles: ${roles.join(', ')}. Your role: ${req.user.role}`
      );
    }
    next();
  };
};

export default roleMiddleware;
