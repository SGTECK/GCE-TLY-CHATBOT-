export type SourceType = "official_website" | "official_pdf" | "government_portal" | "external_website";

export interface SiteConfig {
  domain: string;
  seedUrl: string;
  sourceType: SourceType;
  priority: 1 | 2 | 3 | 4;
  label: string;
}

export const REQUEST_DELAY_MS = 1000;
export const THIN_CONTENT_THRESHOLD = 400;

export async function fetchPage(url: string): Promise<{ html: string | null; method: "static" | "rendered" }> {
  try {
    const res = await fetch(url);
    const html = res.ok ? await res.text() : null;
    return { html, method: "static" };
  } catch {
    return { html: null, method: "rendered" };
  }
}

export function extractContent(html: string, baseUrl: string, allowedDomains: string[]) {
  const links = new Set<string>();
  const pdfLinks = new Set<string>();
  const matches = html.match(/href=["']([^"']+)["']/g) || [];
  for (const match of matches) {
    const href = match.replace(/^href=["']|["']$/g, "");
    if (!href || href.startsWith("mailto:") || href.startsWith("javascript:")) continue;
    try {
      const absolute = new URL(href, baseUrl).toString();
      if (allowedDomains.some((d) => absolute.includes(d))) {
        if (absolute.toLowerCase().endsWith(".pdf")) pdfLinks.add(absolute);
        else links.add(absolute);
      }
    } catch {
      // ignore malformed URLs
    }
  }

  return { title: "Crawled Page", text: html.replace(/<[^>]+>/g, " "), links: Array.from(links), pdfLinks: Array.from(pdfLinks) };
}

export async function loadDisallowedPaths(): Promise<string[]> {
  return [];
}

export function isAllowed(url: string, disallowedPaths: string[]): boolean {
  return !disallowedPaths.some((p) => new URL(url).pathname.startsWith(p));
}

export async function downloadPdf(pdfUrl: string, store: { root?: string }) {
  return { pdfUrl, store };
}

export class CrawlStore {
  root: string;
  constructor(outputDir = "data/crawled") {
    this.root = outputDir;
  }
  hasChanged() { return true; }
  savePage() { return; }
  summary() { return { pages: 0, pdfs: 0, outputDir: this.root }; }
}

export function sleep(ms: number) { return new Promise((resolve) => setTimeout(resolve, ms)); }

export async function fetchRendered() { return null; }

export const DEFAULT_SITE: SiteConfig = {
  domain: "gcetly.ac.in",
  seedUrl: "https://gcetly.ac.in",
  sourceType: "official_website",
  priority: 1,
  label: "GCE-TLY Official Website",
};
