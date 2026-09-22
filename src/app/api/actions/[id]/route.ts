import { NextResponse } from "next/server";
import { z } from "zod";
import { ACTION_PAYLOAD_SCHEMAS, ACTION_TYPES } from "@/lib/schemas";
import { loadAction } from "@/lib/store/repository";
import { editAction, WorkflowError } from "@/lib/server/workflow";
const EditSchema = z.object({
    type: z.enum(ACTION_TYPES),
    title: z.string().min(1).max(200).optional(),
    description: z.string().min(1).max(2000).optional(),
    payload: z.unknown().optional(),
});
export async function PATCH(request: Request, context: {
    params: Promise<{
        id: string;
    }>;
}) {
    const { id } = await context.params;
    const parsed = EditSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json({ error: "Invalid edit." }, { status: 400 });
    }
    const stored = loadAction(id);
    if (!stored)
        return NextResponse.json({ error: "Unknown action." }, { status: 404 });
    if (stored.type !== parsed.data.type)
        return NextResponse.json({ error: "An edit cannot change the action type." }, { status: 409 });
    let payload;
    if (parsed.data.payload !== undefined) {
        const payloadResult = ACTION_PAYLOAD_SCHEMAS[parsed.data.type].safeParse(parsed.data.payload);
        if (!payloadResult.success) {
            return NextResponse.json({
                error: "Those details are not valid.",
                issues: payloadResult.error.issues.map((issue) => `${issue.path.join(".") || "value"}: ${issue.message}`),
            }, { status: 422 });
        }
        payload = payloadResult.data;
    }
    try {
        return NextResponse.json(editAction(id, {
            title: parsed.data.title,
            description: parsed.data.description,
            payload: payload as never,
        }));
    }
    catch (error) {
        if (error instanceof WorkflowError) {
            return NextResponse.json({ error: error.message, reason: error.reason }, { status: error.status });
        }
        throw error;
    }
}
