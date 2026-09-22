import type { PlannerAction } from "@/lib/schemas";
import type { Action } from "./types";
const normalise = (value: string) => value.trim().replace(/\s+/g, " ");
const normaliseList = (values: string[]) => values.map(normalise).sort();
type Fingerprintable = Pick<PlannerAction, "type" | "title" | "payload">;
export function materialFingerprint(action: Fingerprintable): string {
    const title = normalise(action.title);
    switch (action.type) {
        case "create_calendar_event": {
            const p = action.payload as Extract<PlannerAction, {
                type: "create_calendar_event";
            }>["payload"];
            return JSON.stringify({
                t: action.type,
                title,
                eventTitle: normalise(p.title),
                startTime: p.startTime,
                durationMinutes: p.durationMinutes,
                attendees: normaliseList(p.attendees),
                description: normalise(p.description),
            });
        }
        case "reschedule_calendar_event": {
            const p = action.payload as Extract<PlannerAction, {
                type: "reschedule_calendar_event";
            }>["payload"];
            return JSON.stringify({
                t: action.type,
                title,
                eventId: p.eventId,
                eventRef: normalise(p.eventRef),
                newStartTime: p.newStartTime,
                newDurationMinutes: p.newDurationMinutes,
                addAttendees: normaliseList(p.addAttendees),
                reason: normalise(p.reason),
            });
        }
        case "draft_reply": {
            const p = action.payload as Extract<PlannerAction, {
                type: "draft_reply";
            }>["payload"];
            return JSON.stringify({
                t: action.type,
                title,
                to: normaliseList(p.to),
                subject: normalise(p.subject),
                replyText: normalise(p.replyText),
            });
        }
        case "create_task": {
            const p = action.payload as Extract<PlannerAction, {
                type: "create_task";
            }>["payload"];
            return JSON.stringify({
                t: action.type,
                title,
                taskTitle: normalise(p.title),
                notes: normalise(p.notes),
                dueDate: p.dueDate,
            });
        }
        case "request_information": {
            const p = action.payload as Extract<PlannerAction, {
                type: "request_information";
            }>["payload"];
            return JSON.stringify({
                t: action.type,
                title,
                question: normalise(p.question),
                missing: normaliseList(p.missing),
            });
        }
        case "no_action": {
            const p = action.payload as Extract<PlannerAction, {
                type: "no_action";
            }>["payload"];
            return JSON.stringify({ t: action.type, title, reason: normalise(p.reason) });
        }
    }
}
export function isMaterialEdit(before: Fingerprintable, after: Fingerprintable): boolean {
    return materialFingerprint(before) !== materialFingerprint(after);
}
export type ActionEdit = {
    title?: string;
    description?: string;
    payload?: PlannerAction["payload"];
};
export type EditOutcome = {
    action: Action;
    material: boolean;
    approvalInvalidated: boolean;
};
export function applyEdit(action: Action, edit: ActionEdit, now: Date = new Date()): EditOutcome {
    if (action.status === "REJECTED" || action.status === "EXECUTING" || action.status === "EXECUTED") {
        return { action, material: false, approvalInvalidated: false };
    }
    const next = {
        ...action,
        title: edit.title ?? action.title,
        description: edit.description ?? action.description,
        payload: (edit.payload ?? action.payload) as Action["payload"],
    } as Action;
    const material = isMaterialEdit(action, next);
    const approvalInvalidated = material && action.status === "APPROVED";
    return {
        action: {
            ...next,
            edited: action.edited || material,
            status: approvalInvalidated ? "PROPOSED" : action.status,
            statusChangedAt: approvalInvalidated ? now.toISOString() : action.statusChangedAt,
            approval: material ? null : action.approval,
        },
        material,
        approvalInvalidated,
    };
}
