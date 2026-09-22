import type { Action, MessageAnalysis } from "@/lib/actions/types";
import type { ActionEdit } from "@/lib/actions/materiality";
import type { AuditEvent } from "@/lib/audit/events";
import type { InboxMessage } from "@/lib/inbox/types";
import type { ModeStatus } from "@/lib/mode";
export type StorageSummary = {
    messages: number;
    actions: number;
    auditEvents: number;
};
export type ModeResponse = {
    status: ModeStatus;
    storage: StorageSummary;
};
export class ApiError extends Error {
    constructor(message: string, readonly reason: string | null, readonly issues: string[] = []) {
        super(message);
        this.name = "ApiError";
    }
}
async function call<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, init);
    const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) {
        throw new ApiError(typeof data.error === "string" ? data.error : `Something went wrong (${response.status}).`, typeof data.reason === "string" ? data.reason : null, Array.isArray(data.issues) ? (data.issues as string[]) : []);
    }
    return data as T;
}
const post = <T>(url: string) => call<T>(url, { method: "POST" });
export const fetchMode = () => call<ModeResponse>("/api/mode");
export const fetchActivity = () => call<{
    events: AuditEvent[];
}>("/api/activity");
export const fetchInbox = () => call<{
    messages: InboxMessage[];
    live: boolean;
}>("/api/inbox");
export const analyse = (input: {
    inboxMessageId: string;
}) => call<{
    analysis: MessageAnalysis;
}>("/api/analyse", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
}).then((data) => data.analysis);
export const approveAction = (id: string) => post<{
    action: Action;
}>(`/api/actions/${id}/approve`);
export const rejectAction = (id: string) => post<{
    action: Action;
}>(`/api/actions/${id}/reject`);
export const executeAction = (id: string) => post<{
    action: Action;
}>(`/api/actions/${id}/execute`);
export const editAction = (action: Action, edit: ActionEdit) => call<{
    action: Action;
}>(`/api/actions/${action.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: action.type, ...edit }),
});
export const eraseData = () => post<{
    erased: boolean;
}>("/api/settings/erase");
