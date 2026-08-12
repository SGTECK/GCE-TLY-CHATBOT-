import fs from "node:fs";
import path from "node:path";

const sourceDir = path.resolve(process.cwd(), "data");
const out = path.join(sourceDir, "gcetly-knowledge.auto.json");
const faq = JSON.parse(fs.readFileSync(path.join(sourceDir, "gcetly-faq.json"), "utf-8"));
const knowledge = JSON.parse(fs.readFileSync(path.join(sourceDir, "gcetly-knowledge.json"), "utf-8"));

const merged = [...knowledge, ...faq.map((entry: any) => ({
  id: `faq-${entry.id}`,
  sourceUrl: entry.source,
  pageTitle: entry.question,
  category: entry.category,
  content: `${entry.question}\n${entry.answer}`,
  lastChecked: entry.lastVerified,
  sourceType: "official_website",
  priority: 1,
}))];

fs.writeFileSync(out, JSON.stringify(merged, null, 2), "utf-8");
console.log(`Wrote ${merged.length} knowledge entries to ${out}`);
