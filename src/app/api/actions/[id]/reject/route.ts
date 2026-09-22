import { NextResponse } from "next/server";
import { rejectAction, WorkflowError } from "@/lib/server/workflow";
export async function POST(_request: Request, context: {
    params: Promise<{
        id: string;
    }>;
}) {
    const { id } = await context.params;
    try {
        return NextResponse.json(rejectAction(id));
    }
    catch (error) {
        if (error instanceof WorkflowError) {
            return NextResponse.json({ error: error.message, reason: error.reason }, { status: error.status });
        }
        throw error;
    }
}
