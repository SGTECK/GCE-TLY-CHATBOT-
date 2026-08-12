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

const WELCOME_EN =
  "Hello 👋 I'm the GCE-TLY AI Assistant.\n\nI can help you with official information about admissions, courses, departments, hostel, fees, examinations, placements, scholarships, facilities and more.\n\nHow can I help you today?";
const WELCOME_TA =
  "வணக்கம் 👋 நான் GCE-TLY AI உதவியாளர்.\n\nசேர்க்கை, படிப்புகள், துறைகள், விடுதி, கட்டணம், தேர்வுகள், வேலைவாய்ப்பு, உதவித்தொகை, வசதிகள் பற்றிய அதிகாரப்பூர்வ தகவல்களுடன் உதவ முடியும்.\n\nஇன்று நான் உங்களுக்கு எப்படி உதவ முடியும்?";

function freshWelcome(language: "en" | "ta"): DisplayMessage {
  return { role: "assistant", content: language === "ta" ? WELCOME_TA : WELCOME_EN };
}

export default function ChatWindow() {
  const [messages, setMessages] = useState<DisplayMessage[]>(() => {
    return [freshWelcome("en")];
  });
  const [restoredFromHistory, setRestoredFromHistory] = useState(false);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [uiLanguage, setUiLanguage] = useState<"en" | "ta">("en");
  const [sessionId, setSessionId] = useState<string>("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleVoiceResult = useCallback((transcript: string) => {
    setInput((prev) => (prev ? prev + " " + transcript : transcript));
  }, []);
  const { voiceState, voiceError, start: startVoice, stop: stopVoice, supported: voiceSupported } = useVoiceInput(
    uiLanguage,
    handleVoiceResult
  );

  useEffect(() => {
    requestNewSession().then(setSessionId);
    if (!restoredFromHistory) {
      const restored = loadHistory();
      if (restored && restored.length > 0) {
        setMessages(restored as DisplayMessage[]);
      }
      setRestoredFromHistory(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streaming]);

  useEffect(() => {
    if (!restoredFromHistory || streaming) return;
    const toPersist: PersistedMessage[] = messages
      .filter((m) => m.content && !m.isError && !m.retrying)
      .map(({ role, content, sources }) => ({ role, content, sources }));
    saveHistory(toPersist);
  }, [messages, streaming, restoredFromHistory]);

  useEffect(() => {
    return () => abortControllerRef.current?.abort();
  }, []);

  const historyForApi = useCallback((): ChatMessage[] => {
    return messages
      .filter((m) => m.content && !m.isError)
      .slice(-8)
      .map(({ role, content }) => ({ role, content }));
  }, [messages]);

  const send = useCallback(
    async (textOverride?: string) => {
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
      await streamChatRequest(
        text,
        history,
        sessionId,
        {
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
              next[assistantIdx] = {
                role: "assistant",
                content: "",
                streaming: true,
                retrying: `Service busy, retrying in ${Math.round(delayMs / 1000)}s… (attempt ${attempt}/3)`,
              };
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
        },
        controller.signal
      );
    },
    [input, streaming, sessionId, historyForApi]
  );

  const stopGenerating = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

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

  const sendFeedback = useCallback(
    (assistantIdx: number, rating: "up" | "down") => {
      const answer = messages[assistantIdx]?.content ?? "";
      const question = [...messages.slice(0, assistantIdx)].reverse().find((m) => m.role === "user")?.content ?? "";
      fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, answer, rating, sessionId }),
      }).catch(() => {});
    },
    [messages, sessionId]
  );

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

  const exportChat = useCallback(() => {
    const markdown = exportChatAsMarkdown(messages.map(({ role, content, sources }) => ({ role, content, sources })), new Date());
    downloadFile("gce-tly-chat.md", markdown, "text/markdown;charset=utf-8");
  }, [messages]);

  return (
    <div className={`flex h-[96vh] w-full max-w-5xl flex-col overflow-hidden rounded-[28px] border border-white/10 bg-surface/90 shadow-2xl shadow-slate-950/20 backdrop-blur-sm ${darkMode ? "dark" : ""}`}>
      <Header darkMode={darkMode} onToggleDark={() => setDarkMode((v) => !v)} onNewChat={newChat} onExport={exportChat} language={uiLanguage} onToggleLanguage={() => setUiLanguage((v) => (v === "en" ? "ta" : "en"))} />
      <div className="flex-1 overflow-y-auto px-3 py-3 scrollbar-thin" ref={scrollRef}>
        <div className="space-y-3">
          {messages.map((message, index) => (
            <MessageBubble
              key={`${message.role}-${index}-${message.content.slice(0, 10)}`}
              message={message}
              isLastAssistant={index === messages.length - 1 && message.role === "assistant"}
              onRegenerate={message.role === "assistant" ? regenerate : undefined}
              onEditRequest={message.role === "user" ? editAndResend : undefined}
              onFeedback={message.role === "assistant" ? (rating) => sendFeedback(index, rating) : undefined}
              onFollowUpPick={(q) => send(q)}
            />
          ))}
        </div>
      </div>
      <div className="border-t border-white/10 bg-surface/90 px-3 py-3">
        <QuickActions onPick={send} language={uiLanguage} />
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            placeholder={uiLanguage === "ta" ? "உங்கள் கேள்வியை இங்கே எழுதுங்கள்..." : "Type your question..."}
            className="min-h-[44px] flex-1 resize-none rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-accent/60"
            aria-label="Type your message"
          />
          {voiceSupported && (
            <button
              onClick={voiceState === "listening" || voiceState === "requesting" ? stopVoice : startVoice}
              aria-label={voiceState === "listening" || voiceState === "requesting" ? "Stop voice input" : "Start voice input"}
              className={`rounded-full p-2.5 ${voiceState === "error" ? "bg-red-500/15 text-red-300" : "bg-accent/15 text-accentSoft"}`}
            >
              {voiceState === "listening" || voiceState === "requesting" ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
          )}
          <button
            onClick={streaming ? stopGenerating : () => send()}
            aria-label={streaming ? "Stop generating" : "Send message"}
            className={`rounded-full p-2.5 ${streaming ? "bg-red-500/15 text-red-300" : "bg-accent text-white"}`}
          >
            {streaming ? <Square size={18} fill="currentColor" /> : <Send size={18} />}
          </button>
        </div>
        {voiceState !== "idle" && (
          <div className="mt-2 text-[11px] text-slate-400" role="status" aria-live="polite">
            {voiceState === "requesting" && "Preparing microphone…"}
            {voiceState === "listening" && "Listening…"}
            {voiceState === "processing" && "Processing speech…"}
            {voiceState === "error" && voiceError}
          </div>
        )}
      </div>
    </div>
  );
}
