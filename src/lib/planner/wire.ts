import { z } from "zod";
import { ACTION_TYPES } from "@/lib/schemas";
const WirePayloadSchema = z.object({
    title: z.string().nullable(),
    startTime: z.string().nullable(),
    durationMinutes: z.number().nullable(),
    attendees: z.array(z.string()).nullable(),
    description: z.string().nullable(),
    eventId: z.string().nullable(),
    eventRef: z.string().nullable(),
    newStartTime: z.string().nullable(),
    newDurationMinutes: z.number().nullable(),
    addAttendees: z.array(z.string()).nullable(),
    reason: z.string().nullable(),
    to: z.array(z.string()).nullable(),
    subject: z.string().nullable(),
    replyText: z.string().nullable(),
    notes: z.string().nullable(),
    dueDate: z.string().nullable(),
    question: z.string().nullable(),
    missing: z.array(z.string()).nullable(),
});
const WireActionSchema = z.object({
    type: z.enum(ACTION_TYPES),
    title: z.string(),
    description: z.string().nullable(),
    confidence: z.number(),
    clarificationNeeded: z.string().nullable(),
    payload: WirePayloadSchema,
});
export const WireResultSchema = z.object({
    summary: z.string(),
    priority: z.enum(["low", "medium", "high", "urgent"]),
    deadline: z.string().nullable(),
    replyRequired: z.boolean(),
    needsClarification: z.boolean(),
    clarificationReason: z.string().nullable(),
    suspectedInjection: z.boolean(),
    injectionNote: z.string().nullable(),
    actions: z.array(WireActionSchema),
});
export type WireResult = z.infer<typeof WireResultSchema>;
type WireAction = z.infer<typeof WireActionSchema>;
type WirePayload = z.infer<typeof WirePayloadSchema>;
const str = (value: string | null): string => value ?? "";
const list = (value: string[] | null): string[] => value ?? [];
const prose = (value: string | null): string | null => {
    const trimmed = (value ?? "").trim();
    return trimmed.length > 0 ? trimmed : null;
};
const describe = (description: string | null, title: string): string => prose(description) ?? title;
const ZERO_SECONDS = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}):00$/;
const localDateTime = (value: string | null): string => {
    const raw = str(value);
    return ZERO_SECONDS.exec(raw)?.[1] ?? raw;
};
function toDomainPayload(type: WireAction["type"], p: WirePayload): unknown {
    switch (type) {
        case "create_calendar_event":
            return {
                title: str(p.title),
                startTime: localDateTime(p.startTime),
                durationMinutes: p.durationMinutes ?? 0,
                attendees: list(p.attendees),
                description: str(p.description),
            };
        case "reschedule_calendar_event":
            return {
                eventId: p.eventId,
                eventRef: str(p.eventRef),
                newStartTime: localDateTime(p.newStartTime),
                newDurationMinutes: p.newDurationMinutes,
                addAttendees: list(p.addAttendees),
                reason: str(p.reason),
            };
        case "draft_reply":
            return { to: list(p.to), subject: str(p.subject), replyText: str(p.replyText) };
        case "create_task":
            return { title: str(p.title), notes: str(p.notes), dueDate: p.dueDate };
        case "request_information":
            return { question: str(p.question), missing: list(p.missing) };
        case "no_action":
            return { reason: str(p.reason) };
    }
}
export function toDomainResult(wire: WireResult): unknown {
    return {
        summary: wire.summary,
        priority: wire.priority,
        deadline: wire.deadline,
        replyRequired: wire.replyRequired,
        needsClarification: wire.needsClarification,
        clarificationReason: prose(wire.clarificationReason),
        suspectedInjection: wire.suspectedInjection,
        injectionNote: prose(wire.injectionNote),
        actions: wire.actions.map((action) => ({
            type: action.type,
            title: action.title,
            description: describe(action.description, action.title),
            confidence: action.confidence,
            clarificationNeeded: prose(action.clarificationNeeded),
            payload: toDomainPayload(action.type, action.payload),
        })),
    };
}
