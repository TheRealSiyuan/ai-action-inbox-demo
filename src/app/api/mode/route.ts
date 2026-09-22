import { NextResponse } from "next/server";
import { resolveMode } from "@/lib/mode";
import { storageSummary } from "@/lib/store/repository";
export async function GET() { return NextResponse.json({ status: await resolveMode(), storage: storageSummary() }); }
