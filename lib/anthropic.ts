import Anthropic from "@anthropic-ai/sdk";
import type { ChatMessage, SourceRef } from "./types";
import { isRetryableError, backoffDelayMs, MAX_RETRIES } from "./retryLogic";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
const REQUEST_TIMEOUT_MS = 30_000;

let client: Anthropic | null = null;
function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Copy .env.example to .env.local and add your key from https://console.anthropic.com/"
    );
  }
  if (!client) client = new Anthropic({ apiKey });
  return client;
}

export interface StreamChatParams {
  systemPrompt: string;
  messages: ChatMessage[];
  useWebSearch: boolean;
  abortSignal?: AbortSignal;
}

export type StreamChatEvent =
  | { type: "text"; text: string }
  | { type: "retrying"; attempt: number; maxAttempts: number; delayMs: number }
  | { type: "done"; webSources: SourceRef[] }
  | { type: "aborted" }
  | { type: "error"; error: string; retryable: boolean };

export { isRetryableStatus, isRetryableError, backoffDelayMs } from "./retryLogic";

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });
}

export async function* streamChat(params: StreamChatParams): AsyncGenerator<StreamChatEvent> {
  const { systemPrompt, messages, useWebSearch, abortSignal } = params;
  const anthropic = getClient();

  const tools = useWebSearch ? ([{ type: "web_search_20250305", name: "web_search" }] as any) : undefined;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (abortSignal?.aborted) {
      yield { type: "aborted" };
      return;
    }

    if (attempt > 0) {
      const delay = backoffDelayMs(attempt);
      yield { type: "retrying", attempt, maxAttempts: MAX_RETRIES, delayMs: delay };
      try {
        await sleep(delay, abortSignal);
      } catch {
        yield { type: "aborted" };
        return;
      }
    }

    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), REQUEST_TIMEOUT_MS);
    const onCallerAbort = () => timeoutController.abort();
    abortSignal?.addEventListener("abort", onCallerAbort);

    try {
      const stream = anthropic.messages.stream(
        {
          model: MODEL,
          max_tokens: 1024,
          system: systemPrompt,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
          ...(tools ? { tools } : {}),
        },
        { signal: timeoutController.signal }
      );

      for await (const event of stream) {
        if (event.type === "content_block_delta" && (event.delta as any)?.type === "text_delta") {
          const text = (event.delta as any).text as string;
          if (text) yield { type: "text", text };
        }
      }

      const finalMessage = await stream.finalMessage();
      yield { type: "done", webSources: extractWebSources(finalMessage) };
      return;
    } catch (err) {
      if (abortSignal?.aborted) {
        yield { type: "aborted" };
        return;
      }
      const retryable = isRetryableError(err);
      const isLastAttempt = attempt === MAX_RETRIES;
      if (retryable && !isLastAttempt) {
        continue;
      }
      const message = err instanceof Anthropic.APIError
        ? `${err.status ?? "unknown"}: ${err.message}`
        : err instanceof Error ? err.message : "Unknown error calling the Claude API";
      yield { type: "error", error: message, retryable };
      return;
    } finally {
      clearTimeout(timeoutId);
      abortSignal?.removeEventListener("abort", onCallerAbort);
    }
  }
}

function extractWebSources(message: unknown): SourceRef[] {
  const byUrl = new Map<string, string | undefined>();
  try {
    const content = (message as any)?.content;
    if (!Array.isArray(content)) return [];
    for (const block of content) {
      if (block?.type === "text" && Array.isArray(block.citations)) {
        for (const c of block.citations) {
          if (typeof c?.url === "string") {
            byUrl.set(c.url, byUrl.get(c.url) ?? (typeof c?.title === "string" ? c.title : undefined));
          }
        }
      }
      if (block?.type === "web_search_tool_result" && Array.isArray(block.content)) {
        for (const item of block.content) {
          if (typeof item?.url === "string") {
            byUrl.set(item.url, byUrl.get(item.url) ?? (typeof item?.title === "string" ? item.title : undefined));
          }
        }
      }
    }
  } catch {
    // best-effort only
  }
  return Array.from(byUrl.entries()).map(([url, title]) => ({ url, title }));
}
