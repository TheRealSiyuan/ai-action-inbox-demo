import { NextResponse } from "next/server";
import { getInbox } from "@/lib/inbox";
export async function GET(request: Request) {
    const limit = Number(new URL(request.url).searchParams.get("limit") ?? 8);
    const inbox = getInbox();
    try {
        const messages = await inbox.list(Math.min(Math.max(limit, 1), 20));
        return NextResponse.json({ provider: inbox.name, live: inbox.live, messages });
    }
    catch (error) {
        return NextResponse.json({
            error: error instanceof Error ? error.message : "Could not read the inbox.",
            provider: inbox.name,
        }, { status: 502 });
    }
}
