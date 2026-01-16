/**
 * System constants for Workflow Automation & Case Management System
 */

// User Roles
const ROLES = {
    REQUESTER: 'requester',
    ANALYST: 'analyst',
    MANAGER: 'manager',
    ADMIN: 'admin'
};

// Case Statuses (Workflow States)
const STATUS = {
    CREATED: 'Created',
    ASSIGNED: 'Assigned',
    IN_PROGRESS: 'In Progress',
    UNDER_REVIEW: 'Under Review',
    CLOSED: 'Closed'
};

// Case Priorities
const PRIORITY = {
    LOW: 'Low',
    MEDIUM: 'Medium',
    HIGH: 'High',
    CRITICAL: 'Critical'
};

// Case Categories
const CATEGORY = {
    IT: 'IT',
    HR: 'HR',
    FINANCE: 'Finance',
    COMPLIANCE: 'Compliance',
    OTHER: 'Other'
};

// Allowed status transitions with role permissions
// Format: { [fromStatus]: { [toStatus]: [allowedRoles] } }
const TRANSITIONS = {
    [STATUS.CREATED]: {
        [STATUS.ASSIGNED]: [ROLES.MANAGER, ROLES.ADMIN]
    },
    [STATUS.ASSIGNED]: {
        [STATUS.IN_PROGRESS]: [ROLES.ANALYST]
    },
    [STATUS.IN_PROGRESS]: {
        [STATUS.UNDER_REVIEW]: [ROLES.ANALYST]
    },
    [STATUS.UNDER_REVIEW]: {
        [STATUS.CLOSED]: [ROLES.MANAGER, ROLES.ADMIN],
        [STATUS.IN_PROGRESS]: [ROLES.MANAGER, ROLES.ADMIN] // Return for rework
    }
};

// Audit action types
const AUDIT_ACTIONS = {
    CASE_CREATED: 'CASE_CREATED',
    STATUS_CHANGED: 'STATUS_CHANGED',
    CASE_ASSIGNED: 'CASE_ASSIGNED',
    CASE_UPDATED: 'CASE_UPDATED',
    COMMENT_ADDED: 'COMMENT_ADDED'
};

// SLA defaults (in hours)
const SLA_DEFAULTS = {
    [PRIORITY.LOW]: 72,
    [PRIORITY.MEDIUM]: 48,
    [PRIORITY.HIGH]: 24,
    [PRIORITY.CRITICAL]: 4
};

module.exports = {
    ROLES,
    STATUS,
    PRIORITY,
    CATEGORY,
    TRANSITIONS,
    AUDIT_ACTIONS,
    SLA_DEFAULTS
};
