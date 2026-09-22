import type { PlannerAction, PlannerResult, PriorityLevel } from "@/lib/schemas";
import type { ActionPlanner, PlanRequest } from "./types";
import { describeInjection, detectInjection } from "./injection";
import { extractDay, extractDurationMinutes, extractEmails, extractReplyRecipient, extractTime, extractTopic, hasVagueTimeReference, isInPast, nextWeek, toIsoDate, } from "./text";
const HOLD_PATTERNS = [
    /\b(?:don'?t|do not|please don'?t|no need to)\b[^.?!]{0,40}\b(?:change|update|touch|book|schedule|move|add|create|send|confirm|action)\b/i,
    /\bhold off\b/i,
    /\bnot yet\b/i,
    /\bdon'?t act\b/i,
    /\bbefore (?:you|we) (?:do anything|act)\b/i,
    /\bwait (?:until|for) (?:I|we) confirm\b/i,
];
const MEETING_PATTERNS = [
    /\b(?:schedule|book|set up|arrange|organise|organize|calendar|invite|diary)\b/i,
    /\b(?:catch[- ]?up|meeting|call|sync|stand[- ]?up|1:1|one[- ]on[- ]one)\b/i,
];
const REPLY_PATTERNS = [
    /\b(?:reply|respond|write back|get back to)\b/i,
    /\b(?:let|tell)\s+(?:her|him|them|[A-Z][a-z]+)\s+(?:know|that)?\b/i,
    /\b(?:send)\s+(?:her|him|them)\s+(?:a )?(?:note|message)\b/i,
];
const INFORMATIONAL_PATTERNS = [
    /\bfyi\b/i,
    /\bfor your information\b/i,
    /\bjust so you know\b/i,
    /\bheads[- ]?up\b/i,
    /\bplease note\b/i,
    /\bno action (?:is )?(?:needed|required)\b/i,
];
const RESCHEDULE_PATTERNS = [
    /\b(?:move|reschedule|re-schedule|shift|bring forward|change the time of|postpone|bump)\b/i,
    /\bpush\b[^.?!\n]{0,40}\b(?:back|forward|to)\b/i,
];
const ADD_ATTENDEE_PATTERNS = [
    /\badd\b[^.?!\n]{0,40}\bto\b[^.?!\n]{0,40}\b(?:workshop|meeting|call|sync|catch[- ]?up|standup|stand-up|invite|event|session|review)\b/i,
    /\b(?:invite|include)\b[^.?!\n]{0,40}\b(?:to|in)\b[^.?!\n]{0,40}\b(?:workshop|meeting|call|sync|standup|event|session|review)\b/i,
];
const TASK_PATTERNS = [
    /\b(?:send (?:me |over |across |through )?(?:the|a|an|your)|share (?:the|a|an|your)|prepare|draft up|put together|write up|circulate|forward (?:me|the))\b/i,
];
const matchesAny = (patterns: RegExp[], text: string) => patterns.some((p) => p.test(text));
type Signals = {
    holdRequested: boolean;
    meetingIntent: boolean;
    replyIntent: boolean;
    informational: boolean;
    hasQuestion: boolean;
    day: ReturnType<typeof extractDay>;
    time: string | null;
    vagueTime: boolean;
    durationMinutes: number | null;
    topic: string | null;
    recipient: string | null;
    emails: string[];
    commitment: string | null;
    meetingNoun: string;
    resolvedDate: string | null;
    statedTimeHasPassed: boolean;
    rolledForwardAWeek: boolean;
    rescheduleIntent: boolean;
    addAttendeeIntent: boolean;
    taskIntent: boolean;
    taskObject: string | null;
    eventRef: string | null;
    subject: string | null;
    fromEmail: string | null;
    fromName: string | null;
};
function meetingNounFor(message: string): string {
    if (/\bcatch[- ]?up\b/i.test(message))
        return "Catch-up";
    if (/\b(?:1:1|one[- ]on[- ]one)\b/i.test(message))
        return "1:1";
    if (/\bstand[- ]?up\b/i.test(message))
        return "Stand-up";
    if (/\bcall\b/i.test(message))
        return "Call";
    if (/\bsync\b/i.test(message))
        return "Sync";
    return "Meeting";
}
function extractCommitment(message: string): string | null {
    const match = message.match(/\b(?:I'?ll|I will|I'?m going to|I am going to)\s+([^.?!\n]{3,140})/i);
    return match ? match[1].trim().replace(/\s+/g, " ") : null;
}
function extractTaskObject(message: string): string | null {
    const match = message.match(/\b(?:send|share|prepare|circulate|forward)\s+(?:me\s+|over\s+|across\s+|through\s+|us\s+)?(?:the|a|an|your)\s+([^.?!;\n]{3,60})/i);
    return match ? match[1].trim().replace(/\s+/g, " ").replace(/\s+(?:beforehand|before then|in advance)$/i, "") : null;
}
function extractEventRef(message: string): string | null {
    const possessive = message.match(/\b((?:this |next |last )?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:'s|s')\s+[a-z0-9 ]{2,40}?)(?=\s+(?:to|from|until|back|forward)\b|[.,?!;]|$)/i);
    if (possessive)
        return possessive[1].trim();
    const ourEvent = message.match(/\b((?:our|the|my)\s+(?:[a-z0-9-]+\s+){0,3}(?:workshop|meeting|call|sync|catch[- ]?up|review|session|standup|stand-up|1:1))\b/i);
    return ourEvent ? ourEvent[1].trim() : null;
}
function readSignals(message: string, now: Date, context: PlanRequest["context"]): Signals {
    const day = extractDay(message, now);
    const time = extractTime(message);
    let resolvedDate = day?.date ?? null;
    let statedTimeHasPassed = false;
    let rolledForwardAWeek = false;
    if (day && time && isInPast(day.date, time, now)) {
        if (day.kind === "weekday") {
            resolvedDate = nextWeek(day.date);
            rolledForwardAWeek = true;
        }
        else {
            resolvedDate = null;
            statedTimeHasPassed = true;
        }
    }
    return {
        resolvedDate,
        statedTimeHasPassed,
        rolledForwardAWeek,
        holdRequested: matchesAny(HOLD_PATTERNS, message),
        meetingIntent: matchesAny(MEETING_PATTERNS, message),
        replyIntent: matchesAny(REPLY_PATTERNS, message),
        informational: matchesAny(INFORMATIONAL_PATTERNS, message),
        hasQuestion: message.includes("?"),
        day,
        time,
        vagueTime: hasVagueTimeReference(message),
        durationMinutes: extractDurationMinutes(message),
        topic: extractTopic(message),
        recipient: extractReplyRecipient(message),
        emails: extractEmails(message),
        commitment: extractCommitment(message),
        meetingNoun: meetingNounFor(message),
        rescheduleIntent: matchesAny(RESCHEDULE_PATTERNS, message),
        addAttendeeIntent: matchesAny(ADD_ATTENDEE_PATTERNS, message),
        taskIntent: matchesAny(TASK_PATTERNS, message),
        taskObject: extractTaskObject(message),
        eventRef: extractEventRef(message),
        subject: context?.subject ?? null,
        fromEmail: context?.fromEmail ?? null,
        fromName: context?.fromName ?? null,
    };
}
function detectPriority(message: string, signals: Signals): PriorityLevel {
    if (/\b(?:urgent|asap|immediately|right away|critical|emergency)\b/i.test(message)) {
        return "urgent";
    }
    if (/\b(?:today|end of day|eod|by tomorrow|important|blocking)\b/i.test(message)) {
        return "high";
    }
    if (signals.informational || /\bno rush\b|\bwhenever you get a chance\b/i.test(message)) {
        return "low";
    }
    return "medium";
}
function detectDeadline(message: string, now: Date): string | null {
    const marker = message.match(/\b(?:by|due(?: on| by)?|deadline(?: is)?|before|no later than)\s+([^.?!\n]{2,40})/i);
    if (!marker)
        return null;
    const day = extractDay(marker[1], now);
    return day ? day.date : null;
}
const firstSentence = (message: string) => (message.trim().split(/(?<=[.?!])\s+/)[0] ?? message.trim()).trim();
function buildSummary(message: string, signals: Signals, scheduled: boolean): string {
    const parts: string[] = [];
    if (signals.holdRequested) {
        parts.push("Sender explicitly asked that nothing be changed yet.");
    }
    if (signals.rescheduleIntent && signals.eventRef && !signals.meetingIntent) {
        const when = signals.resolvedDate && signals.time
            ? ` to ${signals.day?.label ?? "a new date"} at ${signals.time}`
            : " to a time they have not pinned down";
        parts.push(`Sender asks to move ${signals.eventRef}${when}.`);
    }
    if (signals.addAttendeeIntent && !signals.rescheduleIntent) {
        parts.push(`Sender asks to add people to ${signals.eventRef ?? "an existing event"}.`);
    }
    if (signals.meetingIntent) {
        const subject = signals.topic ? ` about ${signals.topic}` : "";
        if (scheduled && signals.day && signals.time) {
            parts.push(`Sender asks to schedule a ${signals.meetingNoun.toLowerCase()}${subject} on ${signals.day.label} at ${signals.time}.`);
        }
        else if (signals.statedTimeHasPassed) {
            parts.push(`Sender proposes a ${signals.meetingNoun.toLowerCase()}${subject} on ${signals.day!.label} at ${signals.time}, which has already passed.`);
        }
        else if (signals.day) {
            parts.push(`Sender raises a ${signals.meetingNoun.toLowerCase()}${subject} on ${signals.day.label} but gives no specific time.`);
        }
        else {
            parts.push(`Sender raises a ${signals.meetingNoun.toLowerCase()}${subject} without giving a date or time.`);
        }
    }
    if (signals.taskIntent && signals.taskObject) {
        parts.push(`They also ask you to send ${signals.taskObject}.`);
    }
    if (signals.replyIntent) {
        const to = signals.recipient ? ` to ${signals.recipient}` : "";
        const what = signals.commitment ? `, confirming that you will ${signals.commitment}` : "";
        parts.push(`Sender asks you to send a reply${to}${what}.`);
    }
    if (signals.informational && !signals.meetingIntent && !signals.replyIntent) {
        const stripped = firstSentence(message).replace(/^(?:fyi|heads[- ]?up|please note)[,:\s-]*/i, "");
        parts.push(`Informational notice: ${stripped.charAt(0).toLowerCase()}${stripped.slice(1)}`);
    }
    if (parts.length === 0) {
        parts.push(firstSentence(message).slice(0, 240));
    }
    return parts.join(" ");
}
function missingMeetingDetails(signals: Signals): string[] {
    const missing: string[] = [];
    if (!signals.day)
        missing.push("a date");
    if (!signals.time)
        missing.push("a start time");
    return missing;
}
function calendarAction(signals: Signals, message: string): PlannerAction {
    const durationStated = signals.durationMinutes !== null;
    const notes: string[] = [];
    if (!durationStated) {
        notes.push("the message did not state a duration, so 30 minutes is a default");
    }
    if (signals.emails.length === 0) {
        notes.push("no attendee email address was given in the message");
    }
    if (signals.rolledForwardAWeek) {
        notes.push(`"${signals.day!.label}" at ${signals.time} has already passed today, so the following ${signals.day!.label} is proposed`);
    }
    const eventTitle = signals.topic
        ? `${signals.meetingNoun} — ${signals.topic.replace(/^(?:the|a|an)\s+/i, "")}`
        : signals.meetingNoun;
    return {
        type: "create_calendar_event",
        title: `Create calendar event: ${eventTitle}`,
        description: "Proposes a calendar event from these details. Approve it, then run a simulation; no calendar is changed.",
        confidence: durationStated ? 0.88 : 0.72,
        clarificationNeeded: notes.length > 0 ? `Confirm before executing: ${notes.join("; ")}.` : null,
        payload: {
            title: eventTitle,
            startTime: `${signals.resolvedDate!}T${signals.time}`,
            durationMinutes: signals.durationMinutes ?? 30,
            attendees: signals.emails,
            description: `Proposed from an incoming message: "${message.trim().slice(0, 200)}"`,
        },
    };
}
function replyAction(signals: Signals): PlannerAction {
    const name = signals.recipient ?? signals.fromName;
    const greeting = name ? `Hi ${name},` : "Hi,";
    const body = signals.commitment
        ? `Thanks for the note — I'll ${signals.commitment}.`
        : "Thanks for the note — I'll come back to you on this shortly.";
    const to = signals.fromEmail ? [signals.fromEmail] : signals.emails;
    const subject = signals.subject
        ? signals.subject.replace(/^(?:re:\s*)?/i, "Re: ")
        : signals.topic
            ? `Re: ${signals.topic}`
            : "Re: your message";
    const notes: string[] = [];
    if (!signals.commitment) {
        notes.push("the message did not state what the reply should say, so the wording is generic");
    }
    if (to.length === 0) {
        notes.push("no recipient address was available, so this can only be drafted in-thread");
    }
    return {
        type: "draft_reply",
        title: name ? `Draft reply to ${name}` : "Draft reply",
        description: "A draft only. Approving it creates a draft you still have to read and send yourself — nothing is ever sent automatically.",
        confidence: signals.commitment ? 0.82 : 0.6,
        clarificationNeeded: notes.length > 0 ? `Confirm before executing: ${notes.join("; ")}.` : null,
        payload: { to, subject, replyText: `${greeting}\n\n${body}\n\nBest regards,` },
    };
}
function rescheduleAction(signals: Signals, message: string): PlannerAction {
    const notes: string[] = [];
    notes.push("the existing event was identified by description only, so confirm it is the right one");
    if (signals.durationMinutes === null) {
        notes.push("no new duration was stated, so the existing length is kept");
    }
    return {
        type: "reschedule_calendar_event",
        title: `Reschedule: ${signals.eventRef ?? signals.meetingNoun}`,
        description: "Would move an existing calendar event. The event is matched by description at execution time, and execution refuses if more than one event matches.",
        confidence: 0.74,
        clarificationNeeded: `Confirm before executing: ${notes.join("; ")}.`,
        payload: {
            eventId: null,
            eventRef: signals.eventRef ?? signals.meetingNoun,
            newStartTime: `${signals.resolvedDate!}T${signals.time}`,
            newDurationMinutes: signals.durationMinutes,
            addAttendees: signals.emails,
            reason: `Requested in an incoming message: "${message.trim().slice(0, 160)}"`,
        },
    };
}
function taskAction(signals: Signals, deadline: string | null): PlannerAction {
    const object = signals.taskObject ?? "the item the sender asked for";
    return {
        type: "create_task",
        title: `Task: send ${object}`,
        description: "A piece of work the message asks you to do that is neither a meeting nor a reply.",
        confidence: signals.taskObject ? 0.8 : 0.55,
        clarificationNeeded: signals.taskObject
            ? null
            : "The message asks for something to be sent but does not say precisely what.",
        payload: {
            title: `Send ${object}`,
            notes: signals.fromName
                ? `Requested by ${signals.fromName}.`
                : "Requested in an incoming message.",
            dueDate: deadline,
        },
    };
}
function noAction(reason: string): PlannerAction {
    return {
        type: "no_action",
        title: "No action needed",
        description: "Recorded explicitly, so that proposing nothing is a decision rather than a gap.",
        confidence: 0.8,
        clarificationNeeded: null,
        payload: { reason },
    };
}
function clarificationAction(question: string, reason: string, missing: string[] = []): PlannerAction {
    return {
        type: "request_information",
        title: "Request missing information",
        description: reason,
        confidence: 0.7,
        clarificationNeeded: null,
        payload: { question, missing },
    };
}
function buildActions(message: string, signals: Signals, deadline: string | null): PlannerAction[] {
    const actions: PlannerAction[] = [];
    const isReschedule = signals.rescheduleIntent && (signals.eventRef !== null || signals.meetingIntent);
    if (signals.addAttendeeIntent && !isReschedule) {
        if (signals.emails.length === 0) {
            actions.push(clarificationAction(`To add those people to ${signals.eventRef ?? "the event"}, could you send their email addresses? The message gives names only.`, "Attendees can only be added by email address, and the message supplied names rather than addresses.", ["attendee email addresses"]));
        }
        else {
            actions.push(rescheduleAction(signals, message));
        }
    }
    else if (isReschedule) {
        if (signals.holdRequested) {
            actions.push(clarificationAction(`You asked that nothing be changed yet. Shall I go ahead and move ${signals.eventRef ?? "the meeting"}, and to exactly what time?`, "The sender asked that nothing be changed yet, so no reschedule is proposed.", ["explicit go-ahead", "exact new start time"]));
        }
        else if (signals.resolvedDate && signals.time) {
            actions.push(rescheduleAction(signals, message));
        }
        else {
            actions.push(clarificationAction(`To move ${signals.eventRef ?? "the meeting"}, could you confirm the exact new date and time?`, "The message asks to move an event but does not state an unambiguous new time.", ["exact new start time"]));
        }
    }
    else if (signals.meetingIntent) {
        if (signals.holdRequested) {
            const when = signals.day ? ` on ${signals.day.label}` : "";
            actions.push(clarificationAction(`You asked that the calendar not be changed yet. If you would like a meeting${when}, what exact start time and duration should be used, and shall I go ahead and book it?`, "The sender asked that nothing be changed yet, so no calendar event is proposed. This asks for the go-ahead and the missing details instead."));
        }
        else if (signals.statedTimeHasPassed) {
            actions.push(clarificationAction(`The ${signals.meetingNoun.toLowerCase()} you mention is for ${signals.day!.label} at ${signals.time}, which has already passed. What date and time should be used instead?`, "The date and time in the message are in the past, so no calendar event is proposed."));
        }
        else if (signals.resolvedDate && signals.time) {
            actions.push(calendarAction(signals, message));
        }
        else {
            const missing = missingMeetingDetails(signals);
            const when = signals.day ? ` on ${signals.day.label}` : "";
            actions.push(clarificationAction(`To set up the ${signals.meetingNoun.toLowerCase()}${when}, could you confirm ${missing.join(" and ")}${signals.durationMinutes === null ? " and how long it should be" : ""}?`, `The message does not state ${missing.join(" or ")}, so no calendar event is proposed.`));
        }
    }
    if (signals.taskIntent) {
        actions.push(taskAction(signals, deadline));
    }
    if (signals.replyIntent) {
        actions.push(replyAction(signals));
    }
    if (actions.length === 0) {
        actions.push(noAction(signals.informational
            ? "The message is informational and does not ask for anything to be done."
            : "Nothing in this message maps to a supported action. Review it by hand if that looks wrong."));
    }
    return actions;
}
export class MockActionPlanner implements ActionPlanner {
    readonly name = "mock-rules-v1";
    readonly isModel = false;
    async plan({ message, now, context }: PlanRequest): Promise<unknown> {
        const trimmed = message.trim();
        const signals = readSignals(trimmed, now, context);
        const deadline = detectDeadline(trimmed, now);
        const actions = buildActions(trimmed, signals, deadline);
        const injectionFindings = detectInjection(trimmed);
        const scheduled = actions.some((a) => a.type === "create_calendar_event" || a.type === "reschedule_calendar_event");
        const askedForInfo = actions.some((a) => a.type === "request_information");
        const needsClarification = askedForInfo || (signals.meetingIntent && !scheduled) || (signals.vagueTime && signals.meetingIntent);
        const clarificationReason = needsClarification
            ? signals.holdRequested
                ? "The sender asked that nothing be changed yet, and did not give an exact time."
                : signals.statedTimeHasPassed
                    ? "The date and time stated in the message have already passed."
                    : `The message does not state ${missingMeetingDetails(signals).join(" or ") || "enough detail"} for a meeting.`
            : null;
        const result: PlannerResult = {
            summary: buildSummary(trimmed, signals, scheduled),
            priority: detectPriority(trimmed, signals),
            deadline,
            suspectedInjection: injectionFindings.length > 0,
            injectionNote: describeInjection(injectionFindings),
            replyRequired: signals.informational
                ? false
                : signals.replyIntent || needsClarification || (signals.hasQuestion && !scheduled),
            needsClarification,
            clarificationReason,
            actions,
        };
        return result;
    }
}
export const isoToday = toIsoDate;
