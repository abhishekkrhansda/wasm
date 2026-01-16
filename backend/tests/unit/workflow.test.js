const WorkflowService = require('../../src/services/workflow.service');
const { STATUS, ROLES } = require('../../src/config/constants');

describe('WorkflowService', () => {
    describe('canTransition', () => {
        // Valid transitions
        test('Manager can transition Created → Assigned', () => {
            const result = WorkflowService.canTransition(STATUS.CREATED, STATUS.ASSIGNED, ROLES.MANAGER);
            expect(result.valid).toBe(true);
        });

        test('Analyst can transition Assigned → In Progress', () => {
            const result = WorkflowService.canTransition(STATUS.ASSIGNED, STATUS.IN_PROGRESS, ROLES.ANALYST);
            expect(result.valid).toBe(true);
        });

        test('Analyst can transition In Progress → Under Review', () => {
            const result = WorkflowService.canTransition(STATUS.IN_PROGRESS, STATUS.UNDER_REVIEW, ROLES.ANALYST);
            expect(result.valid).toBe(true);
        });

        test('Manager can transition Under Review → Closed', () => {
            const result = WorkflowService.canTransition(STATUS.UNDER_REVIEW, STATUS.CLOSED, ROLES.MANAGER);
            expect(result.valid).toBe(true);
        });

        test('Manager can return case for rework (Under Review → In Progress)', () => {
            const result = WorkflowService.canTransition(STATUS.UNDER_REVIEW, STATUS.IN_PROGRESS, ROLES.MANAGER);
            expect(result.valid).toBe(true);
        });

        // Invalid transitions - wrong role
        test('Requester cannot assign cases', () => {
            const result = WorkflowService.canTransition(STATUS.CREATED, STATUS.ASSIGNED, ROLES.REQUESTER);
            expect(result.valid).toBe(false);
            expect(result.reason).toContain('not authorized');
        });

        test('Analyst cannot close cases', () => {
            const result = WorkflowService.canTransition(STATUS.UNDER_REVIEW, STATUS.CLOSED, ROLES.ANALYST);
            expect(result.valid).toBe(false);
            expect(result.reason).toContain('not authorized');
        });

        test('Requester cannot transition any status', () => {
            const result = WorkflowService.canTransition(STATUS.ASSIGNED, STATUS.IN_PROGRESS, ROLES.REQUESTER);
            expect(result.valid).toBe(false);
        });

        // Invalid transitions - invalid path
        test('Cannot skip from Created to In Progress', () => {
            const result = WorkflowService.canTransition(STATUS.CREATED, STATUS.IN_PROGRESS, ROLES.MANAGER);
            expect(result.valid).toBe(false);
            expect(result.reason).toContain('Cannot transition');
        });

        test('Cannot go backward from Closed', () => {
            const result = WorkflowService.canTransition(STATUS.CLOSED, STATUS.UNDER_REVIEW, ROLES.MANAGER);
            expect(result.valid).toBe(false);
        });

        test('Cannot skip from Created to Closed', () => {
            const result = WorkflowService.canTransition(STATUS.CREATED, STATUS.CLOSED, ROLES.ADMIN);
            expect(result.valid).toBe(false);
        });
    });

    describe('getAvailableTransitions', () => {
        test('Manager sees Assigned option for Created cases', () => {
            const transitions = WorkflowService.getAvailableTransitions(STATUS.CREATED, ROLES.MANAGER);
            expect(transitions).toContain(STATUS.ASSIGNED);
        });

        test('Analyst sees In Progress option for Assigned cases', () => {
            const transitions = WorkflowService.getAvailableTransitions(STATUS.ASSIGNED, ROLES.ANALYST);
            expect(transitions).toContain(STATUS.IN_PROGRESS);
        });

        test('Manager sees Closed and In Progress for Under Review', () => {
            const transitions = WorkflowService.getAvailableTransitions(STATUS.UNDER_REVIEW, ROLES.MANAGER);
            expect(transitions).toContain(STATUS.CLOSED);
            expect(transitions).toContain(STATUS.IN_PROGRESS);
        });

        test('Requester sees no transitions', () => {
            const transitions = WorkflowService.getAvailableTransitions(STATUS.CREATED, ROLES.REQUESTER);
            expect(transitions).toHaveLength(0);
        });

        test('No transitions available from Closed', () => {
            const transitions = WorkflowService.getAvailableTransitions(STATUS.CLOSED, ROLES.MANAGER);
            expect(transitions).toHaveLength(0);
        });
    });

    describe('canAssign', () => {
        test('Can assign cases in Created status', () => {
            expect(WorkflowService.canAssign(STATUS.CREATED)).toBe(true);
        });

        test('Cannot assign cases in other statuses', () => {
            expect(WorkflowService.canAssign(STATUS.ASSIGNED)).toBe(false);
            expect(WorkflowService.canAssign(STATUS.IN_PROGRESS)).toBe(false);
            expect(WorkflowService.canAssign(STATUS.CLOSED)).toBe(false);
        });
    });
});
