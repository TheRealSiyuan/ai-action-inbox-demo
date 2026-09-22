import { NextResponse } from "next/server";
import { recentAuditEvents } from "@/lib/store/repository";
export async function GET() {
    return NextResponse.json({ events: recentAuditEvents(200) });
}
