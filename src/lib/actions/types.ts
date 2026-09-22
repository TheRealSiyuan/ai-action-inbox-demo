import type { PlannerAction, PriorityLevel } from "@/lib/schemas";
export const ACTION_STATUSES = [
    "PROPOSED",
    "APPROVED",
    "REJECTED",
    "EXECUTING",
    "EXECUTED",
    "FAILED",
] as const;
export type ActionStatus = (typeof ACTION_STATUSES)[number];
export type ApprovalRecord = {
    fingerprint: string;
    signature: string;
    approvedAt: string;
    approvedBy: string;
};
export type ExecutionRecord = {
    connector: string;
    simulated: boolean;
    outcome: "EXECUTED" | "FAILED";
    detail: string;
    externalId: string | null;
    externalUrl: string | null;
    at: string;
};
export type Action = PlannerAction & {
    id: string;
    status: ActionStatus;
    statusChangedAt: string;
    edited: boolean;
    approval: ApprovalRecord | null;
    execution: ExecutionRecord | null;
};
export type MessageSource = {
    kind: "manual" | "sample";
    label: string;
    externalId: string | null;
    from: string | null;
    subject: string | null;
    receivedAt: string | null;
};
export type MessageAnalysis = {
    id: string;
    message: string;
    source: MessageSource;
    analysedAt: string;
    planner: string;
    plannerIsModel: boolean;
    summary: string;
    priority: PriorityLevel;
    deadline: string | null;
    replyRequired: boolean;
    needsClarification: boolean;
    clarificationReason: string | null;
    suspectedInjection: boolean;
    injectionNote: string | null;
    actions: Action[];
};
