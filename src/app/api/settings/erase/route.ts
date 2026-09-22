import { NextResponse } from "next/server";
import { eraseAllData } from "@/lib/store/repository";
export async function POST() {
    eraseAllData();
    return NextResponse.json({ erased: true });
}
