import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

export const runtime = "nodejs";

export async function POST() {
  return NextResponse.json({ sessionId: randomUUID() });
}
