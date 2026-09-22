import { z } from "zod";
export const PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export const PriorityLevelSchema = z.enum(PRIORITIES);
export type PriorityLevel = z.infer<typeof PriorityLevelSchema>;
export const ACTION_TYPES = [
    "create_calendar_event",
    "reschedule_calendar_event",
    "draft_reply",
    "create_task",
    "request_information",
    "no_action",
] as const;
export const ActionTypeSchema = z.enum(ACTION_TYPES);
export type ActionType = z.infer<typeof ActionTypeSchema>;
const ConfidenceSchema = z.number().min(0).max(1);
function isRealDate(value: string): boolean {
    const [y, m, d] = value.slice(0, 10).split("-").map(Number);
    const probe = new Date(Date.UTC(y, m - 1, d));
    return probe.getUTCFullYear() === y && probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d;
}
function isRealTime(value: string): boolean {
    const [hh, mm] = value.slice(11).split(":").map(Number);
    return hh <= 23 && mm <= 59;
}
const LocalDateTimeSchema = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "must be an ISO local datetime such as 2026-09-11T15:00")
    .refine(isRealDate, "names a date that does not exist")
    .refine(isRealTime, "names a time that does not exist");
const LocalDateSchema = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "must be an ISO date such as 2026-09-11")
    .refine(isRealDate, "names a date that does not exist");
const EmailSchema = z.string().email().max(200);
const PlannerActionBase = {
    title: z.string().min(1).max(200),
    description: z.string().min(1).max(2000),
    confidence: ConfidenceSchema,
    clarificationNeeded: z.string().min(1).max(500).nullable().default(null),
};
export const CreateCalendarEventPayloadSchema = z.object({
    title: z.string().min(1).max(200),
    startTime: LocalDateTimeSchema,
    durationMinutes: z.number().int().positive().max(24 * 60),
    attendees: z.array(EmailSchema).max(50),
    description: z.string().max(2000),
});
export type CreateCalendarEventPayload = z.infer<typeof CreateCalendarEventPayloadSchema>;
export const RescheduleCalendarEventPayloadSchema = z.object({
    eventId: z.string().min(1).max(200).nullable().default(null),
    eventRef: z.string().min(1).max(200),
    newStartTime: LocalDateTimeSchema,
    newDurationMinutes: z.number().int().positive().max(24 * 60).nullable().default(null),
    addAttendees: z.array(EmailSchema).max(50).default([]),
    reason: z.string().max(500),
});
export type RescheduleCalendarEventPayload = z.infer<typeof RescheduleCalendarEventPayloadSchema>;
export const DraftReplyPayloadSchema = z.object({
    to: z.array(EmailSchema).max(20).default([]),
    subject: z.string().min(1).max(300),
    replyText: z.string().min(1).max(8000),
});
export type DraftReplyPayload = z.infer<typeof DraftReplyPayloadSchema>;
export const CreateTaskPayloadSchema = z.object({
    title: z.string().min(1).max(200),
    notes: z.string().max(2000),
    dueDate: LocalDateSchema.nullable().default(null),
});
export type CreateTaskPayload = z.infer<typeof CreateTaskPayloadSchema>;
export const RequestInformationPayloadSchema = z.object({
    question: z.string().min(1).max(500),
    missing: z.array(z.string().min(1).max(120)).max(10).default([]),
});
export type RequestInformationPayload = z.infer<typeof RequestInformationPayloadSchema>;
export const NoActionPayloadSchema = z.object({
    reason: z.string().min(1).max(500),
});
export type NoActionPayload = z.infer<typeof NoActionPayloadSchema>;
export const PlannerActionSchema = z.discriminatedUnion("type", [
    z.object({
        ...PlannerActionBase,
        type: z.literal("create_calendar_event"),
        payload: CreateCalendarEventPayloadSchema,
    }),
    z.object({
        ...PlannerActionBase,
        type: z.literal("reschedule_calendar_event"),
        payload: RescheduleCalendarEventPayloadSchema,
    }),
    z.object({
        ...PlannerActionBase,
        type: z.literal("draft_reply"),
        payload: DraftReplyPayloadSchema,
    }),
    z.object({
        ...PlannerActionBase,
        type: z.literal("create_task"),
        payload: CreateTaskPayloadSchema,
    }),
    z.object({
        ...PlannerActionBase,
        type: z.literal("request_information"),
        payload: RequestInformationPayloadSchema,
    }),
    z.object({
        ...PlannerActionBase,
        type: z.literal("no_action"),
        payload: NoActionPayloadSchema,
    }),
]);
export type PlannerAction = z.infer<typeof PlannerActionSchema>;
export const PlannerResultSchema = z.object({
    summary: z.string().min(1).max(1000),
    priority: PriorityLevelSchema,
    deadline: LocalDateSchema.nullable().default(null),
    replyRequired: z.boolean(),
    needsClarification: z.boolean(),
    clarificationReason: z.string().min(1).max(500).nullable().default(null),
    suspectedInjection: z.boolean().default(false),
    injectionNote: z.string().min(1).max(500).nullable().default(null),
    actions: z.array(PlannerActionSchema).max(10),
});
export type PlannerResult = z.infer<typeof PlannerResultSchema>;
export const ACTION_PAYLOAD_SCHEMAS = {
    create_calendar_event: CreateCalendarEventPayloadSchema,
    reschedule_calendar_event: RescheduleCalendarEventPayloadSchema,
    draft_reply: DraftReplyPayloadSchema,
    create_task: CreateTaskPayloadSchema,
    request_information: RequestInformationPayloadSchema,
    no_action: NoActionPayloadSchema,
} as const;
export type ActionPayloadFor<T extends ActionType> = Extract<PlannerAction, {
    type: T;
}>["payload"];
