"use client";
import { describeEvent, type AuditEvent } from "@/lib/audit/events";
import { formatClockTime } from "./labels";
const HEADLINES: Record<AuditEvent["type"], string> = {
    MESSAGE_ANALYSED: "Read a message",
    ACTION_PROPOSED: "Suggested something",
    ACTION_EDITED: "You made a change",
    ACTION_APPROVED: "You approved",
    ACTION_REJECTED: "You dismissed",
    EXECUTION_REQUESTED: "Started work",
    EXECUTION_REFUSED: "Refused to act",
    ACTION_EXECUTED: "Completed",
    EXECUTION_FAILED: "Failed",
    INJECTION_DETECTED: "Blocked a suspicious instruction",
};
export function ActivityPanel({ events }: {
    events: AuditEvent[];
}) {
    if (events.length === 0) {
        return <p className="text-ink-subtle p-5 text-sm">Nothing has happened yet.</p>;
    }
    return (<ol aria-label="Activity" className="divide-line divide-y">
      {events.map((event) => (<li key={event.id} className="px-5 py-3">
          <div className="flex items-baseline justify-between gap-3">
            <span className={`text-[13px] font-semibold ${event.type === "EXECUTION_REFUSED" || event.type === "INJECTION_DETECTED"
                ? "text-negative"
                : "text-ink"}`}>
              {HEADLINES[event.type]}
            </span>
            <time className="text-ink-subtle shrink-0 font-mono text-[11px]">
              {formatClockTime(event.at)}
            </time>
          </div>
          <p className="text-ink-muted mt-1 text-[13px] leading-relaxed break-words">
            {describeEvent(event)}
          </p>
        </li>))}
    </ol>);
}
