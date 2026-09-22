import { describe, expect, it } from "vitest";
import { PlannerResultSchema } from "@/lib/schemas";
import { analyseMessage, PlannerOutputError } from "@/lib/analyse";
import type { ActionPlanner } from "@/lib/planner";
import { NOW } from "./fixtures";
function stubPlanner(output: unknown): ActionPlanner {
    return { name: "stub", isModel: false, plan: async () => output };
}
const validResult = {
    summary: "Sender asks to schedule a catch-up.",
    priority: "medium",
    deadline: null,
    replyRequired: false,
    needsClarification: false,
    clarificationReason: null,
    suspectedInjection: false,
    injectionNote: null,
    actions: [
        {
            type: "create_calendar_event",
            title: "Create calendar event: Catch-up",
            description: "Proposes a 30-minute event.",
            confidence: 0.9,
            clarificationNeeded: null,
            payload: {
                title: "Catch-up",
                startTime: "2026-09-11T15:00",
                durationMinutes: 30,
                attendees: [],
                description: "",
            },
        },
    ],
};
describe("runtime schema validation", () => {
    it("accepts well-formed planner output", () => {
        expect(PlannerResultSchema.safeParse(validResult).success).toBe(true);
    });
    it.each([
        ["an unknown action type", { ...validResult, actions: [{ ...validResult.actions[0], type: "delete_all_files" }] }],
        ["an invalid priority", { ...validResult, priority: "catastrophic" }],
        ["a missing summary", { ...validResult, summary: "" }],
        ["a confidence outside 0..1", { ...validResult, actions: [{ ...validResult.actions[0], confidence: 4 }] }],
        ["a malformed startTime", {
                ...validResult,
                actions: [{ ...validResult.actions[0], payload: { ...validResult.actions[0].payload, startTime: "next Friday-ish" } }],
            }],
        ["a negative duration", {
                ...validResult,
                actions: [{ ...validResult.actions[0], payload: { ...validResult.actions[0].payload, durationMinutes: -30 } }],
            }],
        ["a payload that does not match the action type", {
                ...validResult,
                actions: [{ ...validResult.actions[0], type: "draft_reply" }],
            }],
        ["an attendee that is not an email address", {
                ...validResult,
                actions: [{
                        ...validResult.actions[0],
                        payload: { ...validResult.actions[0].payload, attendees: ["Priya"] },
                    }],
            }],
        ["output that is not an object at all", "here is your meeting!"],
    ])("rejects %s", (_label, output) => {
        expect(PlannerResultSchema.safeParse(output).success).toBe(false);
    });
    it("does not let malformed planner output reach application state", async () => {
        const promise = analyseMessage("anything", stubPlanner({ ...validResult, priority: "catastrophic" }), { now: NOW });
        await expect(promise).rejects.toBeInstanceOf(PlannerOutputError);
        await expect(promise).rejects.toMatchObject({
            issues: expect.arrayContaining([expect.stringContaining("priority")]),
        });
    });
});
describe("rejection diagnostics", () => {
    const rejectionsFor = async (output: unknown) => {
        try {
            await analyseMessage("anything", stubPlanner(output), { now: NOW });
        }
        catch (error) {
            if (error instanceof PlannerOutputError)
                return error.rejections;
            throw error;
        }
        throw new Error("expected planner output to be rejected");
    };
    it("records the value that was rejected, alongside the path and the reason", async () => {
        const rejections = await rejectionsFor({ ...validResult, priority: "catastrophic" });
        expect(rejections).toContainEqual(expect.objectContaining({ path: "priority", value: '"catastrophic"' }));
    });
    it("reaches values nested inside actions and payloads", async () => {
        const rejections = await rejectionsFor({
            ...validResult,
            actions: [
                {
                    ...validResult.actions[0],
                    payload: { ...validResult.actions[0].payload, startTime: "next Friday-ish" },
                },
            ],
        });
        const startTime = rejections.find((r) => r.path === "actions.0.payload.startTime");
        expect(startTime?.value).toBe('"next Friday-ish"');
        expect(startTime?.message).toBeTruthy();
    });
    it("reports a missing field as absent rather than as undefined", async () => {
        const withoutSummary: Record<string, unknown> = { ...validResult };
        delete withoutSummary.summary;
        const rejections = await rejectionsFor(withoutSummary);
        expect(rejections.find((r) => r.path === "summary")?.value).toBe("(absent)");
    });
    it("truncates long values so a rejection is a diagnostic, not a data dump", async () => {
        const rejections = await rejectionsFor({ ...validResult, priority: "x".repeat(500) });
        const priority = rejections.find((r) => r.path === "priority");
        expect(priority?.value.length).toBeLessThanOrEqual(121);
        expect(priority?.value.endsWith("…")).toBe(true);
    });
    it("survives a root-level rejection where the output is not an object", async () => {
        const rejections = await rejectionsFor("here is your meeting!");
        expect(rejections.length).toBeGreaterThan(0);
        expect(rejections[0].path).toBe("(root)");
        expect(rejections[0].value).toBe('"here is your meeting!"');
    });
    it("keeps rejected values off `issues`, which is what the API returns", async () => {
        const output = {
            ...validResult,
            actions: [
                {
                    ...validResult.actions[0],
                    payload: {
                        ...validResult.actions[0].payload,
                        attendees: ["priya-home-address@example.com"],
                        startTime: "not a time",
                    },
                },
            ],
        };
        try {
            await analyseMessage("anything", stubPlanner(output), { now: NOW });
            throw new Error("expected planner output to be rejected");
        }
        catch (error) {
            if (!(error instanceof PlannerOutputError))
                throw error;
            expect(error.rejections.some((r) => r.value.includes("not a time"))).toBe(true);
            expect(error.issues.join(" ")).not.toContain("not a time");
            expect(error.issues.join(" ")).not.toContain("priya-home-address");
        }
    });
});
describe("impossible dates and times", () => {
    const withStartTime = (startTime: string) => ({
        ...validResult,
        actions: [{
                ...validResult.actions[0],
                payload: { ...validResult.actions[0].payload, startTime },
            }],
    });
    it.each([
        ["30 February", "2026-02-30T15:00"],
        ["31 April", "2026-04-31T09:00"],
        ["29 February in a non-leap year", "2027-02-29T10:00"],
        ["month 13", "2026-13-01T10:00"],
        ["day 00", "2026-09-00T10:00"],
        ["month 00", "2026-00-11T10:00"],
        ["hour 25", "2026-09-11T25:00"],
        ["minute 60", "2026-09-11T15:60"],
        ["hour 99 and minute 99", "2026-13-45T99:99"],
    ])("rejects a startTime naming %s", (_label, startTime) => {
        expect(PlannerResultSchema.safeParse(withStartTime(startTime)).success).toBe(false);
    });
    it.each([
        ["a real leap day", "2028-02-29T10:00"],
        ["the last day of a 31-day month", "2026-01-31T23:59"],
        ["the last day of a 30-day month", "2026-04-30T00:00"],
        ["midnight", "2026-09-11T00:00"],
        ["one minute to midnight", "2026-09-11T23:59"],
    ])("still accepts a startTime naming %s", (_label, startTime) => {
        expect(PlannerResultSchema.safeParse(withStartTime(startTime)).success).toBe(true);
    });
    it("rejects an impossible top-level deadline", () => {
        expect(PlannerResultSchema.safeParse({ ...validResult, deadline: "2026-02-30" }).success).toBe(false);
    });
    it("still accepts a real top-level deadline", () => {
        expect(PlannerResultSchema.safeParse({ ...validResult, deadline: "2026-09-11" }).success).toBe(true);
    });
    it("rejects an impossible dueDate on a task", () => {
        const task = {
            ...validResult,
            actions: [{
                    ...validResult.actions[0],
                    type: "create_task",
                    payload: { title: "Send the deck", notes: "", dueDate: "2026-04-31" },
                }],
        };
        expect(PlannerResultSchema.safeParse(task).success).toBe(false);
    });
    it("rejects an impossible newStartTime on a reschedule", () => {
        const reschedule = {
            ...validResult,
            actions: [{
                    ...validResult.actions[0],
                    type: "reschedule_calendar_event",
                    payload: {
                        eventId: null,
                        eventRef: "Friday's workshop",
                        newStartTime: "2026-02-30T15:00",
                        newDurationMinutes: 60,
                        addAttendees: [],
                        reason: "Sender asked to move it.",
                    },
                }],
        };
        expect(PlannerResultSchema.safeParse(reschedule).success).toBe(false);
    });
    it("names the rejected value so a reviewer can see what was wrong", async () => {
        const rejections = await (async () => {
            try {
                await analyseMessage("anything", stubPlanner(withStartTime("2026-02-30T15:00")), { now: NOW });
            }
            catch (error) {
                if (error instanceof PlannerOutputError)
                    return error.rejections;
                throw error;
            }
            throw new Error("expected planner output to be rejected");
        })();
        expect(rejections).toContainEqual(expect.objectContaining({ path: "actions.0.payload.startTime", value: '"2026-02-30T15:00"' }));
    });
});
