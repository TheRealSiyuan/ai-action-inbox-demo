import { PlannerResultSchema } from "@/lib/schemas";
import type { ActionPlanner, PlanRequest } from "@/lib/planner/types";
import type { Action, MessageAnalysis, MessageSource } from "@/lib/actions/types";
import { describeRejections, type RejectedValue } from "@/lib/rejections";
export type { RejectedValue };
export class PlannerOutputError extends Error {
    constructor(message: string, readonly issues: string[], readonly rejections: RejectedValue[] = []) {
        super(message);
        this.name = "PlannerOutputError";
    }
}
export type AnalyseOptions = {
    now?: Date;
    source?: MessageSource;
    context?: PlanRequest["context"];
    makeId?: (index: number) => string;
};
export const MANUAL_SOURCE: MessageSource = {
    kind: "manual",
    label: "Pasted by hand",
    externalId: null,
    from: null,
    subject: null,
    receivedAt: null,
};
export async function analyseMessage(message: string, planner: ActionPlanner, options: AnalyseOptions = {}): Promise<MessageAnalysis> {
    const now = options.now ?? new Date();
    const makeId = options.makeId ?? ((index: number) => `act_${index + 1}`);
    const raw = await planner.plan({ message, now, context: options.context });
    const parsed = PlannerResultSchema.safeParse(raw);
    if (!parsed.success) {
        throw new PlannerOutputError("Planner output failed schema validation and was discarded.", parsed.error.issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`), describeRejections(parsed.error.issues, raw));
    }
    const nowIso = now.toISOString();
    const actions: Action[] = parsed.data.actions.map((action, index) => ({
        ...action,
        id: makeId(index),
        status: "PROPOSED",
        statusChangedAt: nowIso,
        edited: false,
        approval: null,
        execution: null,
    }));
    return {
        id: `msg_${nowIso}`,
        message,
        source: options.source ?? MANUAL_SOURCE,
        analysedAt: nowIso,
        planner: planner.name,
        plannerIsModel: planner.isModel,
        summary: parsed.data.summary,
        priority: parsed.data.priority,
        deadline: parsed.data.deadline,
        replyRequired: parsed.data.replyRequired,
        needsClarification: parsed.data.needsClarification,
        clarificationReason: parsed.data.clarificationReason,
        suspectedInjection: parsed.data.suspectedInjection,
        injectionNote: parsed.data.injectionNote,
        actions,
    };
}
