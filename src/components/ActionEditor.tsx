"use client";
import { useState, type ReactNode } from "react";
import type { Action } from "@/lib/actions/types";
import type { ActionEdit } from "@/lib/actions/materiality";
import { ACTION_PAYLOAD_SCHEMAS } from "@/lib/schemas";
import { Button } from "./ui";
const inputClass = "border-line focus:border-accent w-full rounded-lg border px-3 py-2 text-sm outline-none";
function Labelled({ label, hint, children }: {
    label: string;
    hint?: string;
    children: ReactNode;
}) {
    return (<label className="block">
      <span className="text-ink-subtle text-[11px] font-semibold tracking-[0.08em] uppercase">
        {label}
      </span>
      {children}
      {hint ? <span className="text-ink-subtle mt-1 block text-xs">{hint}</span> : null}
    </label>);
}
type Draft = {
    title: string;
    eventTitle: string;
    startTime: string;
    durationMinutes: string;
    attendees: string;
    eventDescription: string;
    eventRef: string;
    newStartTime: string;
    newDurationMinutes: string;
    to: string;
    subject: string;
    replyText: string;
    notes: string;
    dueDate: string;
    question: string;
    reason: string;
};
function toDraft(action: Action): Draft {
    const base: Draft = {
        title: action.title,
        eventTitle: "",
        startTime: "",
        durationMinutes: "",
        attendees: "",
        eventDescription: "",
        eventRef: "",
        newStartTime: "",
        newDurationMinutes: "",
        to: "",
        subject: "",
        replyText: "",
        notes: "",
        dueDate: "",
        question: "",
        reason: "",
    };
    switch (action.type) {
        case "create_calendar_event":
            return {
                ...base,
                eventTitle: action.payload.title,
                startTime: action.payload.startTime,
                durationMinutes: String(action.payload.durationMinutes),
                attendees: action.payload.attendees.join(", "),
                eventDescription: action.payload.description,
            };
        case "reschedule_calendar_event":
            return {
                ...base,
                eventRef: action.payload.eventRef,
                newStartTime: action.payload.newStartTime,
                newDurationMinutes: action.payload.newDurationMinutes === null
                    ? ""
                    : String(action.payload.newDurationMinutes),
                attendees: action.payload.addAttendees.join(", "),
                eventDescription: action.payload.reason,
            };
        case "draft_reply":
            return {
                ...base,
                to: action.payload.to.join(", "),
                subject: action.payload.subject,
                replyText: action.payload.replyText,
            };
        case "create_task":
            return {
                ...base,
                eventTitle: action.payload.title,
                notes: action.payload.notes,
                dueDate: action.payload.dueDate ?? "",
            };
        case "request_information":
            return { ...base, question: action.payload.question };
        case "no_action":
            return { ...base, reason: action.payload.reason };
    }
}
const csv = (value: string) => value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
function toPayload(action: Action, draft: Draft): unknown {
    switch (action.type) {
        case "create_calendar_event":
            return {
                title: draft.eventTitle,
                startTime: draft.startTime,
                durationMinutes: Number(draft.durationMinutes),
                attendees: draft.attendees
                    .split(",")
                    .map((value) => value.trim())
                    .filter(Boolean),
                description: draft.eventDescription,
            };
        case "reschedule_calendar_event": {
            const original = action.payload;
            return {
                eventId: original.eventId,
                eventRef: draft.eventRef,
                newStartTime: draft.newStartTime,
                newDurationMinutes: draft.newDurationMinutes === "" ? null : Number(draft.newDurationMinutes),
                addAttendees: csv(draft.attendees),
                reason: draft.eventDescription,
            };
        }
        case "draft_reply":
            return { to: csv(draft.to), subject: draft.subject, replyText: draft.replyText };
        case "create_task":
            return {
                title: draft.eventTitle,
                notes: draft.notes,
                dueDate: draft.dueDate === "" ? null : draft.dueDate,
            };
        case "request_information":
            return { question: draft.question, missing: action.payload.missing };
        case "no_action":
            return { reason: draft.reason };
    }
}
export function ActionEditor({ action, onSave, onCancel, }: {
    action: Action;
    onSave: (edit: ActionEdit) => void;
    onCancel: () => void;
}) {
    const [draft, setDraft] = useState<Draft>(() => toDraft(action));
    const [errors, setErrors] = useState<string[]>([]);
    const set = <K extends keyof Draft>(key: K) => (value: string) => setDraft((current) => ({ ...current, [key]: value }));
    function handleSave() {
        const parsed = ACTION_PAYLOAD_SCHEMAS[action.type].safeParse(toPayload(action, draft));
        if (!parsed.success) {
            setErrors(parsed.error.issues.map((issue) => `${issue.path.join(".") || "value"}: ${issue.message}`));
            return;
        }
        if (draft.title.trim().length === 0) {
            setErrors(["title: cannot be empty"]);
            return;
        }
        setErrors([]);
        onSave({ title: draft.title.trim(), payload: parsed.data as ActionEdit["payload"] });
    }
    return (<div className="border-line bg-canvas space-y-4 rounded-lg border p-4">
      <Labelled label="Action title">
        <input className={`${inputClass} mt-1.5`} value={draft.title} onChange={(event) => set("title")(event.target.value)} aria-label="Action title"/>
      </Labelled>

      {action.type === "create_calendar_event" ? (<div className="grid gap-4 sm:grid-cols-2">
          <Labelled label="Event title">
            <input className={`${inputClass} mt-1.5`} value={draft.eventTitle} onChange={(event) => set("eventTitle")(event.target.value)} aria-label="Event title"/>
          </Labelled>
          <Labelled label="Start time">
            <input type="datetime-local" className={`${inputClass} mt-1.5`} value={draft.startTime} onChange={(event) => set("startTime")(event.target.value)} aria-label="Start time"/>
          </Labelled>
          <Labelled label="Duration (minutes)">
            <input type="number" min={1} className={`${inputClass} mt-1.5`} value={draft.durationMinutes} onChange={(event) => set("durationMinutes")(event.target.value)} aria-label="Duration (minutes)"/>
          </Labelled>
          <Labelled label="Attendees" hint="Comma separated. Leave empty if none were named.">
            <input className={`${inputClass} mt-1.5`} value={draft.attendees} onChange={(event) => set("attendees")(event.target.value)} aria-label="Attendees"/>
          </Labelled>
          <div className="sm:col-span-2">
            <Labelled label="Event description">
              <textarea rows={3} className={`${inputClass} mt-1.5 resize-y`} value={draft.eventDescription} onChange={(event) => set("eventDescription")(event.target.value)} aria-label="Event description"/>
            </Labelled>
          </div>
        </div>) : null}

      {action.type === "reschedule_calendar_event" ? (<div className="grid gap-4 sm:grid-cols-2">
          <Labelled label="Existing event" hint="How the message referred to it.">
            <input className={`${inputClass} mt-1.5`} value={draft.eventRef} onChange={(event) => set("eventRef")(event.target.value)} aria-label="Existing event"/>
          </Labelled>
          <Labelled label="New start time">
            <input type="datetime-local" className={`${inputClass} mt-1.5`} value={draft.newStartTime} onChange={(event) => set("newStartTime")(event.target.value)} aria-label="New start time"/>
          </Labelled>
          <Labelled label="New duration (minutes)" hint="Leave empty to keep the current length.">
            <input type="number" min={1} className={`${inputClass} mt-1.5`} value={draft.newDurationMinutes} onChange={(event) => set("newDurationMinutes")(event.target.value)} aria-label="New duration (minutes)"/>
          </Labelled>
          <Labelled label="Add attendees" hint="Email addresses only, comma separated.">
            <input className={`${inputClass} mt-1.5`} value={draft.attendees} onChange={(event) => set("attendees")(event.target.value)} aria-label="Add attendees"/>
          </Labelled>
        </div>) : null}

      {action.type === "create_task" ? (<div className="grid gap-4 sm:grid-cols-2">
          <Labelled label="Task title">
            <input className={`${inputClass} mt-1.5`} value={draft.eventTitle} onChange={(event) => set("eventTitle")(event.target.value)} aria-label="Task title"/>
          </Labelled>
          <Labelled label="Due date" hint="Only if the message stated one.">
            <input type="date" className={`${inputClass} mt-1.5`} value={draft.dueDate} onChange={(event) => set("dueDate")(event.target.value)} aria-label="Due date"/>
          </Labelled>
          <div className="sm:col-span-2">
            <Labelled label="Notes">
              <textarea rows={3} className={`${inputClass} mt-1.5 resize-y`} value={draft.notes} onChange={(event) => set("notes")(event.target.value)} aria-label="Notes"/>
            </Labelled>
          </div>
        </div>) : null}

      {action.type === "no_action" ? (<Labelled label="Reason">
          <textarea rows={2} className={`${inputClass} mt-1.5 resize-y`} value={draft.reason} onChange={(event) => set("reason")(event.target.value)} aria-label="Reason"/>
        </Labelled>) : null}

      {action.type === "draft_reply" ? (<div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Labelled label="To" hint="Email addresses only, comma separated.">
              <input className={`${inputClass} mt-1.5`} value={draft.to} onChange={(event) => set("to")(event.target.value)} aria-label="To"/>
            </Labelled>
            <Labelled label="Subject">
              <input className={`${inputClass} mt-1.5`} value={draft.subject} onChange={(event) => set("subject")(event.target.value)} aria-label="Subject"/>
            </Labelled>
          </div>
          <Labelled label="Reply text">
          <textarea rows={6} className={`${inputClass} mt-1.5 resize-y font-mono text-[13px]`} value={draft.replyText} onChange={(event) => set("replyText")(event.target.value)} aria-label="Reply text"/>
          </Labelled>
        </div>) : null}

      {action.type === "request_information" ? (<Labelled label="Question">
          <textarea rows={3} className={`${inputClass} mt-1.5 resize-y`} value={draft.question} onChange={(event) => set("question")(event.target.value)} aria-label="Question"/>
        </Labelled>) : null}

      {errors.length > 0 ? (<ul role="alert" className="text-negative space-y-1 text-[13px]">
          {errors.map((error) => (<li key={error}>{error}</li>))}
        </ul>) : null}

      <div className="flex gap-2">
        <Button size="sm" variant="primary" onClick={handleSave}>
          Save changes
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>);
}
