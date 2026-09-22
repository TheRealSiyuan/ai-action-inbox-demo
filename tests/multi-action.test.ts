import { describe, expect, it } from "vitest";
import { analyseMessage } from "@/lib/analyse";
import { MockActionPlanner } from "@/lib/planner";
import { toDomainResult, WireResultSchema } from "@/lib/planner/wire";
import { PlannerResultSchema } from "@/lib/schemas";
import { NOW } from "./fixtures";
const planner = new MockActionPlanner();
const WORKSHOP = `Hi Jordan — can we move our AI workshop to Friday at 3pm?

Priya should join too.

Could you also send over the revised agenda beforehand?`;
describe("one message, several actions", () => {
    it("separates the reschedule from the task", async () => {
        const analysis = await analyseMessage(WORKSHOP, planner, {
            now: NOW,
            context: { subject: "AI workshop timing", fromName: "Maya", fromEmail: "maya@x.example.com" },
        });
        const types = analysis.actions.map((action) => action.type);
        expect(types).toContain("reschedule_calendar_event");
        expect(types).toContain("create_task");
    });
    it("moves the existing workshop rather than creating a second one", async () => {
        const analysis = await analyseMessage(WORKSHOP, planner, { now: NOW });
        expect(analysis.actions.map((a) => a.type)).not.toContain("create_calendar_event");
        const reschedule = analysis.actions.find((a) => a.type === "reschedule_calendar_event");
        if (reschedule?.type !== "reschedule_calendar_event")
            throw new Error("unreachable");
        expect(reschedule.payload.newStartTime).toBe("2026-09-11T15:00");
        expect(reschedule.payload.eventRef).toMatch(/workshop/i);
        expect(reschedule.payload.eventId).toBeNull();
    });
    it("does not turn 'Priya should join too' into an email address", async () => {
        const analysis = await analyseMessage(WORKSHOP, planner, { now: NOW });
        expect(JSON.stringify(analysis)).not.toMatch(/priya@/i);
        const reschedule = analysis.actions.find((a) => a.type === "reschedule_calendar_event");
        if (reschedule?.type !== "reschedule_calendar_event")
            throw new Error("unreachable");
        expect(reschedule.payload.addAttendees).toEqual([]);
        expect(reschedule.clarificationNeeded).toBeTruthy();
    });
    it("captures the agenda request as a task with no invented deadline", async () => {
        const analysis = await analyseMessage(WORKSHOP, planner, { now: NOW });
        const task = analysis.actions.find((a) => a.type === "create_task");
        if (task?.type !== "create_task")
            throw new Error("unreachable");
        expect(task.payload.title).toMatch(/agenda/i);
        expect(task.payload.dueDate).toBeNull();
    });
    it("addresses a reply only from the real envelope sender", async () => {
        const withEnvelope = await analyseMessage("Can you reply and confirm?", planner, {
            now: NOW,
            context: { subject: "Contract", fromName: "Maya", fromEmail: "maya@x.example.com" },
        });
        const reply = withEnvelope.actions.find((a) => a.type === "draft_reply");
        if (reply?.type !== "draft_reply")
            throw new Error("unreachable");
        expect(reply.payload.to).toEqual(["maya@x.example.com"]);
        expect(reply.payload.subject).toBe("Re: Contract");
        const withoutEnvelope = await analyseMessage("Can you reply and confirm?", planner, { now: NOW });
        const bare = withoutEnvelope.actions.find((a) => a.type === "draft_reply");
        if (bare?.type !== "draft_reply")
            throw new Error("unreachable");
        expect(bare.payload.to).toEqual([]);
    });
    it("gives every action in a multi-action message its own id and status", async () => {
        const analysis = await analyseMessage(WORKSHOP, planner, { now: NOW });
        const ids = analysis.actions.map((a) => a.id);
        expect(new Set(ids).size).toBe(ids.length);
        expect(analysis.actions.every((a) => a.status === "PROPOSED")).toBe(true);
    });
});
describe("rescheduling without an unambiguous time", () => {
    it("asks instead of guessing", async () => {
        const analysis = await analyseMessage("Can we move the workshop to Friday?", planner, {
            now: NOW,
        });
        expect(analysis.actions.map((a) => a.type)).toEqual(["request_information"]);
        expect(analysis.needsClarification).toBe(true);
    });
    it("respects a hold instruction on a reschedule", async () => {
        const analysis = await analyseMessage("Don't change anything yet, but could we move the workshop to Friday at 3pm?", planner, { now: NOW });
        expect(analysis.actions.map((a) => a.type)).toEqual(["request_information"]);
    });
});
describe("model wire format mapping", () => {
    const wire = (overrides: Record<string, unknown> = {}) => WireResultSchema.parse({
        summary: "A meeting request.",
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
                title: "Create event",
                description: "Would create an event.",
                confidence: 0.9,
                clarificationNeeded: null,
                payload: {
                    title: "Catch-up",
                    startTime: "2026-09-11T15:00",
                    durationMinutes: 30,
                    attendees: [],
                    description: "",
                    eventId: null,
                    eventRef: null,
                    newStartTime: null,
                    newDurationMinutes: null,
                    addAttendees: null,
                    reason: null,
                    to: null,
                    subject: null,
                    replyText: null,
                    notes: null,
                    dueDate: null,
                    question: null,
                    missing: null,
                },
            },
        ],
        ...overrides,
    });
    it("maps a well-formed model response into valid domain output", () => {
        expect(PlannerResultSchema.safeParse(toDomainResult(wire())).success).toBe(true);
    });
    it("drops payload fields that do not belong to the declared type", () => {
        const mapped = toDomainResult(wire()) as {
            actions: Array<{
                payload: Record<string, unknown>;
            }>;
        };
        expect(Object.keys(mapped.actions[0].payload).sort()).toEqual([
            "attendees",
            "description",
            "durationMinutes",
            "startTime",
            "title",
        ]);
    });
    it("does not repair a missing start time into a plausible one", () => {
        const broken = wire();
        broken.actions[0].payload.startTime = null;
        const result = PlannerResultSchema.safeParse(toDomainResult(broken));
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues[0].message).toMatch(/ISO local datetime/);
        }
    });
    it("rejects a model that fills the wrong payload for its declared type", () => {
        const mismatched = wire();
        mismatched.actions[0].type = "draft_reply";
        expect(PlannerResultSchema.safeParse(toDomainResult(mismatched)).success).toBe(false);
    });
    describe("blank advisory prose is treated as absent, and nothing else is", () => {
        const blanked = () => {
            const w = wire();
            w.clarificationReason = "";
            w.injectionNote = "   ";
            w.actions[0].clarificationNeeded = "";
            return w;
        };
        it("accepts a plan whose only defect is blank advisory prose", () => {
            expect(PlannerResultSchema.safeParse(toDomainResult(blanked())).success).toBe(true);
        });
        it("normalises blank advisory prose to null rather than an empty string", () => {
            const mapped = toDomainResult(blanked()) as {
                clarificationReason: unknown;
                injectionNote: unknown;
                actions: Array<{
                    clarificationNeeded: unknown;
                }>;
            };
            expect(mapped.clarificationReason).toBeNull();
            expect(mapped.injectionNote).toBeNull();
            expect(mapped.actions[0].clarificationNeeded).toBeNull();
        });
        it("preserves advisory prose the model did supply, trimmed", () => {
            const w = wire();
            w.injectionNote = "  tried to self-approve  ";
            w.actions[0].clarificationNeeded = "No address for Priya.";
            const mapped = toDomainResult(w) as {
                injectionNote: unknown;
                actions: Array<{
                    clarificationNeeded: unknown;
                }>;
            };
            expect(mapped.injectionNote).toBe("tried to self-approve");
            expect(mapped.actions[0].clarificationNeeded).toBe("No address for Priya.");
        });
        it("falls back to the model's own title when it supplies no description", () => {
            const w = wire();
            w.actions[0].description = "";
            const mapped = toDomainResult(w) as {
                actions: Array<{
                    description: unknown;
                }>;
            };
            expect(mapped.actions[0].description).toBe("Create event");
            expect(PlannerResultSchema.safeParse(toDomainResult(w)).success).toBe(true);
        });
        it("treats a null description the same as a blank one", () => {
            const w = wire();
            w.actions[0].description = null;
            const mapped = toDomainResult(w) as {
                actions: Array<{
                    description: unknown;
                }>;
            };
            expect(mapped.actions[0].description).toBe("Create event");
        });
        it("still rejects a plan with no title and no description", () => {
            const w = wire();
            w.actions[0].title = "";
            w.actions[0].description = "";
            expect(PlannerResultSchema.safeParse(toDomainResult(w)).success).toBe(false);
        });
        it.each([
            ["startTime", (w: ReturnType<typeof wire>) => (w.actions[0].payload.startTime = "")],
            ["durationMinutes", (w: ReturnType<typeof wire>) => (w.actions[0].payload.durationMinutes = 0)],
            ["attendees", (w: ReturnType<typeof wire>) => (w.actions[0].payload.attendees = ["Priya"])],
        ])("still rejects a blank or fabricated %s", (_field, breakIt) => {
            const w = wire();
            breakIt(w);
            expect(PlannerResultSchema.safeParse(toDomainResult(w)).success).toBe(false);
        });
        it("still rejects a blank eventRef, which names the event to be moved", () => {
            const w = wire();
            w.actions[0].type = "reschedule_calendar_event";
            w.actions[0].payload.eventRef = "";
            w.actions[0].payload.newStartTime = "2026-09-11T15:00";
            expect(PlannerResultSchema.safeParse(toDomainResult(w)).success).toBe(false);
        });
        it("still rejects a blank replyText, which is the content of a reply", () => {
            const w = wire();
            w.actions[0].type = "draft_reply";
            w.actions[0].payload.subject = "Re: catch-up";
            w.actions[0].payload.replyText = "";
            expect(PlannerResultSchema.safeParse(toDomainResult(w)).success).toBe(false);
        });
        it("still rejects a blank question on request_information", () => {
            const w = wire();
            w.actions[0].type = "request_information";
            w.actions[0].payload.question = "";
            expect(PlannerResultSchema.safeParse(toDomainResult(w)).success).toBe(false);
        });
    });
    describe("a zero seconds component is trimmed, and nothing else is", () => {
        const withStart = (startTime: string) => {
            const w = wire();
            w.actions[0].payload.startTime = startTime;
            return toDomainResult(w);
        };
        const startOf = (mapped: unknown) => (mapped as {
            actions: Array<{
                payload: {
                    startTime: unknown;
                };
            }>;
        }).actions[0].payload
            .startTime;
        it("accepts a plan whose only defect is a zero seconds component", () => {
            const mapped = withStart("2026-09-11T15:00:00");
            expect(startOf(mapped)).toBe("2026-09-11T15:00");
            expect(PlannerResultSchema.safeParse(mapped).success).toBe(true);
        });
        it("applies the same trim to a reschedule's new start time", () => {
            const w = wire();
            w.actions[0].type = "reschedule_calendar_event";
            w.actions[0].payload.eventRef = "the Thursday sync";
            w.actions[0].payload.newStartTime = "2026-09-10T15:00:00";
            w.actions[0].payload.newDurationMinutes = 30;
            const mapped = toDomainResult(w) as {
                actions: Array<{
                    payload: {
                        newStartTime: unknown;
                    };
                }>;
            };
            expect(mapped.actions[0].payload.newStartTime).toBe("2026-09-10T15:00");
            expect(PlannerResultSchema.safeParse(mapped).success).toBe(true);
        });
        it("leaves a datetime that already has no seconds untouched", () => {
            expect(startOf(withStart("2026-09-11T15:00"))).toBe("2026-09-11T15:00");
        });
        it.each([
            ["a non-zero seconds component", "2026-09-11T15:00:30"],
            ["a UTC suffix", "2026-09-11T15:00:00Z"],
            ["an offset suffix", "2026-09-11T15:00:00+01:00"],
            ["fractional seconds", "2026-09-11T15:00:00.000"],
            ["a bare date", "2026-09-11"],
            ["prose", "next Thursday at 3pm"],
            ["nothing at all", ""],
        ])("passes %s through untouched, so the schema still rejects it", (_label, value) => {
            const mapped = withStart(value);
            expect(startOf(mapped)).toBe(value);
            expect(PlannerResultSchema.safeParse(mapped).success).toBe(false);
        });
        it("never invents a time for a model that supplied none", () => {
            const w = wire();
            w.actions[0].payload.startTime = null;
            const mapped = toDomainResult(w);
            expect(startOf(mapped)).toBe("");
            expect(PlannerResultSchema.safeParse(mapped).success).toBe(false);
        });
    });
});
