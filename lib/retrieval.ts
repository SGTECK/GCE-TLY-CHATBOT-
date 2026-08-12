import type { ChatMessage, FAQEntry, KnowledgeEntry, RetrievedItem } from "./types";
import { getFAQs, getKnowledgeBase } from "./knowledgeStore";

const WORD_RE = /[\w\u0B80-\u0BFF]+/gu;

const STOPWORDS = new Set([
  "the", "is", "a", "an", "of", "to", "in", "for", "and", "or", "on", "at",
  "what", "how", "who", "when", "which", "are", "do", "does", "i",
  "can", "you", "me", "my", "please", "tell", "about", "will", "it", "this",
  "that", "with", "be", "there", "number",
]);

function tokenize(text: string): string[] {
  const matches = text.toLowerCase().match(WORD_RE) || [];
  return matches.filter((w) => w.length > 1 && !STOPWORDS.has(w));
}

interface CorpusDoc {
  id: string;
  kind: "faq" | "knowledge";
  tokens: Set<string>;
  ref: FAQEntry | KnowledgeEntry;
}

let corpusCache: CorpusDoc[] | null = null;
let idfCache: Map<string, number> | null = null;

function buildCorpus(): CorpusDoc[] {
  const faqs = getFAQs();
  const kb = getKnowledgeBase();

  const docs: CorpusDoc[] = [];
  for (const f of faqs) {
    const text = [f.question, ...f.variations, f.answer].join(" ");
    docs.push({ id: f.id, kind: "faq", tokens: new Set(tokenize(text)), ref: f });
  }
  for (const k of kb) {
    const text = [k.pageTitle, k.content].join(" ");
    docs.push({ id: k.id, kind: "knowledge", tokens: new Set(tokenize(text)), ref: k });
  }
  return docs;
}

function buildIdf(docs: CorpusDoc[]): Map<string, number> {
  const df = new Map<string, number>();
  for (const doc of docs) {
    for (const token of doc.tokens) {
      df.set(token, (df.get(token) || 0) + 1);
    }
  }
  const idf = new Map<string, number>();
  const n = docs.length;
  for (const [token, count] of df.entries()) {
    idf.set(token, Math.log(1 + n / count));
  }
  return idf;
}

function getCorpus(): { docs: CorpusDoc[]; idf: Map<string, number> } {
  if (!corpusCache || !idfCache) {
    corpusCache = buildCorpus();
    idfCache = buildIdf(corpusCache);
  }
  return { docs: corpusCache, idf: idfCache };
}

export function invalidateRetrievalCache() {
  corpusCache = null;
  idfCache = null;
}

function scoreDoc(queryTokens: string[], doc: CorpusDoc, idf: Map<string, number>): number {
  let score = 0;
  for (const t of queryTokens) {
    if (doc.tokens.has(t)) {
      score += idf.get(t) ?? 1;
    }
  }
  if (score === 0) return 0;

  const priority = doc.kind === "knowledge" ? (doc.ref as KnowledgeEntry).priority : 1;
  const priorityMultiplier = { 1: 1.15, 2: 1.05, 3: 0.95, 4: 0.85 }[priority] ?? 1;
  return score * priorityMultiplier;
}

function buildRetrievalQuery(message: string, history: ChatMessage[]): string {
  const lastUser = [...history].reverse().find((m) => m.role === "user");
  const parts = [message, message];
  if (lastUser && lastUser.content !== message) parts.push(lastUser.content);
  return parts.join(" ");
}

export interface RetrievalResult {
  items: RetrievedItem[];
  topScore: number;
}

export function retrieve(message: string, history: ChatMessage[], topK = 6): RetrievalResult {
  const { docs, idf } = getCorpus();
  const retrievalQuery = buildRetrievalQuery(message, history);
  const queryTokens = tokenize(retrievalQuery);

  if (queryTokens.length === 0) {
    return { items: [], topScore: 0 };
  }

  const scored = docs.map((doc) => ({ doc, score: scoreDoc(queryTokens, doc, idf) }));
  scored.sort((a, b) => b.score - a.score);

  const top = scored.filter((s) => s.score > 0).slice(0, topK);

  const items: RetrievedItem[] = top.map(({ doc, score }) => {
    if (doc.kind === "faq") {
      const f = doc.ref as FAQEntry;
      return { text: `Q: ${f.question}\nA: ${f.answer}`, source: f.source, title: f.question, category: f.category, lastChecked: f.lastVerified, score, kind: "faq" };
    }
    const k = doc.ref as KnowledgeEntry;
    return { text: k.content, source: k.sourceUrl, title: k.pageTitle, category: k.category, lastChecked: k.lastChecked, score, kind: "knowledge" };
  });

  return { items, topScore: top[0]?.score ?? 0 };
}

const GREETING_RE = /^h(i+|ello+|ey+|ai)\b|^(good\s?(morning|afternoon|evening))\b|^vanakkam\b|^வணக்கம்/i;
const THANKS_RE = /^(thanks|thank\s?you|thankyou|thx)\b|^நன்றி/i;
const FAREWELL_RE = /^(bye|goodbye|see\s?you|good\s?night)\.?$/i;
const ACK_RE = /^(ok(ay)?|great|cool|nice|got it|alright)\.?$/i;

export type SmallTalkKind = "greeting" | "thanks" | "farewell" | "ack" | null;

export function classifySmallTalk(message: string): SmallTalkKind {
  const trimmed = message.trim();
  if (trimmed.length === 0 || trimmed.split(/\s+/).length > 4) return null;
  if (GREETING_RE.test(trimmed)) return "greeting";
  if (THANKS_RE.test(trimmed)) return "thanks";
  if (FAREWELL_RE.test(trimmed)) return "farewell";
  if (ACK_RE.test(trimmed)) return "ack";
  return null;
}

export function isGreetingOrSmallTalk(message: string): boolean {
  return classifySmallTalk(message) !== null;
}

const CURRENT_INFO_PATTERNS = [
  /\blatest\b/i, /\bcurrent(ly)?\b/i, /\brecent(ly)?\b/i, /\btoday\b/i,
  /\bnow\b/i, /\bnew\b/i, /\bupdate[sd]?\b/i, /\bnotification[s]?\b/i,
  /\bnotice[s]?\b/i, /\bdeadline\b/i, /\blast date\b/i, /\bupcoming\b/i,
  /\bthis year\b/i, /202[4-9]-?2?[0-9]?/,
  /\bprincipal\b/i, /\bhod\b/i, /\bhead of department\b/i,
  /\bhappen(ed|ing)?\b/i, /\bexhibition\b/i, /\bevent[s]?\b/i, /\bseminar\b/i,
  /\bworkshop\b/i, /\bfest(ival)?\b/i, /\bhackathon\b/i, /\bsymposium\b/i,
  /\bcompetition\b/i, /\bwas held\b/i, /\bis it (open|closed)\b/i,
  /\bnews\b/i, /\bworld\b/i, /\bwhat('s| is) happening\b/i,
];

export function needsCurrentInfo(message: string): boolean {
  return CURRENT_INFO_PATTERNS.some((re) => re.test(message));
}

const DEEP_RESEARCH_PATTERNS = [
  /\bdeep research\b/i, /\bresearch this\b/i, /\bsearch the web\b/i,
  /\bfind all information\b/i, /\bcheck google\b/i, /\bcheck social media\b/i,
  /\bverify this\b/i, /\bsearch (the )?entire web\b/i,
];

export function isDeepResearchRequest(message: string): boolean {
  return DEEP_RESEARCH_PATTERNS.some((re) => re.test(message));
}
