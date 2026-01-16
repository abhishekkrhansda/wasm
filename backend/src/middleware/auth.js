const jwt = require('jsonwebtoken');
const authConfig = require('../config/auth');
const db = require('../config/db');

/**
 * JWT Authentication middleware
 * Verifies token and attaches user to request
 */
const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const token = authHeader.split(' ')[1];

        const decoded = jwt.verify(token, authConfig.secret);

        // Fetch fresh user data
        const result = await db.query(
            'SELECT id, name, email, role FROM users WHERE id = $1',
            [decoded.userId]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'User not found' });
        }

        req.user = result.rows[0];
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired' });
        }
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: 'Invalid token' });
        }
        next(error);
    }
};

/**
 * Optional authentication - doesn't fail if no token
 */
const optionalAuth = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next();
    }

    try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, authConfig.secret);

        const result = await db.query(
            'SELECT id, name, email, role FROM users WHERE id = $1',
            [decoded.userId]
        );

        if (result.rows.length > 0) {
            req.user = result.rows[0];
        }
    } catch (error) {
        // Ignore auth errors for optional auth
    }

    next();
};

module.exports = { authenticate, optionalAuth };
