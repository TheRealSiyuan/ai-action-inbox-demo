import { materialFingerprint } from "./materiality";
import type { Action, ActionStatus, ApprovalRecord } from "./types";
export const ALLOWED_TRANSITIONS: Readonly<Record<ActionStatus, readonly ActionStatus[]>> = Object.freeze({
    PROPOSED: ["APPROVED", "REJECTED"],
    APPROVED: ["EXECUTING", "REJECTED"],
    EXECUTING: ["EXECUTED", "FAILED"],
    FAILED: ["APPROVED", "REJECTED"],
    REJECTED: [],
    EXECUTED: [],
});
export class InvalidTransitionError extends Error {
    constructor(readonly from: ActionStatus, readonly to: ActionStatus) {
        super(`Transition ${from} -> ${to} is not permitted`);
        this.name = "InvalidTransitionError";
    }
}
export function canTransition(from: ActionStatus, to: ActionStatus): boolean {
    return ALLOWED_TRANSITIONS[from].includes(to);
}
export function transition(action: Action, to: ActionStatus, now: Date = new Date()): Action {
    if (!canTransition(action.status, to)) {
        throw new InvalidTransitionError(action.status, to);
    }
    return { ...action, status: to, statusChangedAt: now.toISOString() };
}
export const LOCAL_OPERATOR = "local-operator";
export function approveWith(action: Action, approval: ApprovalRecord, now: Date = new Date()): Action {
    if (approval.fingerprint !== materialFingerprint(action)) {
        throw new Error(`Approval does not describe action ${action.id}: the payload changed after it was granted.`);
    }
    return { ...transition(action, "APPROVED", now), approval };
}
export function reject(action: Action, now?: Date): Action {
    return { ...transition(action, "REJECTED", now), approval: null };
}
