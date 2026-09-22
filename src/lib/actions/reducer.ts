import type { Action, MessageAnalysis } from "./types";
export type InboxState = {
    analysis: MessageAnalysis | null;
    error: string | null;
};
export const initialInboxState: InboxState = { analysis: null, error: null };
export type InboxIntent = {
    kind: "ANALYSIS_COMPLETED";
    analysis: MessageAnalysis;
} | {
    kind: "ANALYSIS_FAILED";
    error: string;
} | {
    kind: "ACTION_UPDATED";
    action: Action;
} | {
    kind: "ERROR";
    error: string;
} | {
    kind: "CLEAR_ERROR";
} | {
    kind: "RESET";
};
export function inboxReducer(state: InboxState, intent: InboxIntent): InboxState {
    switch (intent.kind) {
        case "RESET":
            return initialInboxState;
        case "ANALYSIS_COMPLETED":
            return { analysis: intent.analysis, error: null };
        case "ANALYSIS_FAILED":
            return { analysis: null, error: intent.error };
        case "ERROR":
            return { ...state, error: intent.error };
        case "CLEAR_ERROR":
            return { ...state, error: null };
        case "ACTION_UPDATED": {
            if (!state.analysis)
                return state;
            return {
                ...state,
                error: null,
                analysis: {
                    ...state.analysis,
                    actions: state.analysis.actions.map((action) => action.id === intent.action.id ? intent.action : action),
                },
            };
        }
    }
}
