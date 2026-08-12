export type Category =
  | "ADMISSIONS"
  | "ACADEMICS"
  | "DEPARTMENTS"
  | "HOSTEL"
  | "FEES"
  | "EXAMINATIONS"
  | "SCHOLARSHIPS"
  | "PLACEMENTS"
  | "FACILITIES"
  | "RESEARCH"
  | "STUDENT_ACTIVITIES"
  | "CONTACT"
  | "NOTIFICATIONS"
  | "GENERAL_INFORMATION";

export type SourceType = "official_website" | "official_pdf" | "government_portal" | "external_website";

export interface KnowledgeEntry {
  id: string;
  sourceUrl: string;
  pageTitle: string;
  category: Category;
  content: string;
  lastChecked: string;
  sourceType: SourceType;
  priority: 1 | 2 | 3 | 4;
  documentDate?: string;
}

export interface FAQEntry {
  id: string;
  question: string;
  variations: string[];
  answer: string;
  category: Category;
  source: string;
  lastVerified: string;
}

export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface RetrievedItem {
  text: string;
  source: string;
  title: string;
  category: Category;
  lastChecked: string;
  score: number;
  kind: "faq" | "knowledge";
}

export type Language = "en" | "ta" | "mixed";

export interface SourceRef {
  url: string;
  title?: string;
}

export interface ChatRequestBody {
  message: string;
  history: ChatMessage[];
  sessionId: string;
  preferredLanguage?: Language | "auto";
}
