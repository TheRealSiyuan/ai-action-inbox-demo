import "server-only";
import { randomUUID } from "node:crypto";
import { buildApproval, verifyApproval } from "@/lib/actions/approval-token";
import { applyEdit, type ActionEdit } from "@/lib/actions/materiality";
import { InvalidTransitionError, LOCAL_OPERATOR, approveWith, reject } from "@/lib/actions/state-machine";
import type { Action, MessageAnalysis } from "@/lib/actions/types";
import { analyseMessage, PlannerOutputError } from "@/lib/analyse";
import type { AuditEvent } from "@/lib/audit/events";
import { executeApprovedAction, ExecutionRefusedError } from "@/lib/execution/gate";
import { toMessageSource } from "@/lib/inbox/types";
import { connectorForMode, inboxForMode, plannerForMode } from "@/lib/mode";
import { findAnalysisByExternalId, loadAction, loadAnalysis, recordAuditEvents, saveAction, saveAnalysis, } from "@/lib/store/repository";
const runtime = globalThis as typeof globalThis & {
    demoExecuting?: Set<string>;
};
const executing = runtime.demoExecuting ??= new Set<string>();
let sequence = 0;
function event<T extends AuditEvent["type"]>(type: T, detail: Omit<Extract<AuditEvent, {
    type: T;
}>, "id" | "at" | "type">): AuditEvent {
    sequence += 1;
    return {
        ...(detail as object),
        type,
        id: `evt_${Date.now()}_${sequence}`,
        at: new Date().toISOString(),
    } as AuditEvent;
}
export type WorkflowResult = {
    action: Action;
    events: AuditEvent[];
};
export async function analyseAndStore(input: {
    inboxMessageId: string;
}): Promise<MessageAnalysis> {
    const previous = findAnalysisByExternalId(input.inboxMessageId);
    if (previous)
        return previous;
    const inbox = inboxForMode();
    const available = await inbox.list(100);
    if (!available.some(message => message.id === input.inboxMessageId)) {
        throw new WorkflowError("NOT_FOUND", "Unknown sample message.", 404);
    }
    const message = await inbox.get(input.inboxMessageId);
    const runId = randomUUID();
    const analysis = await analyseMessage(message.body, await plannerForMode(), {
        makeId: index => `act_${runId}_${index + 1}`,
        source: toMessageSource(inbox, message),
        context: { subject: message.subject, fromName: message.from, fromEmail: message.fromEmail },
    });
    analysis.id = `msg_${runId}`;
    saveAnalysis(analysis);
    const events: AuditEvent[] = [
        event("MESSAGE_ANALYSED", {
            messageId: analysis.id,
            planner: analysis.planner,
            priority: analysis.priority,
            actionCount: analysis.actions.length,
            needsClarification: analysis.needsClarification,
        }),
        ...(analysis.suspectedInjection
            ? [
                event("INJECTION_DETECTED", {
                    messageId: analysis.id,
                    note: analysis.injectionNote ?? "Instruction-like text detected in the message.",
                }),
            ]
            : []),
        ...analysis.actions.map((action) => event("ACTION_PROPOSED", {
            messageId: analysis.id,
            actionId: action.id,
            actionType: action.type,
            confidence: action.confidence,
        })),
    ];
    recordAuditEvents(events);
    return analysis;
}
function requireAction(actionId: string): Action {
    const action = loadAction(actionId);
    if (!action)
        throw new WorkflowError("NOT_FOUND", `No action with id ${actionId}.`);
    return action;
}
export class WorkflowError extends Error {
    constructor(readonly reason: string, message: string, readonly status = 400) {
        super(message);
        this.name = "WorkflowError";
    }
}
export function approveAction(actionId: string): WorkflowResult {
    const action = requireAction(actionId);
    try {
        const approval = buildApproval(action, new Date().toISOString(), LOCAL_OPERATOR);
        const approved = approveWith(action, approval);
        saveAction(approved);
        const events = [
            event("ACTION_APPROVED", {
                actionId: approved.id,
                approvedBy: approval.approvedBy,
                fingerprint: approval.fingerprint.slice(0, 24),
            }),
        ];
        recordAuditEvents(events);
        return { action: approved, events };
    }
    catch (error) {
        if (error instanceof InvalidTransitionError) {
            throw new WorkflowError("INVALID_TRANSITION", error.message, 409);
        }
        throw error;
    }
}
export function rejectAction(actionId: string): WorkflowResult {
    const action = requireAction(actionId);
    try {
        const rejected = reject(action);
        saveAction(rejected);
        const events = [event("ACTION_REJECTED", { actionId: rejected.id })];
        recordAuditEvents(events);
        return { action: rejected, events };
    }
    catch (error) {
        if (error instanceof InvalidTransitionError) {
            throw new WorkflowError("INVALID_TRANSITION", error.message, 409);
        }
        throw error;
    }
}
export function editAction(actionId: string, edit: ActionEdit): WorkflowResult {
    const action = requireAction(actionId);
    const outcome = applyEdit(action, edit);
    saveAction(outcome.action);
    const events = [
        event("ACTION_EDITED", {
            actionId: outcome.action.id,
            material: outcome.material,
            approvalInvalidated: outcome.approvalInvalidated,
            fields: Object.keys(edit).filter((key) => edit[key as keyof ActionEdit] !== undefined),
        }),
    ];
    recordAuditEvents(events);
    return { action: outcome.action, events };
}
export async function executeAction(actionId: string): Promise<WorkflowResult> {
    const action = requireAction(actionId);
    const connector = connectorForMode();
    if (!action.approval) {
        const events = [
            event("EXECUTION_REFUSED", {
                actionId,
                reason: "NO_APPROVAL_RECORD",
                detail: "This suggestion has not been approved.",
            }),
        ];
        recordAuditEvents(events);
        throw new WorkflowError("NO_APPROVAL_RECORD", "This suggestion has not been approved.", 403);
    }
    const verified = verifyApproval(action, action.approval);
    if (!verified.valid) {
        const detail = verified.reason === "BAD_SIGNATURE"
            ? "The stored approval was not issued by this computer. Approve it again."
            : "This suggestion changed after it was approved. Approve the current version first.";
        const events = [event("EXECUTION_REFUSED", { actionId, reason: verified.reason, detail })];
        recordAuditEvents(events);
        throw new WorkflowError(verified.reason, detail, 403);
    }
    recordAuditEvents([
        event("EXECUTION_REQUESTED", { actionId, connector: connector.name }),
    ]);
    if (executing.has(actionId))
        throw new WorkflowError("IN_PROGRESS", "This action is already running.", 409);
    executing.add(actionId);
    try {
        const outcome = await executeApprovedAction(action, connector);
        saveAction(outcome.action);
        const events = [
            outcome.record.outcome === "EXECUTED"
                ? event("ACTION_EXECUTED", {
                    actionId,
                    connector: outcome.record.connector,
                    simulated: outcome.record.simulated,
                    detail: outcome.record.detail,
                    externalId: outcome.record.externalId,
                })
                : event("EXECUTION_FAILED", {
                    actionId,
                    connector: outcome.record.connector,
                    detail: outcome.record.detail,
                }),
        ];
        recordAuditEvents(events);
        return { action: outcome.action, events };
    }
    catch (error) {
        if (error instanceof ExecutionRefusedError) {
            recordAuditEvents([
                event("EXECUTION_REFUSED", { actionId, reason: error.reason, detail: error.message }),
            ]);
            throw new WorkflowError(error.reason, error.message, 403);
        }
        throw error;
    }
    finally {
        executing.delete(actionId);
    }
}
export { PlannerOutputError };
export const reloadAnalysis = loadAnalysis;
