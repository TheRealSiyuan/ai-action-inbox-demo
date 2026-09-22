import type { ActionType, PriorityLevel } from "@/lib/schemas";
export const AUDIT_EVENT_TYPES = [
    "MESSAGE_ANALYSED",
    "ACTION_PROPOSED",
    "ACTION_EDITED",
    "ACTION_APPROVED",
    "ACTION_REJECTED",
    "EXECUTION_REQUESTED",
    "EXECUTION_REFUSED",
    "ACTION_EXECUTED",
    "EXECUTION_FAILED",
    "INJECTION_DETECTED",
] as const;
export type AuditEventType = (typeof AUDIT_EVENT_TYPES)[number];
type BaseEvent = {
    id: string;
    at: string;
};
export type AuditEvent = BaseEvent & ({
    type: "MESSAGE_ANALYSED";
    messageId: string;
    planner: string;
    priority: PriorityLevel;
    actionCount: number;
    needsClarification: boolean;
} | {
    type: "ACTION_PROPOSED";
    messageId: string;
    actionId: string;
    actionType: ActionType;
    confidence: number;
} | {
    type: "ACTION_EDITED";
    actionId: string;
    material: boolean;
    approvalInvalidated: boolean;
    fields: string[];
} | {
    type: "ACTION_APPROVED";
    actionId: string;
    approvedBy: string;
    fingerprint: string;
} | {
    type: "ACTION_REJECTED";
    actionId: string;
} | {
    type: "EXECUTION_REQUESTED";
    actionId: string;
    connector: string;
} | {
    type: "EXECUTION_REFUSED";
    actionId: string;
    reason: string;
    detail: string;
} | {
    type: "ACTION_EXECUTED";
    actionId: string;
    connector: string;
    simulated: boolean;
    detail: string;
    externalId: string | null;
} | {
    type: "EXECUTION_FAILED";
    actionId: string;
    connector: string;
    detail: string;
} | {
    type: "INJECTION_DETECTED";
    messageId: string;
    note: string;
});
export function describeEvent(event: AuditEvent): string {
    switch (event.type) {
        case "MESSAGE_ANALYSED":
            return `Analysed ${event.messageId} via ${event.planner} — ${event.priority} priority, ${event.actionCount} action(s)${event.needsClarification ? ", clarification needed" : ""}`;
        case "ACTION_PROPOSED":
            return `Proposed ${event.actionType} (${event.actionId}) at ${Math.round(event.confidence * 100)}% confidence`;
        case "ACTION_EDITED":
            return `Edited ${event.actionId} [${event.fields.join(", ") || "no fields"}]${event.material ? " — material" : " — cosmetic"}${event.approvalInvalidated ? ", approval withdrawn" : ""}`;
        case "ACTION_APPROVED":
            return `Approved ${event.actionId} by ${event.approvedBy}, bound to payload ${event.fingerprint}`;
        case "ACTION_REJECTED":
            return `Rejected ${event.actionId}`;
        case "EXECUTION_REQUESTED":
            return `Execution requested for ${event.actionId} via ${event.connector}`;
        case "EXECUTION_REFUSED":
            return `REFUSED execution of ${event.actionId} — ${event.reason}: ${event.detail}`;
        case "ACTION_EXECUTED":
            return `Executed ${event.actionId} via ${event.connector}${event.simulated ? " (simulated)" : ""} — ${event.detail}`;
        case "EXECUTION_FAILED":
            return `Execution of ${event.actionId} failed on ${event.connector} — ${event.detail}`;
        case "INJECTION_DETECTED":
            return `Instruction-injection attempt detected in ${event.messageId} — ignored. ${event.note}`;
    }
}
