"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Send, Mic, MicOff, Square, Loader2 } from "lucide-react";
import Header from "./Header";
import QuickActions from "./QuickActions";
import MessageBubble, { type DisplayMessage } from "./MessageBubble";
import { streamChatRequest, requestNewSession } from "@/lib/chatClient";
import { isTamil } from "@/lib/language";
import { useVoiceInput } from "@/lib/useVoiceInput";
import { saveHistory, loadHistory, clearHistory, type PersistedMessage } from "@/lib/localHistory";
import { exportChatAsMarkdown, downloadFile } from "@/lib/exportChat";
import type { ChatMessage } from "@/lib/types";

const WELCOME_EN = "Hello 👋 I'm the GCE-TLY AI Assistant.\n\nI can help you with official information about admissions, courses, departments, hostel, fees, examinations, placements, scholarships, facilities and more.\n\nHow can I help you today?";
const WELCOME_TA = "வணக்கம் 👋 நான் GCE-TLY AI உதவியாளர்.\n\nசேர்க்கை, படிப்புகள், துறைகள், விடுதி, கட்டணம், தேர்வுகள், வேலைவாய்ப்பு, உதவித்தொகை, வசதிகள் பற்றிய அதிகாரப்பூர்வ தகவல்களுடன் உதவ முடியும்.\n\nஇன்று நான் உங்களுக்கு எப்படி உதவ முடியும்?";

function freshWelcome(language: "en" | "ta"): DisplayMessage {
  return { role: "assistant", content: language === "ta" ? WELCOME_TA : WELCOME_EN };
}

export default function ChatWindow() {
  const [messages, setMessages] = useState<DisplayMessage[]>(() => [freshWelcome("en")]);
  const [restoredFromHistory, setRestoredFromHistory] = useState(false);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [uiLanguage, setUiLanguage] = useState<"en" | "ta">("en");
  const [sessionId, setSessionId] = useState<string>("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleVoiceResult = useCallback((transcript: string) => { setInput((prev) => (prev ? prev + " " + transcript : transcript)); }, []);
  const { voiceState, voiceError, start: startVoice, stop: stopVoice, supported: voiceSupported } = useVoiceInput(uiLanguage, handleVoiceResult);

  useEffect(() => {
    requestNewSession().then(setSessionId);
    if (!restoredFromHistory) {
      const restored = loadHistory();
      if (restored && restored.length > 0) {
        setMessages(restored as DisplayMessage[]);
      }
      setRestoredFromHistory(true);
    }
  }, []);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages, streaming]);

  useEffect(() => {
    if (!restoredFromHistory || streaming) return;
    const toPersist: PersistedMessage[] = messages.filter((m) => m.content && !m.isError && !m.retrying).map(({ role, content, sources }) => ({ role, content, sources }));
    saveHistory(toPersist);
  }, [messages, streaming, restoredFromHistory]);

  useEffect(() => () => abortControllerRef.current?.abort(), []);

  const historyForApi = useCallback((): ChatMessage[] => messages.filter((m) => m.content && !m.isError).slice(-8).map(({ role, content }) => ({ role, content })), [messages]);

  const send = useCallback(async (textOverride?: string) => {
    const text = (textOverride ?? input).trim();
    if (!text || streaming || !sessionId) return;

    const history = historyForApi();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setStreaming(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    let assistantIdx = -1;
    setMessages((prev) => {
      assistantIdx = prev.length;
      return [...prev, { role: "assistant", content: "", streaming: true }];
    });

    let full = "";
    await streamChatRequest(text, history, sessionId, {
      onText: (chunk) => {
        full += chunk;
        setMessages((prev) => {
          const next = [...prev];
          next[assistantIdx] = { role: "assistant", content: full, streaming: true };
          return next;
        });
      },
      onRetrying: ({ attempt, delayMs }) => {
        setMessages((prev) => {
          const next = [...prev];
          next[assistantIdx] = { role: "assistant", content: "", streaming: true, retrying: `Service busy, retrying in ${Math.round(delayMs / 1000)}s… (attempt ${attempt}/3)` };
          return next;
        });
      },
      onDone: ({ sources, followUps }) => {
        setMessages((prev) => {
          const next = [...prev];
          next[assistantIdx] = { role: "assistant", content: full, sources, followUps, streaming: false };
          return next;
        });
        setStreaming(false);
        abortControllerRef.current = null;
      },
      onAborted: () => {
        setMessages((prev) => {
          const next = [...prev];
          next[assistantIdx] = { role: "assistant", content: full || "(stopped)", streaming: false, stopped: true };
          return next;
        });
        setStreaming(false);
        abortControllerRef.current = null;
      },
      onError: (errMsg) => {
        setMessages((prev) => {
          const next = [...prev];
          next[assistantIdx] = { role: "assistant", content: errMsg, streaming: false, isError: true };
          return next;
        });
        setStreaming(false);
        abortControllerRef.current = null;
      },
    }, controller.signal);
  }, [input, streaming, sessionId, historyForApi]);

  const stopGenerating = useCallback(() => { abortControllerRef.current?.abort(); }, []);

  const regenerate = useCallback(() => {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser) return;
    setMessages((prev) => {
      const idx = prev.map((m) => m.role).lastIndexOf("assistant");
      return idx >= 0 ? prev.slice(0, idx) : prev;
    });
    send(lastUser.content);
  }, [messages, send]);

  const editAndResend = useCallback((originalText: string) => {
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.role === "user" && m.content === originalText);
      return idx >= 0 ? prev.slice(0, idx) : prev;
    });
    setInput(originalText);
  }, []);

  const sendFeedback = useCallback((assistantIdx: number, rating: "up" | "down") => {
    const answer = messages[assistantIdx]?.content ?? "";
    const question = [...messages.slice(0, assistantIdx)].reverse().find((m) => m.role === "user")?.content ?? "";
    fetch("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question, answer, rating, sessionId }) }).catch(() => {});
  }, [messages, sessionId]);

  const newChat = useCallback(async () => {
    window.speechSynthesis?.cancel();
    stopVoice();
    abortControllerRef.current?.abort();
    clearHistory();
    setMessages([freshWelcome(uiLanguage)]);
    setInput("");
    setStreaming(false);
    const fresh = await requestNewSession();
    setSessionId(fresh);
  }, [uiLanguage, stopVoice]);

  const exportConversation = useCallback(() => {
    const toExport: PersistedMessage[] = messages.filter((m) => m.content && !m.isError && !m.retrying).map(({ role, content, sources }) => ({ role, content, sources }));
    const md = exportChatAsMarkdown(toExport);
    downloadFile(`gcetly-ai-chat-${new Date().toISOString().slice(0, 10)}.md`, md);
  }, [messages]);

  const toggleLanguage = () => {
    setUiLanguage((prev) => {
      const next = prev === "en" ? "ta" : "en";
      setMessages((cur) => (cur.length === 1 && cur[0].role === "assistant" ? [freshWelcome(next)] : cur));
      return next;
    });
  };

  const showQuickActions = messages.length === 1 && messages[0].role === "assistant";
  const lastAssistantIdx = messages.map((m) => m.role).lastIndexOf("assistant");

  const micLabel: Record<string, string | null> = { idle: null, requesting: "Requesting mic access…", listening: "🔴 Listening…", processing: "⏳ Processing…", error: voiceError };
  const currentMicLabel = micLabel[voiceState];

  return (
    <div className={[
      "relative w-full max-w-lg h-[680px] flex flex-col rounded-3xl overflow-hidden shadow-2xl glass-panel",
      darkMode ? "dark" : "",
    ].join(" ")}>
      <Header darkMode={darkMode} onToggleDark={() => setDarkMode((d) => !d)} onNewChat={newChat} onExport={messages.length > 1 ? exportConversation : undefined} language={uiLanguage} onToggleLanguage={toggleLanguage} />

      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin px-3 py-3 space-y-3 relative">
        {showQuickActions && <div className="absolute inset-0 blueprint-bg pointer-events-none z-0" aria-hidden="true" />}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 overflow-hidden" aria-hidden="true">
          <img src="https://gcetly.ac.in/imgs/gcelogo.jpg" alt="" className="w-64 h-64 object-contain opacity-[0.06] dark:opacity-[0.10] grayscale" />
        </div>
        <div className="relative z-10 space-y-3">
          {messages.map((m, i) => (
            <MessageBubble key={i} message={m} isLastAssistant={i === lastAssistantIdx && !streaming} onRegenerate={i === lastAssistantIdx ? regenerate : undefined} onEditRequest={m.role === "user" ? editAndResend : undefined} onFeedback={m.role === "assistant" ? (rating) => sendFeedback(i, rating) : undefined} onFollowUpPick={(q) => send(q)} />
          ))}
        </div>
      </div>

      {showQuickActions && <QuickActions onPick={(q) => send(q)} language={uiLanguage} />}

      {currentMicLabel && (
        <div role={voiceState === "error" ? "alert" : "status"} aria-live="polite" className={`px-3 pb-1 text-[11px] flex items-center justify-between ${voiceState === "error" ? "text-red-500" : "text-slate-500 dark:text-slate-400"}`}>
          <span>{currentMicLabel}</span>
          {(voiceState === "listening" || voiceState === "requesting") && (<button onClick={stopVoice} className="underline" aria-label="Cancel voice input">Cancel</button>)}
        </div>
      )}

      <div className="flex items-end gap-2 p-3 border-t border-white/[0.06] bg-surface">
        <button onClick={() => (voiceState === "listening" ? stopVoice() : startVoice())} disabled={!voiceSupported && voiceState !== "error"} className={["shrink-0 rounded-full p-2.5 transition", voiceState === "listening" ? "bg-red-500 text-white" : "bg-accent text-white hover:brightness-110 shadow-lg shadow-accent/25"].join(" ")} title={voiceSupported ? "Voice input" : "Voice input not supported in this browser"} aria-label={voiceState === "listening" ? "Stop voice input" : voiceSupported ? "Start voice input" : "Voice input not supported in this browser"}>
          {voiceState === "listening" ? <MicOff size={16} /> : voiceState === "requesting" || voiceState === "processing" ? <Loader2 size={16} className="animate-spin" /> : <Mic size={16} />}
        </button>
        <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} rows={1} lang={isTamil(input) ? "ta" : "en"} aria-label="Message input" placeholder={uiLanguage === "ta" ? "சேர்க்கை, விடுதி, கட்டணம் பற்றி கேளுங்கள்…" : "Ask about admissions, hostel, fees…"} className="flex-1 resize-none rounded-full px-4 py-2.5 text-sm outline-none max-h-24 bg-surfaceRaised text-white placeholder:text-slate-500 border border-white/[0.06] focus:ring-2 focus:ring-accent/50" />
        {streaming ? (
          <button onClick={stopGenerating} className="shrink-0 rounded-full p-2.5 text-white bg-red-500 hover:bg-red-600" title="Stop generating" aria-label="Stop generating"><Square size={16} fill="currentColor" /></button>
        ) : (
          <button onClick={() => send()} disabled={!input.trim() || !sessionId} className="shrink-0 rounded-full p-2.5 text-white bg-accent hover:brightness-110 disabled:opacity-40 shadow-lg shadow-accent/25" title="Send" aria-label="Send message"><Send size={16} /></button>
        )}
      </div>
    </div>
  );
}
