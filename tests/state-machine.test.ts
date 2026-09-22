import { describe, expect, it } from "vitest";
import { ALLOWED_TRANSITIONS, canTransition, InvalidTransitionError, reject, transition, } from "@/lib/actions/state-machine";
import { approveForTest, makeAction } from "./helpers";
import { applyEdit, isMaterialEdit } from "@/lib/actions/materiality";
import { ACTION_STATUSES, type Action } from "@/lib/actions/types";
import { NOW } from "./fixtures";
const calendarAction = (): Action => makeAction({ type: "create_calendar_event" });
describe("action state machine", () => {
    it("moves PROPOSED to APPROVED", () => {
        expect(approveForTest(calendarAction()).status).toBe("APPROVED");
    });
    it("moves PROPOSED to REJECTED", () => {
        expect(reject(calendarAction()).status).toBe("REJECTED");
    });
    it("records when the status changed", () => {
        const later = new Date(NOW.getTime() + 60000);
        expect(approveForTest(calendarAction(), later).statusChangedAt).toBe(later.toISOString());
    });
    it("never mutates the action it was given", () => {
        const action = calendarAction();
        approveForTest(action);
        expect(action.status).toBe("PROPOSED");
    });
    it("refuses to execute a rejected action", () => {
        const rejected = reject(calendarAction());
        for (const target of ["EXECUTING", "EXECUTED", "APPROVED"] as const) {
            expect(canTransition(rejected.status, target)).toBe(false);
            expect(() => transition(rejected, target)).toThrow(InvalidTransitionError);
        }
    });
    it("cannot reach EXECUTING except from APPROVED", () => {
        const sources = Object.entries(ALLOWED_TRANSITIONS)
            .filter(([, targets]) => targets.includes("EXECUTING"))
            .map(([from]) => from);
        expect(sources).toEqual(["APPROVED"]);
    });
    it("cannot reach EXECUTED except from EXECUTING", () => {
        const sources = Object.entries(ALLOWED_TRANSITIONS)
            .filter(([, targets]) => targets.includes("EXECUTED"))
            .map(([from]) => from);
        expect(sources).toEqual(["EXECUTING"]);
    });
    it("makes a proposed action unable to jump straight to EXECUTED", () => {
        expect(canTransition("PROPOSED", "EXECUTED")).toBe(false);
        expect(canTransition("PROPOSED", "EXECUTING")).toBe(false);
    });
    it("declares every lifecycle status even though only two transitions are wired", () => {
        expect(ACTION_STATUSES).toEqual([
            "PROPOSED",
            "APPROVED",
            "REJECTED",
            "EXECUTING",
            "EXECUTED",
            "FAILED",
        ]);
    });
});
describe("editing and materiality", () => {
    it("treats a changed start time as material", () => {
        const before = calendarAction();
        const after = { ...before, payload: { ...before.payload, startTime: "2026-09-11T16:00" } };
        expect(isMaterialEdit(before, after)).toBe(true);
    });
    it("treats whitespace-only changes as cosmetic", () => {
        const before = calendarAction();
        const after = { ...before, payload: { ...before.payload, title: "  Catch-up  " } };
        expect(isMaterialEdit(before, after)).toBe(false);
    });
    it("destroys the approval record when a material edit lands", () => {
        const approved = approveForTest(calendarAction());
        expect(approved.approval).not.toBeNull();
        const outcome = applyEdit(approved, {
            payload: { ...approved.payload, durationMinutes: 120 },
        });
        expect(outcome.action.approval).toBeNull();
    });
    it("returns a materially edited APPROVED action to PROPOSED", () => {
        const approved = approveForTest(calendarAction());
        const outcome = applyEdit(approved, {
            payload: { ...approved.payload, startTime: "2026-09-11T16:00" },
        });
        expect(outcome.material).toBe(true);
        expect(outcome.approvalInvalidated).toBe(true);
        expect(outcome.action.status).toBe("PROPOSED");
        expect(outcome.action.edited).toBe(true);
    });
    it("leaves an approval intact after a cosmetic edit", () => {
        const approved = approveForTest(calendarAction());
        const outcome = applyEdit(approved, { description: "A clearer explanation for the reviewer." });
        expect(outcome.material).toBe(false);
        expect(outcome.approvalInvalidated).toBe(false);
        expect(outcome.action.status).toBe("APPROVED");
    });
    it("leaves a rejected action alone", () => {
        const rejected = reject(calendarAction());
        const outcome = applyEdit(rejected, {
            payload: { ...rejected.payload, startTime: "2026-09-11T16:00" },
        });
        expect(outcome.action).toBe(rejected);
        expect(outcome.action.status).toBe("REJECTED");
    });
});
