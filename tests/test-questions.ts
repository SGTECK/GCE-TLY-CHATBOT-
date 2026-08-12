import assert from "node:assert/strict";
import { retrieve, classifySmallTalk, needsCurrentInfo } from "../lib/retrieval";
import { detectLanguage } from "../lib/language";
import { isSafeUrl } from "../lib/urlSafety";

const tests = [
  { name: "admissions query", fn: () => assert.ok(retrieve("how can i join gce tirunelveli", []).items.some((i) => i.category === "ADMISSIONS")) },
  { name: "hostel query", fn: () => assert.ok(retrieve("hostel fee", []).items.some((i) => i.category === "HOSTEL")) },
  { name: "contact query", fn: () => assert.ok(retrieve("how can i contact the college", []).items.some((i) => i.category === "CONTACT")) },
  { name: "greeting detection", fn: () => assert.equal(classifySmallTalk("hello"), "greeting") },
  { name: "current info detection", fn: () => assert.equal(needsCurrentInfo("who is the principal"), true) },
  { name: "language detection", fn: () => assert.equal(detectLanguage("வணக்கம்"), "ta") },
  { name: "safe URL", fn: () => assert.equal(isSafeUrl("https://gcetly.ac.in"), true) },
  { name: "unsafe URL", fn: () => assert.equal(isSafeUrl("javascript:alert(1)"), false) },
];

let passed = 0;
for (const test of tests) {
  try {
    test.fn();
    passed++;
    console.log(`✓ ${test.name}`);
  } catch (err) {
    console.log(`✗ ${test.name}: ${(err as Error).message}`);
  }
}

console.log(`\n${passed}/${tests.length} tests passed`);
if (passed !== tests.length) process.exit(1);
