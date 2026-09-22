import { NextResponse } from "next/server";
import { z } from "zod";
import { analyseAndStore, WorkflowError, PlannerOutputError } from "@/lib/server/workflow";
const RequestSchema = z.object({ inboxMessageId: z.string().min(1).max(200) }).strict();
export async function POST(request: Request) {
    const parsed = RequestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success)
        return NextResponse.json({ error: "Choose a message from the sample inbox." }, { status: 400 });
    try {
        return NextResponse.json({ analysis: await analyseAndStore(parsed.data) });
    }
    catch (error) {
        if (error instanceof WorkflowError)
            return NextResponse.json({ error: error.message, reason: error.reason }, { status: error.status });
        if (error instanceof PlannerOutputError)
            return NextResponse.json({ error: "The suggestion did not pass validation.", issues: error.issues }, { status: 422 });
        return NextResponse.json({ error: "Could not read this sample message." }, { status: 500 });
    }
}
