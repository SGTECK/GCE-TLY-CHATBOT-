"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type VoiceState = "idle" | "requesting" | "listening" | "processing" | "error";

export function useVoiceInput(language: "en" | "ta", onResult: (transcript: string) => void) {
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [voiceError, setVoiceError] = useState("");
  const recognitionRef = useRef<any>(null);
  const mountedRef = useRef(true);

  const supported =
    typeof window !== "undefined" && Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  const safeSetState = useCallback((s: VoiceState) => {
    if (mountedRef.current) setVoiceState(s);
  }, []);

  const stop = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch {
      // ignore
    }
    safeSetState("idle");
  }, [safeSetState]);

  const start = useCallback(() => {
    if (voiceState === "listening" || voiceState === "requesting") return;

    if (!supported) {
      safeSetState("error");
      setVoiceError("Voice input isn't supported in this browser. Please use Chrome or another supported browser.");
      return;
    }
    if (typeof window !== "undefined" && !window.isSecureContext) {
      safeSetState("error");
      setVoiceError("Voice input needs a secure (HTTPS) connection.");
      return;
    }

    safeSetState("requesting");
    setVoiceError("");

    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SR();
    recognition.lang = language === "ta" ? "ta-IN" : "en-IN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => safeSetState("listening");
    recognition.onaudiostart = () => safeSetState("listening");
    recognition.onspeechend = () => safeSetState("processing");

    recognition.onresult = (e: any) => {
      const transcript = e.results?.[0]?.[0]?.transcript ?? "";
      if (transcript) onResult(transcript);
      safeSetState("idle");
    };

    recognition.onerror = (e: any) => {
      const messages: Record<string, string | null> = {
        "not-allowed": "Microphone access is disabled. Please allow microphone permission in your browser settings.",
        "permission-denied": "Microphone access is disabled. Please allow microphone permission in your browser settings.",
        "no-speech": "Didn't catch that -- no speech detected. Tap the mic and try again.",
        "audio-capture": "No microphone was found on this device.",
        network: "Network issue during voice recognition. Please try again.",
        aborted: null,
      };
      const msg = messages[e.error] ?? "Voice input hit an unexpected error. Please try typing instead.";
      if (msg) {
        safeSetState("error");
        setVoiceError(msg);
      } else {
        safeSetState("idle");
      }
    };

    recognition.onend = () => {
      if (mountedRef.current) {
        setVoiceState((s) => (s === "listening" || s === "processing" ? "idle" : s));
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (err) {
      safeSetState("error");
      setVoiceError("Couldn't start voice input: " + (err instanceof Error ? err.message : "unknown error"));
    }
  }, [voiceState, supported, language, onResult, safeSetState]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      try {
        recognitionRef.current?.stop();
        recognitionRef.current = null;
      } catch {
        // ignore
      }
    };
  }, []);

  return { voiceState, voiceError, start, stop, supported };
}
