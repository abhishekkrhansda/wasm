const { TRANSITIONS, STATUS } = require('../config/constants');

/**
 * Workflow Service - State machine for case lifecycle
 */
class WorkflowService {
    /**
     * Check if a status transition is valid for a given role
     * @param {string} currentStatus - Current case status
     * @param {string} targetStatus - Desired new status
     * @param {string} userRole - Role of the user attempting transition
     * @returns {Object} { valid: boolean, reason?: string }
     */
    static canTransition(currentStatus, targetStatus, userRole) {
        // Check if current status exists in transitions
        if (!TRANSITIONS[currentStatus]) {
            return {
                valid: false,
                reason: `No transitions available from status: ${currentStatus}`
            };
        }

        // Check if target status is a valid destination
        const allowedRoles = TRANSITIONS[currentStatus][targetStatus];
        if (!allowedRoles) {
            const validDestinations = Object.keys(TRANSITIONS[currentStatus]);
            return {
                valid: false,
                reason: `Cannot transition from '${currentStatus}' to '${targetStatus}'. Valid destinations: ${validDestinations.join(', ')}`
            };
        }

        // Check if user role is authorized
        if (!allowedRoles.includes(userRole)) {
            return {
                valid: false,
                reason: `Role '${userRole}' is not authorized for this transition. Required: ${allowedRoles.join(' or ')}`
            };
        }

        return { valid: true };
    }

    /**
     * Get all possible transitions from a status for a given role
     * @param {string} currentStatus - Current case status
     * @param {string} userRole - Role of the user
     * @returns {string[]} Array of valid target statuses
     */
    static getAvailableTransitions(currentStatus, userRole) {
        if (!TRANSITIONS[currentStatus]) {
            return [];
        }

        const available = [];
        for (const [targetStatus, allowedRoles] of Object.entries(TRANSITIONS[currentStatus])) {
            if (allowedRoles.includes(userRole)) {
                available.push(targetStatus);
            }
        }
        return available;
    }

    /**
     * Get all statuses
     */
    static getAllStatuses() {
        return Object.values(STATUS);
    }

    /**
     * Check if a case can be assigned (must be in Created status)
     * @param {string} currentStatus
     * @returns {boolean}
     */
    static canAssign(currentStatus) {
        return currentStatus === STATUS.CREATED;
    }

    /**
     * Validate required fields for status transition
     * @param {Object} caseData - Case data
     * @param {string} targetStatus - Target status
     * @returns {Object} { valid: boolean, errors?: string[] }
     */
    static validateTransitionRequirements(caseData, targetStatus) {
        const errors = [];

        // Cannot transition to Assigned without an assignee
        if (targetStatus === STATUS.ASSIGNED && !caseData.assigned_to) {
            errors.push('Case must have an assignee before setting status to Assigned');
        }

        // Cannot close without going through review
        if (targetStatus === STATUS.CLOSED && caseData.status !== STATUS.UNDER_REVIEW) {
            errors.push('Case must be Under Review before closing');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }
}

module.exports = WorkflowService;
