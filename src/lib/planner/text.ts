const WEEKDAYS = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
] as const;
export type ExtractedDay = {
    date: string;
    label: string;
    kind: "weekday" | "relative" | "explicit";
};
const pad = (n: number) => String(n).padStart(2, "0");
export function toIsoDate(d: Date): string {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function addDays(d: Date, days: number): Date {
    const next = new Date(d);
    next.setDate(next.getDate() + days);
    return next;
}
function resolveWeekday(now: Date, weekday: number): Date {
    const delta = (weekday - now.getDay() + 7) % 7;
    return addDays(now, delta);
}
export function extractDay(message: string, now: Date): ExtractedDay | null {
    const lower = message.toLowerCase();
    const explicitDate = lower.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
    if (explicitDate) {
        return { date: explicitDate[0], label: explicitDate[0], kind: "explicit" };
    }
    if (/\btomorrow\b/.test(lower)) {
        return { date: toIsoDate(addDays(now, 1)), label: "tomorrow", kind: "relative" };
    }
    if (/\btoday\b/.test(lower)) {
        return { date: toIsoDate(now), label: "today", kind: "relative" };
    }
    for (let i = 0; i < WEEKDAYS.length; i += 1) {
        const name = WEEKDAYS[i];
        if (new RegExp(`\\b${name}\\b`).test(lower)) {
            return {
                date: toIsoDate(resolveWeekday(now, i)),
                label: name.charAt(0).toUpperCase() + name.slice(1),
                kind: "weekday",
            };
        }
    }
    return null;
}
export function extractTime(message: string): string | null {
    const lower = message.toLowerCase();
    if (/\bnoon\b|\bmidday\b/.test(lower))
        return "12:00";
    if (/\bmidnight\b/.test(lower))
        return "00:00";
    const meridiem = lower.match(/\b(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)/);
    if (meridiem) {
        let hour = Number(meridiem[1]);
        const minute = meridiem[2] ? Number(meridiem[2]) : 0;
        const isPm = meridiem[3].startsWith("p");
        if (hour >= 1 && hour <= 12 && minute < 60) {
            if (hour === 12)
                hour = 0;
            return `${pad(isPm ? hour + 12 : hour)}:${pad(minute)}`;
        }
    }
    const twentyFour = lower.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
    if (twentyFour) {
        return `${pad(Number(twentyFour[1]))}:${twentyFour[2]}`;
    }
    return null;
}
export function hasVagueTimeReference(message: string): boolean {
    return /\b(sometime|some time|afternoon|morning|evening|later|soon|at some point|whenever)\b/i.test(message);
}
export function extractDurationMinutes(message: string): number | null {
    const lower = message.toLowerCase();
    if (/\bhalf an hour\b/.test(lower))
        return 30;
    if (/\b(an|one|1)[- ]hour\b|\bhour[- ]long\b/.test(lower))
        return 60;
    const minutes = lower.match(/\b(\d{1,3})\s*[- ]?\s*(minutes?|mins?)\b/);
    if (minutes) {
        const value = Number(minutes[1]);
        if (value > 0 && value <= 24 * 60)
            return value;
    }
    const hours = lower.match(/\b(\d{1,2})(?:\.5)?\s*[- ]?\s*(hours?|hrs?)\b/);
    if (hours) {
        const value = Number(hours[1]);
        if (value > 0 && value <= 24)
            return value * 60;
    }
    return null;
}
export function extractTopic(message: string): string | null {
    const match = message.match(/\b(?:to discuss|about|regarding|re:|on the subject of)\s+([^.,?!;\n]{3,60})/i);
    if (!match)
        return null;
    return match[1].trim().replace(/\s+/g, " ");
}
export function extractReplyRecipient(message: string): string | null {
    const match = message.match(/\b(?:reply|respond|write back|get back)\s+to\s+([A-Z][a-zA-Z'-]{1,30})/);
    return match ? match[1] : null;
}
export function extractEmails(message: string): string[] {
    return message.match(/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g) ?? [];
}
export function isInPast(date: string, time: string, now: Date): boolean {
    const [year, month, day] = date.split("-").map(Number);
    const [hour, minute] = time.split(":").map(Number);
    return new Date(year, month - 1, day, hour, minute).getTime() < now.getTime();
}
export function nextWeek(date: string): string {
    const [year, month, day] = date.split("-").map(Number);
    return toIsoDate(addDays(new Date(year, month - 1, day), 7));
}
