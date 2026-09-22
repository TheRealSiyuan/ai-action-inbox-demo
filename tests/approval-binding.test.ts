import { describe, expect, it } from "vitest";
import { buildApproval, hmacSigner, verifyApproval } from "@/lib/actions/approval-token";
import { materialFingerprint, applyEdit } from "@/lib/actions/materiality";
import { approveWith } from "@/lib/actions/state-machine";
import type { Action } from "@/lib/actions/types";
import { ACTION_TYPES } from "@/lib/schemas";
import { NOW } from "./fixtures";
import { approveForTest, makeAction } from "./helpers";
const AT = NOW.toISOString();
describe("approval binds to the payload the human reviewed", () => {
    it("issues a signature this server can verify", () => {
        const action = makeAction({ type: "create_calendar_event" });
        const approval = buildApproval(action, AT, "test-operator");
        expect(verifyApproval(action, approval)).toEqual({ valid: true });
    });
    it("rejects an approval whose signature was not issued here", () => {
        const action = makeAction({ type: "create_calendar_event" });
        const forged = {
            fingerprint: materialFingerprint(action),
            signature: "0".repeat(64),
            approvedAt: AT,
            approvedBy: "attacker",
        };
        expect(verifyApproval(action, forged)).toEqual({ valid: false, reason: "BAD_SIGNATURE" });
    });
    it("rejects a genuine approval presented for a different payload", () => {
        const approved = approveForTest(makeAction({ type: "create_calendar_event" }));
        const tampered = {
            ...approved,
            payload: { ...approved.payload, durationMinutes: 120 },
        } as Action;
        expect(verifyApproval(tampered, approved.approval!)).toEqual({
            valid: false,
            reason: "FINGERPRINT_MISMATCH",
        });
    });
    it("refuses to attach an approval that describes something else", () => {
        const a = makeAction({ type: "create_calendar_event", id: "act_1" });
        const b = makeAction({
            type: "create_calendar_event",
            id: "act_2",
            payload: { ...a.payload, durationMinutes: 90 },
        } as Partial<Action> & {
            type: "create_calendar_event";
        });
        expect(() => approveWith(b, buildApproval(a, AT, "op"))).toThrow(/payload changed/i);
    });
    it("survives a signer that produces a different-length signature", () => {
        const action = makeAction({ type: "create_calendar_event" });
        const approval = buildApproval(action, AT, "op", () => "short");
        expect(verifyApproval(action, approval, hmacSigner).valid).toBe(false);
    });
});
describe("every payload field is covered by the fingerprint", () => {
    const mutations: Record<string, Array<[
        string,
        (p: never) => unknown
    ]>> = {
        create_calendar_event: [
            ["title", (p: never) => ({ ...(p as object), title: "Different" })],
            ["startTime", (p: never) => ({ ...(p as object), startTime: "2026-09-12T09:00" })],
            ["durationMinutes", (p: never) => ({ ...(p as object), durationMinutes: 120 })],
            ["attendees", (p: never) => ({ ...(p as object), attendees: ["a@example.com"] })],
            ["description", (p: never) => ({ ...(p as object), description: "Different" })],
        ],
        reschedule_calendar_event: [
            ["eventId", (p: never) => ({ ...(p as object), eventId: "evt_123" })],
            ["eventRef", (p: never) => ({ ...(p as object), eventRef: "Another meeting" })],
            ["newStartTime", (p: never) => ({ ...(p as object), newStartTime: "2026-09-12T09:00" })],
            ["newDurationMinutes", (p: never) => ({ ...(p as object), newDurationMinutes: 120 })],
            ["addAttendees", (p: never) => ({ ...(p as object), addAttendees: ["a@example.com"] })],
            ["reason", (p: never) => ({ ...(p as object), reason: "Different" })],
        ],
        draft_reply: [
            ["to", (p: never) => ({ ...(p as object), to: ["someone@example.org"] })],
            ["subject", (p: never) => ({ ...(p as object), subject: "Different" })],
            ["replyText", (p: never) => ({ ...(p as object), replyText: "Different text" })],
        ],
        create_task: [
            ["title", (p: never) => ({ ...(p as object), title: "Different" })],
            ["notes", (p: never) => ({ ...(p as object), notes: "Different" })],
            ["dueDate", (p: never) => ({ ...(p as object), dueDate: "2026-10-01" })],
        ],
        request_information: [
            ["question", (p: never) => ({ ...(p as object), question: "Different?" })],
            ["missing", (p: never) => ({ ...(p as object), missing: ["something else"] })],
        ],
        no_action: [["reason", (p: never) => ({ ...(p as object), reason: "Different" })]],
    };
    it("covers every declared action type", () => {
        expect(Object.keys(mutations).sort()).toEqual([...ACTION_TYPES].sort());
    });
    for (const [type, cases] of Object.entries(mutations)) {
        for (const [field, mutate] of cases) {
            it(`${type}: changing ${field} changes the fingerprint`, () => {
                const action = makeAction({ type } as Partial<Action> & {
                    type: never;
                });
                const before = materialFingerprint(action);
                const after = materialFingerprint({
                    ...action,
                    payload: mutate(action.payload as never),
                } as Action);
                expect(after).not.toBe(before);
            });
        }
    }
    it("ignores cosmetic changes to the reviewer-facing description", () => {
        const action = makeAction({ type: "create_calendar_event" });
        const before = materialFingerprint(action);
        const reworded = { ...action, description: "Reworded for the reviewer." };
        expect(materialFingerprint(reworded)).toBe(before);
    });
});
describe("the demo case: approve 30 minutes, edit to 2 hours", () => {
    it("invalidates the approval immediately and drops the token", () => {
        const approved = approveForTest(makeAction({ type: "create_calendar_event" }));
        expect(approved.status).toBe("APPROVED");
        const outcome = applyEdit(approved, {
            payload: { ...approved.payload, durationMinutes: 120 },
        });
        expect(outcome.approvalInvalidated).toBe(true);
        expect(outcome.action.status).toBe("PROPOSED");
        expect(outcome.action.approval).toBeNull();
    });
});
