"use client";
import { useState } from "react";
import type { Action } from "@/lib/actions/types";
import type { ActionEdit } from "@/lib/actions/materiality";
import { isExecutableType } from "@/lib/execution/types";
import { ActionEditor } from "./ActionEditor";
import { Badge, Button, Note } from "./ui";
import { ACTION_TYPE_EFFECTS, ACTION_TYPE_LABELS, formatDate, formatDuration, formatLocalDateTime, STATUS_LABELS, STATUS_MEANINGS, STATUS_TONES, } from "./labels";
function Row({ label, children }: {
    label: string;
    children: React.ReactNode;
}) {
    return (<div className="flex gap-3 py-1.5">
      <dt className="text-ink-subtle w-28 shrink-0 text-[13px]">{label}</dt>
      <dd className="text-ink min-w-0 flex-1 text-[13px] break-words">{children}</dd>
    </div>);
}
function Absent({ children }: {
    children: React.ReactNode;
}) {
    return <span className="text-ink-subtle">{children}</span>;
}
function Details({ action }: {
    action: Action;
}) {
    const row = (label: string, value: React.ReactNode) => (<Row key={label} label={label}>
      {value}
    </Row>);
    const none = (text: string) => <Absent>{text}</Absent>;
    switch (action.type) {
        case "create_calendar_event":
            return (<dl className="divide-line divide-y">
          {row("What", action.payload.title)}
          {row("When", formatLocalDateTime(action.payload.startTime))}
          {row("How long", formatDuration(action.payload.durationMinutes))}
          {row("Who", action.payload.attendees.length > 0
                    ? action.payload.attendees.join(", ")
                    : none("Just you — no email addresses were in the message"))}
        </dl>);
        case "reschedule_calendar_event":
            return (<dl className="divide-line divide-y">
          {row("Meeting", action.payload.eventRef)}
          {row("Move to", formatLocalDateTime(action.payload.newStartTime))}
          {row("New length", action.payload.newDurationMinutes === null
                    ? none("Unchanged")
                    : formatDuration(action.payload.newDurationMinutes))}
          {action.payload.addAttendees.length > 0
                    ? row("Also invite", action.payload.addAttendees.join(", "))
                    : null}
        </dl>);
        case "draft_reply":
            return (<div className="space-y-3">
          <dl className="divide-line divide-y">
            {row("To", action.payload.to.length > 0 ? action.payload.to.join(", ") : none("Replies in the same email thread"))}
            {row("Subject", action.payload.subject)}
          </dl>
          <pre className="border-line bg-canvas text-ink overflow-x-auto rounded-lg border px-3.5 py-3 text-[13px] leading-relaxed whitespace-pre-wrap">
            {action.payload.replyText}
          </pre>
        </div>);
        case "create_task":
            return (<dl className="divide-line divide-y">
          {row("To-do", action.payload.title)}
          {row("By", action.payload.dueDate ? formatDate(action.payload.dueDate) : none("No date given"))}
          {action.payload.notes ? row("Notes", action.payload.notes) : null}
        </dl>);
        case "request_information":
            return (<div className="space-y-3">
          <p className="text-ink text-sm leading-relaxed">{action.payload.question}</p>
          {action.payload.missing.length > 0 ? (<p className="text-ink-subtle text-[13px]">
              Missing: {action.payload.missing.join(", ")}
            </p>) : null}
        </div>);
        case "no_action":
            return <p className="text-ink-muted text-sm leading-relaxed">{action.payload.reason}</p>;
    }
}
export function SuggestionCard({ action, busy, onApprove, onReject, onEdit, onExecute, }: {
    action: Action;
    busy: boolean;
    onApprove: () => void;
    onReject: () => void;
    onEdit: (edit: ActionEdit) => void;
    onExecute: () => void;
}) {
    const [isEditing, setIsEditing] = useState(false);
    const open = action.status === "PROPOSED" || action.status === "FAILED";
    const canExecute = action.status === "APPROVED" && isExecutableType(action.type);
    const editable = action.status !== "REJECTED" && action.status !== "EXECUTING" && action.status !== "EXECUTED";
    const dimmed = action.status === "REJECTED";
    return (<article data-testid={`action-${action.id}`} className={`border-line bg-surface rounded-xl border p-5 transition-opacity ${dimmed ? "opacity-55" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-ink text-[15px] font-semibold">
            {ACTION_TYPE_LABELS[action.type]}
          </h3>
          <p className="text-ink-subtle mt-0.5 text-[13px]">{ACTION_TYPE_EFFECTS[action.type]}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge tone={STATUS_TONES[action.status]}>{STATUS_LABELS[action.status]}</Badge>
          {action.edited ? (<span className="text-ink-subtle text-[11px]">You changed this</span>) : null}
        </div>
      </div>

      <div className="mt-4">
        {isEditing ? (<ActionEditor action={action} onCancel={() => setIsEditing(false)} onSave={(edit) => {
                onEdit(edit);
                setIsEditing(false);
            }}/>) : (<Details action={action}/>)}
      </div>

      {action.clarificationNeeded && !isEditing ? (<div className="mt-4">
          <Note tone="caution">
            <span className="font-semibold">Worth checking. </span>
            {action.clarificationNeeded}
          </Note>
        </div>) : null}

      {action.execution ? (<div data-testid={`execution-${action.id}`} className={`mt-4 rounded-lg border px-3.5 py-3 text-[13px] leading-relaxed ${action.execution.outcome === "EXECUTED"
                ? "border-positive/25 bg-positive-soft text-positive"
                : "border-negative/25 bg-negative-soft text-negative"}`}>
          {action.execution.detail}

        </div>) : null}

      {!isEditing ? (<div className="border-line mt-5 flex flex-wrap items-center gap-2 border-t pt-4">
          {open ? (<Button size="sm" variant="positive" onClick={onApprove} disabled={busy}>
              Approve
            </Button>) : null}

          {canExecute ? (<Button size="sm" variant="primary" onClick={onExecute} disabled={busy}>
              Simulate action
            </Button>) : null}

          
          {editable ? (<Button size="sm" onClick={() => setIsEditing(true)} disabled={busy}>
              Change
            </Button>) : null}

          {action.status !== "REJECTED" && action.status !== "EXECUTED" ? (<Button size="sm" variant="ghost" onClick={onReject} disabled={busy}>
              Dismiss
            </Button>) : null}

          {!open && !canExecute && !editable ? (<span className="text-ink-subtle text-[13px]">{STATUS_MEANINGS[action.status]}</span>) : null}

          {action.status === "APPROVED" && !isExecutableType(action.type) ? (<span className="text-ink-subtle text-[13px]">This one is for you to act on.</span>) : null}
        </div>) : null}
    </article>);
}
