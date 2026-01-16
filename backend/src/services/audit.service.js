const db = require('../config/db');
const { AUDIT_ACTIONS } = require('../config/constants');

/**
 * Audit Service - Immutable logging of all case actions
 */
class AuditService {
    /**
     * Log a case creation event
     */
    static async logCaseCreated(caseId, performedBy, details = {}) {
        return this.log({
            caseId,
            action: AUDIT_ACTIONS.CASE_CREATED,
            newStatus: 'Created',
            performedBy,
            details
        });
    }

    /**
     * Log a status transition
     */
    static async logStatusChange(caseId, previousStatus, newStatus, performedBy, details = {}) {
        return this.log({
            caseId,
            action: AUDIT_ACTIONS.STATUS_CHANGED,
            previousStatus,
            newStatus,
            performedBy,
            details
        });
    }

    /**
     * Log a case assignment
     */
    static async logAssignment(caseId, previousAssignee, newAssignee, performedBy, details = {}) {
        return this.log({
            caseId,
            action: AUDIT_ACTIONS.CASE_ASSIGNED,
            previousAssignee,
            newAssignee,
            performedBy,
            details
        });
    }

    /**
     * Log a case update
     */
    static async logCaseUpdate(caseId, performedBy, details = {}) {
        return this.log({
            caseId,
            action: AUDIT_ACTIONS.CASE_UPDATED,
            performedBy,
            details
        });
    }

    /**
     * Log comment added
     */
    static async logCommentAdded(caseId, performedBy, details = {}) {
        return this.log({
            caseId,
            action: AUDIT_ACTIONS.COMMENT_ADDED,
            performedBy,
            details
        });
    }

    /**
     * Core logging function
     */
    static async log({ caseId, action, previousStatus, newStatus, previousAssignee, newAssignee, performedBy, details }) {
        const result = await db.query(
            `INSERT INTO case_audit_log
       (case_id, action, previous_status, new_status, previous_assignee, new_assignee, performed_by, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
            [caseId, action, previousStatus, newStatus, previousAssignee, newAssignee, performedBy, JSON.stringify(details)]
        );
        return result.rows[0];
    }

    /**
     * Get audit trail for a case
     */
    static async getAuditTrail(caseId) {
        const result = await db.query(
            `SELECT
        cal.*,
        u.name as performed_by_name,
        u.email as performed_by_email
       FROM case_audit_log cal
       JOIN users u ON cal.performed_by = u.id
       WHERE cal.case_id = $1
       ORDER BY cal.timestamp DESC`,
            [caseId]
        );
        return result.rows;
    }
}

module.exports = AuditService;
