import type { ActionStatus } from "@/lib/actions/types";
import type { ActionType, PriorityLevel } from "@/lib/schemas";
export const ACTION_TYPE_LABELS: Record<ActionType, string> = {
    create_calendar_event: "Add to calendar",
    reschedule_calendar_event: "Move a meeting",
    draft_reply: "Draft a reply",
    create_task: "Add a to-do",
    request_information: "Ask for more detail",
    no_action: "Nothing to do",
};
export const ACTION_TYPE_EFFECTS: Record<ActionType, string> = {
    create_calendar_event: "Simulates creating a calendar event",
    reschedule_calendar_event: "Simulates moving a calendar event",
    draft_reply: "Simulates a draft — never sends it",
    create_task: "Simulates saving a to-do",
    request_information: "Nothing happens automatically — this is a note for you",
    no_action: "Nothing happens",
};
export const STATUS_LABELS: Record<ActionStatus, string> = {
    PROPOSED: "Suggested",
    APPROVED: "Approved",
    REJECTED: "Dismissed",
    EXECUTING: "Working…",
    EXECUTED: "Simulated",
    FAILED: "Didn't work",
};
export const STATUS_TONES: Record<ActionStatus, "neutral" | "accent" | "positive" | "negative" | "caution"> = {
    PROPOSED: "accent",
    APPROVED: "caution",
    REJECTED: "neutral",
    EXECUTING: "caution",
    EXECUTED: "positive",
    FAILED: "negative",
};
export const STATUS_MEANINGS: Record<ActionStatus, string> = {
    PROPOSED: "Waiting for you",
    APPROVED: "You approved this. Nothing has happened yet.",
    REJECTED: "You dismissed this",
    EXECUTING: "Doing it now",
    EXECUTED: "Finished",
    FAILED: "Something went wrong — you can try again",
};
export const PRIORITY_LABELS: Record<PriorityLevel, string> = {
    low: "Low",
    medium: "Normal",
    high: "Important",
    urgent: "Urgent",
};
export const PRIORITY_TONES: Record<PriorityLevel, "neutral" | "accent" | "caution" | "negative"> = {
    low: "neutral",
    medium: "neutral",
    high: "caution",
    urgent: "negative",
};
export function formatLocalDateTime(value: string): string {
    const [date, time] = value.split("T");
    return `${formatDate(date)}, ${formatTime(time)}`;
}
export function formatTime(time: string): string {
    const [hours, minutes] = time.split(":").map(Number);
    const suffix = hours < 12 ? "am" : "pm";
    const hour = hours % 12 === 0 ? 12 : hours % 12;
    return minutes === 0 ? `${hour}${suffix}` : `${hour}:${String(minutes).padStart(2, "0")}${suffix}`;
}
export function formatDate(value: string): string {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day).toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
    });
}
export function formatDuration(minutes: number): string {
    if (minutes < 60)
        return `${minutes} minutes`;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    const hourLabel = hours === 1 ? "1 hour" : `${hours} hours`;
    return rest === 0 ? hourLabel : `${hourLabel} ${rest} min`;
}
export function formatClockTime(iso: string): string {
    return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}
export function formatRelative(iso: string, now: Date = new Date()): string {
    const seconds = Math.round((now.getTime() - new Date(iso).getTime()) / 1000);
    if (seconds < 90)
        return "just now";
    const minutes = Math.round(seconds / 60);
    if (minutes < 60)
        return `${minutes} min ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24)
        return `${hours} hr ago`;
    return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
