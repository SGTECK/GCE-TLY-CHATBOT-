"use client";

export interface QuickAction {
  emoji: string;
  labelEn: string;
  labelTa: string;
  question: string;
}

export const QUICK_ACTIONS: QuickAction[] = [
  { emoji: "🎓", labelEn: "Admissions", labelTa: "சேர்க்கை", question: "What is the admission process?" },
  { emoji: "📚", labelEn: "Courses", labelTa: "படிப்புகள்", question: "What are the B.E. courses available?" },
  { emoji: "🏫", labelEn: "Departments", labelTa: "துறைகள்", question: "What departments are available?" },
  { emoji: "🏠", labelEn: "Hostel", labelTa: "விடுதி", question: "Tell me about hostel facilities and fees." },
  { emoji: "💰", labelEn: "Fees", labelTa: "கட்டணம்", question: "What is the fee structure?" },
  { emoji: "💼", labelEn: "Placements", labelTa: "வேலைவாய்ப்பு", question: "Tell me about placements." },
  { emoji: "🎓", labelEn: "Scholarships", labelTa: "உதவித்தொகை", question: "Are scholarships available?" },
  { emoji: "📅", labelEn: "Academic Calendar", labelTa: "கல்வி நாட்காட்டி", question: "What is the academic calendar?" },
  { emoji: "📢", labelEn: "Latest Notices", labelTa: "சமீபத்திய அறிவிப்புகள்", question: "What are the latest admission notifications?" },
  { emoji: "📞", labelEn: "Contact College", labelTa: "தொடர்பு", question: "How can I contact the college?" },
  { emoji: "🔬", labelEn: "Research", labelTa: "ஆராய்ச்சி", question: "Tell me about research activities at GCE-TLY." },
  { emoji: "🏢", labelEn: "Facilities", labelTa: "வசதிகள்", question: "What facilities are available on campus?" },
];

export default function QuickActions({
  onPick,
  language,
}: {
  onPick: (question: string) => void;
  language: "en" | "ta";
}) {
  return (
    <div className="grid grid-cols-3 gap-2 px-3 pb-2">
      {QUICK_ACTIONS.map((a) => (
        <button
          key={a.labelEn}
          onClick={() => onPick(a.question)}
          aria-label={`Ask: ${a.question}`}
          className="flex flex-col items-center gap-1 rounded-2xl px-1.5 py-3 text-center transition
                     bg-surface border border-white/[0.06] hover:border-accent/40 hover:bg-surfaceRaised"
        >
          <span className="text-lg leading-none" aria-hidden="true">{a.emoji}</span>
          <span className="text-[10px] font-medium text-slate-200 leading-tight">
            {language === "ta" ? a.labelTa : a.labelEn}
          </span>
        </button>
      ))}
    </div>
  );
}
