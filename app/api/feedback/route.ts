import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export const runtime = "nodejs";

const LOG_DIR = path.join(process.cwd(), "data", "feedback");
const LOG_FILE = path.join(LOG_DIR, "feedback-log.jsonl");
const MAX_FIELD_LENGTH = 4000;

interface FeedbackBody {
  question?: string;
  answer?: string;
  rating?: "up" | "down";
  sessionId?: string;
}

export async function POST(req: NextRequest) {
  let body: FeedbackBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body.rating !== "up" && body.rating !== "down") {
    return NextResponse.json({ error: "rating must be 'up' or 'down'" }, { status: 400 });
  }

  const entry = {
    timestamp: new Date().toISOString(),
    rating: body.rating,
    question: typeof body.question === "string" ? body.question.slice(0, MAX_FIELD_LENGTH) : "",
    answer: typeof body.answer === "string" ? body.answer.slice(0, MAX_FIELD_LENGTH) : "",
    sessionId: typeof body.sessionId === "string" ? body.sessionId.slice(0, 100) : undefined,
  };

  try {
    await fs.mkdir(LOG_DIR, { recursive: true });
    await fs.appendFile(LOG_FILE, JSON.stringify(entry) + "\n", "utf-8");
  } catch (err) {
    return NextResponse.json(
      { error: "Could not persist feedback on this deployment (read-only filesystem?). See app/api/feedback/route.ts.", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
