const { ROLES } = require('../config/constants');

/**
 * Role-based access control middleware factory
 * @param  {...string} allowedRoles - Roles allowed to access the route
 * @returns {Function} Express middleware
 */
const requireRole = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                error: 'Access denied',
                message: `Required role: ${allowedRoles.join(' or ')}. Your role: ${req.user.role}`
            });
        }

        next();
    };
};

/**
 * Admin only access
 */
const requireAdmin = requireRole(ROLES.ADMIN);

/**
 * Manager or Admin access
 */
const requireManager = requireRole(ROLES.MANAGER, ROLES.ADMIN);

/**
 * Analyst, Manager or Admin access
 */
const requireAnalyst = requireRole(ROLES.ANALYST, ROLES.MANAGER, ROLES.ADMIN);

/**
 * Any authenticated user
 */
const requireAuth = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    next();
};

module.exports = {
    requireRole,
    requireAdmin,
    requireManager,
    requireAnalyst,
    requireAuth
};
