/**
 * Minimal crawler entrypoint for the sample project.
 */

import type { SiteConfig } from "./crawlerCore";

const DEFAULT_SITE: SiteConfig = {
  domain: "gcetly.ac.in",
  seedUrl: "https://gcetly.ac.in",
  sourceType: "official_website",
  priority: 1,
  label: "GCE-TLY Official Website",
};

console.log("Crawl entrypoint available. Use npm run update-knowledge after collecting pages.");
console.log(`Configured site: ${DEFAULT_SITE.label} (${DEFAULT_SITE.seedUrl})`);
