import { materialFingerprint } from "@/lib/actions/materiality";
import { transition } from "@/lib/actions/state-machine";
import type { Action, ExecutionRecord } from "@/lib/actions/types";
import { isExecutableType, type ActionConnector, type ExecutionOutcome } from "./types";
export type RefusalReason = "NOT_APPROVED" | "NO_APPROVAL_RECORD" | "PAYLOAD_CHANGED_SINCE_APPROVAL" | "TYPE_NOT_EXECUTABLE" | "NO_CONNECTOR";
export class ExecutionRefusedError extends Error {
    constructor(readonly reason: RefusalReason, message: string) {
        super(message);
        this.name = "ExecutionRefusedError";
    }
}
export function assertExecutable(action: Action, connector: ActionConnector | null): void {
    if (action.status !== "APPROVED") {
        throw new ExecutionRefusedError("NOT_APPROVED", `Action ${action.id} is ${action.status}. Only an APPROVED action can execute.`);
    }
    if (!action.approval) {
        throw new ExecutionRefusedError("NO_APPROVAL_RECORD", `Action ${action.id} is marked APPROVED but carries no approval record.`);
    }
    if (materialFingerprint(action) !== action.approval.fingerprint) {
        throw new ExecutionRefusedError("PAYLOAD_CHANGED_SINCE_APPROVAL", `Action ${action.id} has changed since it was approved. Re-approve the current version before executing.`);
    }
    if (!isExecutableType(action.type)) {
        throw new ExecutionRefusedError("TYPE_NOT_EXECUTABLE", `Action type ${action.type} has no side effect to perform.`);
    }
    if (!connector || !connector.supports(action.type)) {
        throw new ExecutionRefusedError("NO_CONNECTOR", `No connector is configured to execute ${action.type}.`);
    }
}
export async function executeApprovedAction(action: Action, connector: ActionConnector | null, now: Date = new Date()): Promise<ExecutionOutcome> {
    assertExecutable(action, connector);
    const active = connector!;
    const executing = transition(action, "EXECUTING", now);
    try {
        const result = await active.execute(executing);
        const record: ExecutionRecord = {
            connector: active.name,
            simulated: active.simulated,
            outcome: "EXECUTED",
            detail: result.detail,
            externalId: result.externalId ?? null,
            externalUrl: result.externalUrl ?? null,
            at: new Date().toISOString(),
        };
        return { action: { ...transition(executing, "EXECUTED", now), execution: record }, record };
    }
    catch (error) {
        const record: ExecutionRecord = {
            connector: active.name,
            simulated: active.simulated,
            outcome: "FAILED",
            detail: error instanceof Error ? error.message : "Execution failed for an unknown reason.",
            externalId: null,
            externalUrl: null,
            at: new Date().toISOString(),
        };
        return { action: { ...transition(executing, "FAILED", now), execution: record }, record };
    }
}
