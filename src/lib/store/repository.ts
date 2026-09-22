import "server-only";
import type { Action, MessageAnalysis } from "@/lib/actions/types";
import type { AuditEvent } from "@/lib/audit/events";
type DemoStore = {
    analyses: Map<string, MessageAnalysis>;
    actions: Map<string, Action>;
    events: AuditEvent[];
};
const runtime = globalThis as typeof globalThis & {
    actionInboxDemoStore?: DemoStore;
};
const store: DemoStore = runtime.actionInboxDemoStore ??= { analyses: new Map(), actions: new Map(), events: [] };
export function saveAnalysis(analysis: MessageAnalysis): void {
    store.analyses.set(analysis.id, structuredClone(analysis));
    for (const action of analysis.actions)
        store.actions.set(action.id, structuredClone(action));
}
export function saveAction(action: Action): void {
    if (!store.actions.has(action.id))
        throw new Error("Unknown demo action");
    store.actions.set(action.id, structuredClone(action));
}
export function loadAction(id: string): Action | null {
    const action = store.actions.get(id);
    return action ? structuredClone(action) : null;
}
export function loadAnalysis(id: string): MessageAnalysis | null {
    const analysis = store.analyses.get(id);
    return analysis ? { ...structuredClone(analysis), actions: analysis.actions.map(a => loadAction(a.id)!) } : null;
}
export function findAnalysisByExternalId(id: string): MessageAnalysis | null {
    const analysis = [...store.analyses.values()].find(a => a.source.externalId === id);
    return analysis ? loadAnalysis(analysis.id) : null;
}
export function recordAuditEvents(events: AuditEvent[]): void {
    store.events.push(...structuredClone(events));
}
export function recentAuditEvents(limit = 200): AuditEvent[] {
    return structuredClone(store.events.slice(-limit).reverse());
}
export function storageSummary() {
    return { messages: store.analyses.size, actions: store.actions.size, auditEvents: store.events.length };
}
export function eraseAllData(): void {
    store.analyses.clear();
    store.actions.clear();
    store.events.length = 0;
}
