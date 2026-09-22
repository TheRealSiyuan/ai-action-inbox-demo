import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { analyseAndStore, approveAction, editAction, executeAction, rejectAction } from "@/lib/server/workflow";
import { eraseAllData, storageSummary, loadAction, saveAction, recentAuditEvents } from "@/lib/store/repository";
import { SampleInboxProvider } from "@/lib/inbox/sample-inbox";
import { resolveMode } from "@/lib/mode";
import { POST as analyseRoute } from "@/app/api/analyse/route";
import { PATCH as editRoute } from "@/app/api/actions/[id]/route";
import type { Action } from "@/lib/actions/types";

beforeEach(() => { eraseAllData(); vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Unexpected network call"); })); });
afterEach(() => vi.unstubAllGlobals());
const analysis = () => analyseAndStore({ inboxMessageId: "sample-workshop" });
const task = async () => (await analysis()).actions.find(a => a.type === "create_task")!;

describe("public demo workflow", () => {
  it("analyses every sample without network access or a real model", async () => {
    const inbox = new SampleInboxProvider();
    const messages = await inbox.list(100);
    expect(messages).toHaveLength(7);
    for (const m of messages) {
      expect(m.fromEmail).toMatch(/\.example\.com$/);
      const result = await analyseAndStore({ inboxMessageId: m.id });
      expect(result.source.kind).toBe("sample");
      expect(result.plannerIsModel).toBe(false);
      expect(result.actions.every(a => a.status === "PROPOSED")).toBe(true);
    }
    expect(storageSummary().messages).toBe(7);
    expect((await resolveMode()).execution.simulated).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("requires approval, simulates once, and records activity", async () => {
    const a = await task();
    await expect(executeAction(a.id)).rejects.toMatchObject({ reason: "NO_APPROVAL_RECORD" });
    approveAction(a.id);
    const result = await executeAction(a.id);
    expect(result.action.status).toBe("EXECUTED");
    expect(result.action.execution).toMatchObject({ simulated: true, externalUrl: null });
    await expect(executeAction(a.id)).rejects.toMatchObject({ reason: "NOT_APPROVED" });
    expect(recentAuditEvents().filter(e => e.type === "ACTION_EXECUTED")).toHaveLength(1);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("invalidates approval after a material edit", async () => {
    const a = await task();
    approveAction(a.id);
    const edited = editAction(a.id, { payload: { ...a.payload, title: "Revised sample agenda" } as Action["payload"] });
    expect(edited.action.status).toBe("PROPOSED");
    expect(edited.action.approval).toBeNull();
    await expect(executeAction(a.id)).rejects.toMatchObject({ reason: "NO_APPROVAL_RECORD" });
    approveAction(a.id);
    expect((await executeAction(a.id)).action.status).toBe("EXECUTED");
  });
  it("rejects a forged server-side approval", async () => {
    const a = approveAction((await task()).id).action;
    saveAction({ ...a, approval: { ...a.approval!, signature: "forged" } });
    await expect(executeAction(a.id)).rejects.toMatchObject({ reason: "BAD_SIGNATURE" });
  });
  it("refuses simultaneous duplicate execution", async () => {
    const a = await task(); approveAction(a.id);
    const outcomes = await Promise.allSettled([executeAction(a.id), executeAction(a.id)]);
    expect(outcomes.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect(recentAuditEvents().filter(e => e.type === "ACTION_EXECUTED")).toHaveLength(1);
  });
  it("preserves decisions when reopening a message and resets cleanly", async () => {
    const a = await task(); rejectAction(a.id);
    expect((await analysis()).actions.find(x => x.id === a.id)?.status).toBe("REJECTED");
    eraseAllData();
    expect(loadAction(a.id)).toBeNull();
    expect(storageSummary()).toEqual({ messages: 0, actions: 0, auditEvents: 0 });
    expect((await analysis()).actions.every(x => x.status === "PROPOSED")).toBe(true);
  });
  it("flags the synthetic injection without granting authority", async () => {
    const result = await analyseAndStore({ inboxMessageId: "sample-injection" });
    expect(result.suspectedInjection).toBe(true);
    expect(result.actions.every(a => a.approval === null)).toBe(true);
  });
  it("rejects pasted mail and unknown inbox ids at the API boundary", async () => {
    const response = await analyseRoute(new Request("http://localhost/api/analyse", { method: "POST", body: JSON.stringify({ message: "arbitrary input" }) }));
    expect(response.status).toBe(400);
    const missing = await analyseRoute(new Request("http://localhost/api/analyse", { method: "POST", body: JSON.stringify({ inboxMessageId: "missing" }) }));
    expect(missing.status).toBe(404);
  });
  it("rejects an edit that changes the action type", async () => {
    const a = await task();
    const response = await editRoute(new Request("http://localhost/api/actions/test", { method: "PATCH", body: JSON.stringify({ type: "draft_reply", payload: { to: [], subject: "Example", replyText: "Example" } }) }), { params: Promise.resolve({ id: a.id }) });
    expect(response.status).toBe(409);
    expect(loadAction(a.id)?.type).toBe("create_task");
  });
});
