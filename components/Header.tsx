"use client";

import { Plus, Moon, Sun, Download } from "lucide-react";
import CollegeLogo from "./CollegeLogo";

export default function Header({
  darkMode,
  onToggleDark,
  onNewChat,
  onExport,
  language,
  onToggleLanguage,
}: {
  darkMode: boolean;
  onToggleDark: () => void;
  onNewChat: () => void;
  onExport?: () => void;
  language: "en" | "ta";
  onToggleLanguage: () => void;
}) {
  return (
    <div className="relative bg-surface">
      <div className="flex items-center justify-between px-4 py-3.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <CollegeLogo size={34} />
          <div className="min-w-0">
            <p className="font-display font-bold text-sm text-white leading-tight truncate">GCE-TLY AI Assistant</p>
            <p className="text-[10.5px] text-white/60 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-accent inline-block shrink-0" />
              {language === "ta" ? "தயார் · அதிகாரப்பூர்வ தகவல் உதவியாளர்" : "Online · Official College Information Assistant"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onToggleLanguage}
            className="px-2.5 py-1.5 text-[11px] font-semibold rounded-full text-white/80 bg-white/5 hover:bg-white/10"
            title="Switch language"
            aria-label={language === "ta" ? "Switch to English" : "Switch to Tamil"}
          >
            {language === "ta" ? "EN" : "தமிழ்"}
          </button>
          <button
            onClick={onNewChat}
            className="p-2 rounded-full text-white/80 bg-white/5 hover:bg-white/10"
            title="New Chat"
            aria-label="Start a new chat -- clears the current conversation"
          >
            <Plus size={15} />
          </button>
          {onExport && (
            <button
              onClick={onExport}
              className="p-2 rounded-full text-white/80 bg-white/5 hover:bg-white/10"
              title="Export conversation"
              aria-label="Download this conversation as a Markdown file"
            >
              <Download size={15} />
            </button>
          )}
          <button
            onClick={onToggleDark}
            className="p-2 rounded-full text-white/80 bg-white/5 hover:bg-white/10"
            title="Toggle dark mode"
            aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
          >
            {darkMode ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>
      </div>
    </div>
  );
}
