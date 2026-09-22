import type { Action, ExecutionRecord } from "@/lib/actions/types";
import type { ActionType } from "@/lib/schemas";
export const EXECUTABLE_ACTION_TYPES: readonly ActionType[] = [
    "draft_reply",
    "create_calendar_event",
    "reschedule_calendar_event",
    "create_task",
] as const;
export function isExecutableType(type: ActionType): boolean {
    return EXECUTABLE_ACTION_TYPES.includes(type);
}
export type ConnectorResult = {
    detail: string;
    externalId?: string | null;
    externalUrl?: string | null;
};
export interface ActionConnector {
    readonly name: string;
    readonly simulated: boolean;
    supports(type: ActionType): boolean;
    execute(action: Action): Promise<ConnectorResult>;
}
export type ExecutionOutcome = {
    action: Action;
    record: ExecutionRecord;
};
