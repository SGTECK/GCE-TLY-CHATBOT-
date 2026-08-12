import { NextResponse } from "next/server";
import { getFAQs, getKnowledgeBase } from "@/lib/knowledgeStore";

export const runtime = "nodejs";

export async function GET() {
  const hasApiKey = Boolean(process.env.ANTHROPIC_API_KEY);
  let knowledgeCount = 0;
  let faqCount = 0;
  let dataError: string | null = null;

  try {
    knowledgeCount = getKnowledgeBase().length;
    faqCount = getFAQs().length;
  } catch (err) {
    dataError = err instanceof Error ? err.message : "Failed to load data files";
  }

  return NextResponse.json({
    status: dataError ? "degraded" : "ok",
    anthropicApiKeyConfigured: hasApiKey,
    knowledgeEntries: knowledgeCount,
    faqEntries: faqCount,
    dataError,
  });
}
