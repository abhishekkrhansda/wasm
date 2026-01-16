const express = require('express');
const { body, param, query, validationResult } = require('express-validator');

const db = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { requireRole, requireManager } = require('../middleware/rbac');
const { ROLES, STATUS, PRIORITY, CATEGORY, SLA_DEFAULTS } = require('../config/constants');
const WorkflowService = require('../services/workflow.service');
const AuditService = require('../services/audit.service');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * Generate unique case ID
 */
async function generateCaseId() {
    const prefix = process.env.CASE_ID_PREFIX || 'CASE';
    const result = await db.query("SELECT nextval('case_id_seq')");
    const seq = result.rows[0].nextval;
    return `${prefix}-${String(seq).padStart(5, '0')}`;
}

/**
 * Calculate SLA due date based on priority
 */
function calculateSlaDueDate(priority) {
    const hours = SLA_DEFAULTS[priority] || 48;
    const dueDate = new Date();
    dueDate.setHours(dueDate.getHours() + hours);
    return dueDate;
}

/**
 * POST /api/cases
 * Create a new case
 */
router.post('/', [
    body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 255 }),
    body('description').optional().trim(),
    body('category').isIn(Object.values(CATEGORY)).withMessage('Invalid category'),
    body('priority').isIn(Object.values(PRIORITY)).withMessage('Invalid priority')
], async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { title, description, category, priority } = req.body;
        const caseId = await generateCaseId();
        const slaDueAt = calculateSlaDueDate(priority);

        const result = await db.query(
            `INSERT INTO cases (case_id, title, description, category, priority, status, created_by, sla_due_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
            [caseId, title, description, category, priority, STATUS.CREATED, req.user.id, slaDueAt]
        );

        const newCase = result.rows[0];

        // Log audit
        await AuditService.logCaseCreated(newCase.id, req.user.id, {
            title,
            category,
            priority
        });

        res.status(201).json({
            message: 'Case created successfully',
            case: newCase
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/cases
 * List cases (filtered by role)
 */
router.get('/', [
    query('status').optional().isIn(Object.values(STATUS)),
    query('priority').optional().isIn(Object.values(PRIORITY)),
    query('category').optional().isIn(Object.values(CATEGORY)),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt()
], async (req, res, next) => {
    try {
        const { status, priority, category, page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;

        let whereClause = '';
        const params = [];
        const conditions = [];

        // Role-based filtering
        if (req.user.role === ROLES.REQUESTER) {
            conditions.push(`c.created_by = $${params.length + 1}`);
            params.push(req.user.id);
        } else if (req.user.role === ROLES.ANALYST) {
            conditions.push(`(c.assigned_to = $${params.length + 1} OR c.created_by = $${params.length + 1})`);
            params.push(req.user.id);
        }
        // Managers and Admins see all

        if (status) {
            conditions.push(`c.status = $${params.length + 1}`);
            params.push(status);
        }
        if (priority) {
            conditions.push(`c.priority = $${params.length + 1}`);
            params.push(priority);
        }
        if (category) {
            conditions.push(`c.category = $${params.length + 1}`);
            params.push(category);
        }

        if (conditions.length > 0) {
            whereClause = 'WHERE ' + conditions.join(' AND ');
        }

        // Get total count
        const countResult = await db.query(
            `SELECT COUNT(*) FROM cases c ${whereClause}`,
            params
        );
        const total = parseInt(countResult.rows[0].count);

        // Get cases with pagination
        const casesResult = await db.query(
            `SELECT
        c.*,
        creator.name as created_by_name,
        assignee.name as assigned_to_name,
        CASE
            WHEN c.status = 'Closed' THEN 'closed'
            WHEN c.sla_due_at < NOW() THEN 'overdue'
            WHEN c.priority = 'Critical' AND c.sla_due_at < NOW() + INTERVAL '1 hour' THEN 'at_risk'
            WHEN c.priority = 'High' AND c.sla_due_at < NOW() + INTERVAL '2 hours' THEN 'at_risk'
            WHEN c.priority = 'Medium' AND c.sla_due_at < NOW() + INTERVAL '6 hours' THEN 'at_risk'
            WHEN c.priority = 'Low' AND c.sla_due_at < NOW() + INTERVAL '12 hours' THEN 'at_risk'
            ELSE 'on_track'
        END as sla_status
       FROM cases c
       LEFT JOIN users creator ON c.created_by = creator.id
       LEFT JOIN users assignee ON c.assigned_to = assignee.id
       ${whereClause}
       ORDER BY
         CASE c.priority
           WHEN 'Critical' THEN 1
           WHEN 'High' THEN 2
           WHEN 'Medium' THEN 3
           ELSE 4
         END,
         c.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
            [...params, limit, offset]
        );

        res.json({
            cases: casesResult.rows,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/cases/:id
 * Get case details
 */
router.get('/:id', [
    param('id').isInt().toInt()
], async (req, res, next) => {
    try {
        const { id } = req.params;

        const result = await db.query(
            `SELECT
        c.*,
        creator.name as created_by_name,
        creator.email as created_by_email,
        assignee.name as assigned_to_name,
        assignee.email as assigned_to_email
       FROM cases c
       LEFT JOIN users creator ON c.created_by = creator.id
       LEFT JOIN users assignee ON c.assigned_to = assignee.id
       WHERE c.id = $1`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Case not found' });
        }

        const caseData = result.rows[0];

        // Add available transitions for current user
        caseData.availableTransitions = WorkflowService.getAvailableTransitions(
            caseData.status,
            req.user.role
        );

        res.json({ case: caseData });
    } catch (error) {
        next(error);
    }
});

/**
 * PUT /api/cases/:id
 * Update case details (title, description, category, priority)
 */
router.put('/:id', [
    param('id').isInt().toInt(),
    body('title').optional().trim().notEmpty().isLength({ max: 255 }),
    body('description').optional().trim(),
    body('category').optional().isIn(Object.values(CATEGORY)),
    body('priority').optional().isIn(Object.values(PRIORITY))
], async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { id } = req.params;
        const { title, description, category, priority } = req.body;

        // Get current case
        const current = await db.query('SELECT * FROM cases WHERE id = $1', [id]);
        if (current.rows.length === 0) {
            return res.status(404).json({ error: 'Case not found' });
        }

        const caseData = current.rows[0];

        // Check permissions (owner or assignee or manager/admin)
        const canEdit =
            caseData.created_by === req.user.id ||
            caseData.assigned_to === req.user.id ||
            [ROLES.MANAGER, ROLES.ADMIN].includes(req.user.role);

        if (!canEdit) {
            return res.status(403).json({ error: 'You do not have permission to edit this case' });
        }

        // Build update query
        const updates = [];
        const values = [];
        let paramIndex = 1;

        if (title !== undefined) {
            updates.push(`title = $${paramIndex++}`);
            values.push(title);
        }
        if (description !== undefined) {
            updates.push(`description = $${paramIndex++}`);
            values.push(description);
        }
        if (category !== undefined) {
            updates.push(`category = $${paramIndex++}`);
            values.push(category);
        }
        if (priority !== undefined) {
            updates.push(`priority = $${paramIndex++}`);
            values.push(priority);
            // Recalculate SLA if priority changes
            updates.push(`sla_due_at = $${paramIndex++}`);
            values.push(calculateSlaDueDate(priority));
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        updates.push(`updated_at = NOW()`);
        values.push(id);

        const result = await db.query(
            `UPDATE cases SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
            values
        );

        // Log audit
        await AuditService.logCaseUpdate(id, req.user.id, {
            changes: { title, description, category, priority }
        });

        res.json({
            message: 'Case updated successfully',
            case: result.rows[0]
        });
    } catch (error) {
        next(error);
    }
});

/**
 * PUT /api/cases/:id/status
 * Transition case status (workflow enforcement)
 */
router.put('/:id/status', [
    param('id').isInt().toInt(),
    body('status').isIn(Object.values(STATUS)).withMessage('Invalid status')
], async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { id } = req.params;
        const { status: targetStatus } = req.body;

        // Get current case
        const current = await db.query('SELECT * FROM cases WHERE id = $1', [id]);
        if (current.rows.length === 0) {
            return res.status(404).json({ error: 'Case not found' });
        }

        const caseData = current.rows[0];
        const previousStatus = caseData.status;

        // Validate transition
        const transitionCheck = WorkflowService.canTransition(
            previousStatus,
            targetStatus,
            req.user.role
        );

        if (!transitionCheck.valid) {
            return res.status(403).json({
                error: 'Invalid transition',
                reason: transitionCheck.reason
            });
        }

        // Validate requirements
        const requirementsCheck = WorkflowService.validateTransitionRequirements(
            caseData,
            targetStatus
        );

        if (!requirementsCheck.valid) {
            return res.status(400).json({
                error: 'Transition requirements not met',
                errors: requirementsCheck.errors
            });
        }

        // Perform transition
        const result = await db.query(
            `UPDATE cases SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
            [targetStatus, id]
        );

        // Log audit
        await AuditService.logStatusChange(id, previousStatus, targetStatus, req.user.id);

        res.json({
            message: `Case transitioned from '${previousStatus}' to '${targetStatus}'`,
            case: result.rows[0]
        });
    } catch (error) {
        next(error);
    }
});

/**
 * PUT /api/cases/:id/assign
 * Assign case to an analyst (Manager only)
 */
router.put('/:id/assign', requireManager, [
    param('id').isInt().toInt(),
    body('assigneeId').isInt().withMessage('Assignee ID is required')
], async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { id } = req.params;
        const { assigneeId } = req.body;

        // Get current case
        const current = await db.query('SELECT * FROM cases WHERE id = $1', [id]);
        if (current.rows.length === 0) {
            return res.status(404).json({ error: 'Case not found' });
        }

        const caseData = current.rows[0];

        // Verify assignee exists and is an analyst
        const assignee = await db.query(
            'SELECT id, name, role FROM users WHERE id = $1',
            [assigneeId]
        );
        if (assignee.rows.length === 0) {
            return res.status(404).json({ error: 'Assignee not found' });
        }
        if (assignee.rows[0].role !== ROLES.ANALYST) {
            return res.status(400).json({ error: 'Can only assign cases to analysts' });
        }

        const previousAssignee = caseData.assigned_to;
        let newStatus = caseData.status;

        // Auto-transition to Assigned if case is in Created status
        if (caseData.status === STATUS.CREATED) {
            newStatus = STATUS.ASSIGNED;
        }

        // Update case
        const result = await db.query(
            `UPDATE cases SET assigned_to = $1, status = $2, updated_at = NOW() WHERE id = $3 RETURNING *`,
            [assigneeId, newStatus, id]
        );

        // Log audit
        await AuditService.logAssignment(id, previousAssignee, assigneeId, req.user.id, {
            assigneeName: assignee.rows[0].name
        });

        if (newStatus !== caseData.status) {
            await AuditService.logStatusChange(id, caseData.status, newStatus, req.user.id, {
                reason: 'Auto-transitioned on assignment'
            });
        }

        res.json({
            message: `Case assigned to ${assignee.rows[0].name}`,
            case: result.rows[0]
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/cases/:id/comments
 * Add comment to a case
 */
router.post('/:id/comments', [
    param('id').isInt().toInt(),
    body('comment').trim().notEmpty().withMessage('Comment is required')
], async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { id } = req.params;
        const { comment } = req.body;

        // Verify case exists
        const caseCheck = await db.query('SELECT id FROM cases WHERE id = $1', [id]);
        if (caseCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Case not found' });
        }

        // Create comment
        const result = await db.query(
            `INSERT INTO comments (case_id, comment, created_by)
       VALUES ($1, $2, $3)
       RETURNING *`,
            [id, comment, req.user.id]
        );

        // Log audit
        await AuditService.logCommentAdded(id, req.user.id, {
            commentId: result.rows[0].id
        });

        res.status(201).json({
            message: 'Comment added',
            comment: result.rows[0]
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/cases/:id/comments
 * Get comments for a case
 */
router.get('/:id/comments', [
    param('id').isInt().toInt()
], async (req, res, next) => {
    try {
        const { id } = req.params;

        const result = await db.query(
            `SELECT
        c.*,
        u.name as created_by_name,
        u.email as created_by_email,
        u.role as created_by_role
       FROM comments c
       JOIN users u ON c.created_by = u.id
       WHERE c.case_id = $1
       ORDER BY c.created_at DESC`,
            [id]
        );

        res.json({ comments: result.rows });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/cases/:id/audit
 * Get audit trail for a case (Manager/Admin only)
 */
router.get('/:id/audit', requireManager, [
    param('id').isInt().toInt()
], async (req, res, next) => {
    try {
        const { id } = req.params;

        const audit = await AuditService.getAuditTrail(id);
        res.json({ audit });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
