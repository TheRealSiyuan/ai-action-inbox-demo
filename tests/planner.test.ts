import { describe, expect, it } from "vitest";
import { MockActionPlanner } from "@/lib/planner";
import { PlannerResultSchema } from "@/lib/schemas";
import { EXECUTABLE_ACTION_TYPES } from "@/lib/execution/types";
import { DEMO_MESSAGES, NOW } from "./fixtures";
const planner = new MockActionPlanner();
async function plan(message: string) {
    return PlannerResultSchema.parse(await planner.plan({ message, now: NOW }));
}
describe("demo case 1 — clear meeting request", () => {
    it("proposes a create_calendar_event at the stated day and time", async () => {
        const result = await plan(DEMO_MESSAGES.clearMeeting);
        const [action, ...rest] = result.actions;
        expect(rest).toHaveLength(0);
        expect(action.type).toBe("create_calendar_event");
        if (action.type !== "create_calendar_event")
            throw new Error("unreachable");
        expect(action.payload.startTime).toBe("2026-09-11T15:00");
        expect(action.payload.durationMinutes).toBe(30);
        expect(action.payload.title).toMatch(/catch-up/i);
        expect(result.needsClarification).toBe(false);
    });
    it("does not invent attendees that the message never named", async () => {
        const result = await plan(DEMO_MESSAGES.clearMeeting);
        const action = result.actions[0];
        if (action.type !== "create_calendar_event")
            throw new Error("unreachable");
        expect(action.payload.attendees).toEqual([]);
        expect(action.clarificationNeeded).toMatch(/attendee/i);
    });
});
describe("demo case 2 — clear reply request", () => {
    it("proposes a draft_reply addressed to the named person", async () => {
        const result = await plan(DEMO_MESSAGES.clearReply);
        const action = result.actions[0];
        expect(result.actions).toHaveLength(1);
        expect(action.type).toBe("draft_reply");
        if (action.type !== "draft_reply")
            throw new Error("unreachable");
        expect(action.payload.replyText).toContain("Sarah");
        expect(action.payload.replyText).toMatch(/review the report tomorrow/i);
        expect(result.replyRequired).toBe(true);
    });
    it("does not propose a calendar event", async () => {
        const result = await plan(DEMO_MESSAGES.clearReply);
        expect(result.actions.map((a) => a.type)).not.toContain("create_calendar_event");
    });
});
describe("demo case 3 — vague meeting request", () => {
    it("invents no time and proposes no calendar event", async () => {
        const result = await plan(DEMO_MESSAGES.vagueMeeting);
        expect(result.actions.map((a) => a.type)).not.toContain("create_calendar_event");
        expect(JSON.stringify(result)).not.toMatch(/T\d{2}:\d{2}/);
    });
    it("flags that clarification is needed and asks for the missing time", async () => {
        const result = await plan(DEMO_MESSAGES.vagueMeeting);
        const action = result.actions[0];
        expect(result.needsClarification).toBe(true);
        expect(action.type).toBe("request_information");
        if (action.type !== "request_information")
            throw new Error("unreachable");
        expect(action.payload.question).toMatch(/time/i);
    });
});
describe("demo case 4 — informational message", () => {
    it("proposes exactly one explicit no_action and nothing executable", async () => {
        const result = await plan(DEMO_MESSAGES.informational);
        expect(result.actions.map((a) => a.type)).toEqual(["no_action"]);
        expect(result.actions.every((a) => !EXECUTABLE_ACTION_TYPES.includes(a.type))).toBe(true);
        expect(result.replyRequired).toBe(false);
        expect(result.priority).toBe("low");
    });
    it("summarises the notice without inventing follow-up work", async () => {
        const result = await plan(DEMO_MESSAGES.informational);
        expect(result.summary).toMatch(/informational/i);
        expect(result.summary).toMatch(/office will be closed/i);
    });
});
describe("demo case 5 — explicit hold instruction", () => {
    it("proposes nothing that would change a calendar", async () => {
        const result = await plan(DEMO_MESSAGES.holdRequested);
        expect(result.actions.map((a) => a.type)).toEqual(["request_information"]);
    });
    it("acknowledges the hold and asks for the go-ahead", async () => {
        const result = await plan(DEMO_MESSAGES.holdRequested);
        const action = result.actions[0];
        if (action.type !== "request_information")
            throw new Error("unreachable");
        expect(result.needsClarification).toBe(true);
        expect(result.summary).toMatch(/nothing be changed yet/i);
        expect(action.payload.question).toMatch(/calendar not be changed yet/i);
    });
    it("does not claim anything has already happened", async () => {
        const result = await plan(DEMO_MESSAGES.holdRequested);
        expect(JSON.stringify(result)).not.toMatch(/\b(booked|scheduled it|created|sent|added to your calendar)\b/i);
    });
});
describe("date and time extraction", () => {
    it("resolves a weekday to the next occurrence at or after now", async () => {
        const result = await plan("Can we book a call on Monday at 9am?");
        const action = result.actions[0];
        if (action.type !== "create_calendar_event")
            throw new Error("unreachable");
        expect(action.payload.startTime).toBe("2026-09-14T09:00");
    });
    it("treats an hour with no am/pm as missing rather than guessing", async () => {
        const result = await plan("Can we schedule a call on Friday at 3?");
        expect(result.actions.map((a) => a.type)).toEqual(["request_information"]);
    });
    it("only reads a deadline when the message uses deadline language", async () => {
        expect((await plan(DEMO_MESSAGES.clearReply)).deadline).toBeNull();
        expect((await plan("Please send me the deck by Friday.")).deadline).toBe("2026-09-11");
    });
    it("raises priority when the message says it is urgent", async () => {
        expect((await plan("URGENT: can you reply to Dan today?")).priority).toBe("urgent");
    });
});
describe("never proposing a meeting in the past", () => {
    const FRIDAY_EVENING = new Date(2026, 8, 11, 18, 0, 0);
    async function planAt(message: string, now: Date) {
        return PlannerResultSchema.parse(await planner.plan({ message, now }));
    }
    it("rolls a bare weekday forward when that time has already passed today", async () => {
        const result = await planAt(DEMO_MESSAGES.clearMeeting, FRIDAY_EVENING);
        const action = result.actions[0];
        if (action.type !== "create_calendar_event")
            throw new Error("unreachable");
        expect(action.payload.startTime).toBe("2026-09-18T15:00");
    });
    it("asks about a contradiction rather than moving an explicit 'today'", async () => {
        const result = await planAt("Can we do a 30-minute call today at 3pm?", FRIDAY_EVENING);
        expect(result.actions.map((a) => a.type)).toEqual(["request_information"]);
        expect(result.needsClarification).toBe(true);
        expect(result.summary).toMatch(/already passed/i);
    });
});
describe("inferences are visible to the reviewer", () => {
    it("says so on the card when a weekday was rolled forward", async () => {
        const result = PlannerResultSchema.parse(await planner.plan({ message: DEMO_MESSAGES.clearMeeting, now: new Date(2026, 8, 11, 18, 0) }));
        expect(result.actions[0].clarificationNeeded).toMatch(/already passed today/i);
    });
    it("says so when the duration was defaulted rather than stated", async () => {
        const result = await plan("Can we book a call on Monday at 9am?");
        expect(result.actions[0].clarificationNeeded).toMatch(/did not state a duration/i);
        expect(result.actions[0].confidence).toBeLessThan(0.8);
    });
});
