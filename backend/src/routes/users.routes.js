const express = require('express');
const bcrypt = require('bcryptjs');
const { body, param, validationResult } = require('express-validator');

const db = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { requireAdmin, requireManager } = require('../middleware/rbac');
const { ROLES } = require('../config/constants');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/users
 * List all users (Manager/Admin only)
 */
router.get('/', requireManager, async (req, res, next) => {
    try {
        const { role } = req.query;

        let query = `
      SELECT id, name, email, role, created_at
      FROM users
    `;
        const params = [];

        if (role && Object.values(ROLES).includes(role)) {
            query += ' WHERE role = $1';
            params.push(role);
        }

        query += ' ORDER BY created_at DESC';

        const result = await db.query(query, params);
        res.json({ users: result.rows });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/users/analysts
 * Get all analysts (for assignment dropdown)
 */
router.get('/analysts', requireManager, async (req, res, next) => {
    try {
        const result = await db.query(`
      SELECT id, name, email
      FROM users
      WHERE role = 'analyst'
      ORDER BY name
    `);
        res.json({ analysts: result.rows });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/users/:id
 * Get user by ID
 */
router.get('/:id', requireManager, [
    param('id').isInt().toInt()
], async (req, res, next) => {
    try {
        const { id } = req.params;

        const result = await db.query(`
      SELECT id, name, email, role, created_at
      FROM users
      WHERE id = $1
    `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ user: result.rows[0] });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/users
 * Create a new user (Admin only)
 */
router.post('/', requireAdmin, [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('role').isIn(Object.values(ROLES)).withMessage('Invalid role')
], async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { name, email, password, role } = req.body;

        // Check if user exists
        const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
        if (existing.rows.length > 0) {
            return res.status(409).json({ error: 'Email already registered' });
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 12);

        // Create user
        const result = await db.query(
            `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, role, created_at`,
            [name, email, passwordHash, role]
        );

        res.status(201).json({
            message: 'User created successfully',
            user: result.rows[0]
        });
    } catch (error) {
        next(error);
    }
});

/**
 * PUT /api/users/:id
 * Update user (Admin only)
 */
router.put('/:id', requireAdmin, [
    param('id').isInt().toInt(),
    body('name').optional().trim().notEmpty(),
    body('email').optional().isEmail().normalizeEmail(),
    body('role').optional().isIn(Object.values(ROLES))
], async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { id } = req.params;
        const { name, email, role } = req.body;

        // Check user exists
        const existing = await db.query('SELECT id FROM users WHERE id = $1', [id]);
        if (existing.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Build update query
        const updates = [];
        const values = [];
        let paramIndex = 1;

        if (name) {
            updates.push(`name = $${paramIndex++}`);
            values.push(name);
        }
        if (email) {
            updates.push(`email = $${paramIndex++}`);
            values.push(email);
        }
        if (role) {
            updates.push(`role = $${paramIndex++}`);
            values.push(role);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        updates.push(`updated_at = NOW()`);
        values.push(id);

        const result = await db.query(
            `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING id, name, email, role`,
            values
        );

        res.json({
            message: 'User updated successfully',
            user: result.rows[0]
        });
    } catch (error) {
        next(error);
    }
});

/**
 * DELETE /api/users/:id
 * Delete user (Admin only)
 */
router.delete('/:id', requireAdmin, [
    param('id').isInt().toInt()
], async (req, res, next) => {
    try {
        const { id } = req.params;

        // Prevent self-deletion
        if (id === req.user.id) {
            return res.status(400).json({ error: 'Cannot delete your own account' });
        }

        const result = await db.query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
