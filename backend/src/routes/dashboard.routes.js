const express = require('express');
const db = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { requireManager } = require('../middleware/rbac');
const { STATUS, PRIORITY, CATEGORY } = require('../config/constants');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/dashboard/summary
 * Get case counts by status
 */
router.get('/summary', async (req, res, next) => {
  try {
    // Count by status
    const statusCounts = await db.query(`
      SELECT status, COUNT(*) as count
      FROM cases
      GROUP BY status
    `);

    // Count by priority
    const priorityCounts = await db.query(`
      SELECT priority, COUNT(*) as count
      FROM cases
      WHERE status != 'Closed'
      GROUP BY priority
    `);

    // Count by category
    const categoryCounts = await db.query(`
      SELECT category, COUNT(*) as count
      FROM cases
      GROUP BY category
    `);

    // Total counts
    const totals = await db.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status != 'Closed') as open,
        COUNT(*) FILTER (WHERE status = 'Closed') as closed,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') as created_this_week
      FROM cases
    `);

    res.json({
      summary: {
        ...totals.rows[0],
        byStatus: statusCounts.rows.reduce((acc, row) => {
          acc[row.status] = parseInt(row.count);
          return acc;
        }, {}),
        byPriority: priorityCounts.rows.reduce((acc, row) => {
          acc[row.priority] = parseInt(row.count);
          return acc;
        }, {}),
        byCategory: categoryCounts.rows.reduce((acc, row) => {
          acc[row.category] = parseInt(row.count);
          return acc;
        }, {})
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/dashboard/sla-breaches
 * Get cases that have breached or are about to breach SLA
 */
router.get('/sla-breaches', requireManager, async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT
        c.*,
        creator.name as created_by_name,
        assignee.name as assigned_to_name,
        CASE
          WHEN c.sla_due_at < NOW() THEN 'breached'
          WHEN c.sla_due_at < NOW() + INTERVAL '4 hours' THEN 'at_risk'
          ELSE 'on_track'
        END as sla_status,
        EXTRACT(EPOCH FROM (c.sla_due_at - NOW())) / 3600 as hours_remaining
      FROM cases c
      LEFT JOIN users creator ON c.created_by = creator.id
      LEFT JOIN users assignee ON c.assigned_to = assignee.id
      WHERE c.status NOT IN ('Closed')
        AND (c.sla_due_at < NOW() OR c.sla_due_at < NOW() + INTERVAL '24 hours')
      ORDER BY c.sla_due_at ASC
    `);

    const breached = result.rows.filter(c => c.sla_status === 'breached');
    const atRisk = result.rows.filter(c => c.sla_status === 'at_risk');

    res.json({
      breached: breached.length,
      atRisk: atRisk.length,
      cases: result.rows
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/dashboard/resolution-times
 * Get average resolution times by category
 */
router.get('/resolution-times', requireManager, async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT
        category,
        COUNT(*) as closed_count,
        AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600) as avg_hours,
        MIN(EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600) as min_hours,
        MAX(EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600) as max_hours
      FROM cases
      WHERE status = 'Closed'
      GROUP BY category
      ORDER BY avg_hours DESC
    `);

    res.json({
      resolutionTimes: result.rows.map(row => ({
        category: row.category,
        closedCount: parseInt(row.closed_count),
        avgHours: parseFloat(row.avg_hours?.toFixed(2) || 0),
        minHours: parseFloat(row.min_hours?.toFixed(2) || 0),
        maxHours: parseFloat(row.max_hours?.toFixed(2) || 0)
      }))
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/dashboard/analyst-workload
 * Get case distribution per analyst
 */
router.get('/analyst-workload', requireManager, async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT
        u.id,
        u.name,
        u.email,
        COUNT(c.id) as total_assigned,
        COUNT(c.id) FILTER (WHERE c.status = 'Assigned') as pending,
        COUNT(c.id) FILTER (WHERE c.status = 'In Progress') as in_progress,
        COUNT(c.id) FILTER (WHERE c.status = 'Under Review') as under_review
      FROM users u
      LEFT JOIN cases c ON c.assigned_to = u.id AND c.status != 'Closed'
      WHERE u.role = 'analyst'
      GROUP BY u.id, u.name, u.email
      ORDER BY total_assigned DESC
    `);

    res.json({
      analysts: result.rows.map(row => ({
        id: row.id,
        name: row.name,
        email: row.email,
        totalAssigned: parseInt(row.total_assigned),
        pending: parseInt(row.pending),
        inProgress: parseInt(row.in_progress),
        underReview: parseInt(row.under_review)
      }))
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/dashboard/recent-activity
 * Get recent audit log entries
 */
router.get('/recent-activity', async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT
        cal.*,
        c.case_id,
        c.title as case_title,
        u.name as performed_by_name
      FROM case_audit_log cal
      JOIN cases c ON cal.case_id = c.id
      JOIN users u ON cal.performed_by = u.id
      ORDER BY cal.timestamp DESC
      LIMIT 20
    `);

    res.json({ activities: result.rows });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/dashboard/my-pending-actions
 * Get cases waiting for current user's action based on their role
 */
router.get('/my-pending-actions', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;

    let pendingCases = [];
    let pendingReviews = [];

    if (role === 'analyst') {
      // Analyst: Cases assigned to them that need action
      const result = await db.query(`
                SELECT c.*,
                    CASE
                        WHEN c.sla_due_at < NOW() THEN 'overdue'
                        WHEN c.priority = 'Critical' AND c.sla_due_at < NOW() + INTERVAL '1 hour' THEN 'at_risk'
                        WHEN c.priority = 'High' AND c.sla_due_at < NOW() + INTERVAL '2 hours' THEN 'at_risk'
                        WHEN c.priority = 'Medium' AND c.sla_due_at < NOW() + INTERVAL '6 hours' THEN 'at_risk'
                        WHEN c.priority = 'Low' AND c.sla_due_at < NOW() + INTERVAL '12 hours' THEN 'at_risk'
                        ELSE 'on_track'
                    END as sla_status
                FROM cases c
                WHERE c.assigned_to = $1
                AND c.status IN ('Assigned', 'In Progress')
                ORDER BY c.sla_due_at ASC
            `, [userId]);
      pendingCases = result.rows;
    } else if (role === 'manager' || role === 'admin') {
      // Manager: Cases needing assignment or review
      const unassigned = await db.query(`
                SELECT c.*,
                    CASE
                        WHEN c.sla_due_at < NOW() THEN 'overdue'
                        WHEN c.priority = 'Critical' AND c.sla_due_at < NOW() + INTERVAL '1 hour' THEN 'at_risk'
                        WHEN c.priority = 'High' AND c.sla_due_at < NOW() + INTERVAL '2 hours' THEN 'at_risk'
                        WHEN c.priority = 'Medium' AND c.sla_due_at < NOW() + INTERVAL '6 hours' THEN 'at_risk'
                        WHEN c.priority = 'Low' AND c.sla_due_at < NOW() + INTERVAL '12 hours' THEN 'at_risk'
                        ELSE 'on_track'
                    END as sla_status
                FROM cases c
                WHERE c.status = 'Created'
                ORDER BY c.sla_due_at ASC
            `);
      pendingCases = unassigned.rows;

      const reviews = await db.query(`
                SELECT c.*, assignee.name as assigned_to_name,
                    CASE
                        WHEN c.sla_due_at < NOW() THEN 'overdue'
                        WHEN c.priority = 'Critical' AND c.sla_due_at < NOW() + INTERVAL '1 hour' THEN 'at_risk'
                        WHEN c.priority = 'High' AND c.sla_due_at < NOW() + INTERVAL '2 hours' THEN 'at_risk'
                        WHEN c.priority = 'Medium' AND c.sla_due_at < NOW() + INTERVAL '6 hours' THEN 'at_risk'
                        WHEN c.priority = 'Low' AND c.sla_due_at < NOW() + INTERVAL '12 hours' THEN 'at_risk'
                        ELSE 'on_track'
                    END as sla_status
                FROM cases c
                LEFT JOIN users assignee ON c.assigned_to = assignee.id
                WHERE c.status = 'Under Review'
                ORDER BY c.sla_due_at ASC
            `);
      pendingReviews = reviews.rows;
    } else if (role === 'requester') {
      // Requester: Their cases that need attention
      const result = await db.query(`
                SELECT c.*,
                    CASE
                        WHEN c.sla_due_at < NOW() THEN 'overdue'
                        WHEN c.priority = 'Critical' AND c.sla_due_at < NOW() + INTERVAL '1 hour' THEN 'at_risk'
                        WHEN c.priority = 'High' AND c.sla_due_at < NOW() + INTERVAL '2 hours' THEN 'at_risk'
                        WHEN c.priority = 'Medium' AND c.sla_due_at < NOW() + INTERVAL '6 hours' THEN 'at_risk'
                        WHEN c.priority = 'Low' AND c.sla_due_at < NOW() + INTERVAL '12 hours' THEN 'at_risk'
                        ELSE 'on_track'
                    END as sla_status
                FROM cases c
                WHERE c.created_by = $1 AND c.status != 'Closed'
                ORDER BY c.updated_at DESC
            `, [userId]);
      pendingCases = result.rows;
    }

    res.json({
      pendingCases,
      pendingReviews,
      totalPending: pendingCases.length + pendingReviews.length
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
