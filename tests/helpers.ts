import { buildApproval, hmacSigner } from "@/lib/actions/approval-token";
import type { Action } from "@/lib/actions/types";
import { approveWith } from "@/lib/actions/state-machine";
import type { PlannerAction } from "@/lib/schemas";
import { NOW } from "./fixtures";
export function makeAction(overrides: Partial<Action> & Pick<PlannerAction, "type">): Action {
    const base = {
        id: "act_1",
        status: "PROPOSED" as const,
        statusChangedAt: NOW.toISOString(),
        edited: false,
        approval: null,
        execution: null,
        title: "Create calendar event: Catch-up",
        description: "Would create a calendar event.",
        confidence: 0.9,
        clarificationNeeded: null,
    };
    const payloads = {
        create_calendar_event: {
            title: "Catch-up",
            startTime: "2026-09-11T15:00",
            durationMinutes: 30,
            attendees: [],
            description: "Proposed from an incoming message.",
        },
        reschedule_calendar_event: {
            eventId: null,
            eventRef: "Friday's AI workshop",
            newStartTime: "2026-09-11T15:00",
            newDurationMinutes: null,
            addAttendees: [],
            reason: "Requested by the sender.",
        },
        draft_reply: { to: [], subject: "Re: your message", replyText: "Hi,\n\nThanks.\n\nBest," },
        create_task: { title: "Send the revised agenda", notes: "Requested.", dueDate: null },
        request_information: { question: "What time?", missing: ["start time"] },
        no_action: { reason: "Informational." },
    } as const;
    return {
        ...base,
        payload: payloads[overrides.type],
        ...overrides,
    } as Action;
}
export function approveForTest(action: Action, now: Date = NOW): Action {
    return approveWith(action, buildApproval(action, now.toISOString(), "test-operator"), now);
}
export { hmacSigner };
