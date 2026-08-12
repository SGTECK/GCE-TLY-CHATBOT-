"use client";

import type { ChatRole, SourceRef } from "./types";

export interface PersistedMessage {
  role: ChatRole;
  content: string;
  sources?: SourceRef[];
}

const STORAGE_KEY = "gcetly-chat-history-v1";
const MAX_PERSISTED_MESSAGES = 40;

export function parseHistoryJson(raw: string | null): PersistedMessage[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const valid = parsed.filter(
      (m): m is PersistedMessage => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string"
    );
    return valid.length > 0 ? valid : null;
  } catch {
    return null;
  }
}

export function saveHistory(messages: PersistedMessage[]): void {
  try {
    const trimmed = messages.slice(-MAX_PERSISTED_MESSAGES);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // ignore storage-related errors
  }
}

export function loadHistory(): PersistedMessage[] | null {
  try {
    return parseHistoryJson(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

export function clearHistory(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore storage-related errors
  }
}
