import type { NextRequest } from "next/server";
import type { ChatRequestBody, SourceRef } from "@/lib/types";
import { detectLanguage } from "@/lib/language";
import { retrieve, classifySmallTalk, needsCurrentInfo, isDeepResearchRequest } from "@/lib/retrieval";
import { buildSystemPrompt, smallTalkReplyFor } from "@/lib/systemPrompt";
import { streamChat } from "@/lib/anthropic";
import { checkRateLimit } from "@/lib/rateLimit";
import { getFollowUps } from "@/lib/followUps";

export const runtime = "nodejs";

function sseEncode(obj: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(obj)}\n\n`);
}

export async function POST(req: NextRequest) {
  let body: ChatRequestBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400 });
  }

  const message = (body.message ?? "").trim().slice(0, 2000);
  const sessionId = (body.sessionId || "anonymous").slice(0, 100);
  const history = Array.isArray(body.history) ? body.history.slice(-8) : [];

  if (!message) {
    return new Response(JSON.stringify({ error: "message is required" }), { status: 400 });
  }

  const { allowed } = checkRateLimit(sessionId);
  if (!allowed) {
    return new Response(
      JSON.stringify({ error: "You're sending messages a bit fast -- please wait a moment and try again." }),
      { status: 429 }
    );
  }

  const language = detectLanguage(message);
  const isFirstMessage = history.length === 0;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const close = (payload: { text: string; sources?: SourceRef[]; followUps?: string[] }) => {
        controller.enqueue(sseEncode({ type: "text", text: payload.text }));
        controller.enqueue(sseEncode({ type: "done", sources: payload.sources ?? [], language, followUps: payload.followUps ?? [] }));
        controller.close();
      };

      const smallTalk = classifySmallTalk(message);
      if (smallTalk) {
        close({ text: smallTalkReplyFor(smallTalk, language, isFirstMessage), followUps: getFollowUps(undefined, message) });
        return;
      }

      const { items: retrieved } = retrieve(message, history);
      const deepResearch = isDeepResearchRequest(message);
      const useWebSearch = needsCurrentInfo(message) || retrieved.length === 0 || deepResearch;

      const systemPrompt = buildSystemPrompt({ retrieved, language, usedWebSearch: useWebSearch, deepResearch });
      const claudeMessages = [...history, { role: "user" as const, content: message }];
      const localSources: SourceRef[] = Array.from(
        new Map(retrieved.map((r) => [r.source, { url: r.source, title: r.title }])).values()
      );
      const followUps = getFollowUps(retrieved[0]?.category, message);

      try {
        for await (const event of streamChat({
          systemPrompt,
          messages: claudeMessages,
          useWebSearch,
          abortSignal: req.signal,
        })) {
          if (event.type === "text") {
            controller.enqueue(sseEncode({ type: "text", text: event.text }));
          } else if (event.type === "retrying") {
            controller.enqueue(
              sseEncode({ type: "retrying", attempt: event.attempt, maxAttempts: event.maxAttempts, delayMs: event.delayMs })
            );
          } else if (event.type === "done") {
            const merged = new Map<string, SourceRef>();
            for (const s of [...localSources, ...event.webSources]) {
              if (!merged.has(s.url)) merged.set(s.url, s);
            }
            const sources = Array.from(merged.values());
            controller.enqueue(sseEncode({ type: "done", sources, language, followUps }));
          } else if (event.type === "aborted") {
            controller.enqueue(sseEncode({ type: "aborted" }));
          } else if (event.type === "error") {
            controller.enqueue(sseEncode({ type: "error", error: event.error, retryable: event.retryable }));
          }
        }
      } catch (err) {
        controller.enqueue(
          sseEncode({ type: "error", error: err instanceof Error ? err.message : "Unknown server error", retryable: false })
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
