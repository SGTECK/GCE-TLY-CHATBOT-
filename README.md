# GCE-TLY AI Assistant

Official AI information assistant for **Government College of Engineering, Tirunelveli** (https://gcetly.ac.in/). Next.js 14 (App Router) + TypeScript + Tailwind CSS, calling the Claude API server-side, grounded in a real, verified knowledge base and FAQ dataset built from the official website.

This is a genuine architecture pivot from an earlier local-Ollama version of this project: per this build's spec, it uses the **Claude API** (cloud), not a fully-offline local LLM. You'll need your own Anthropic API key, and API usage incurs cost. If you specifically need 100%-offline/local inference, that's a different project (the Ollama+ChromaDB version built earlier in this conversation) — this one trades that off for real, working web search and a simpler stack, per this build's explicit requirements.

## v2.0 — design system rewrite + new features

Applied to the codebase, not just described: verify with `npm test` (100 passing) after `npm install`.

**Design:** the production project's visual language had quietly drifted from the more restrained "academic, trustworthy, no excessive gradient/animation" direction validated in later preview iterations — it was still shipping an indigo→teal diagonal gradient and an unused floating-blob animation keyframe. v2.0 replaces that with a navy/gold letterhead treatment (the header is now styled like an official letterhead rather than a generic chat app bar), a subtle CSS-only "blueprint grid" texture (no image asset) in the empty state, and a real shimmer skeleton loading state instead of a plain "…" placeholder. Sora — loaded via Google Fonts since the very first version but never actually applied anywhere — is now used as the display face for institutional moments, paired with Inter for body text.

**Real gap closed:** the actual official college logo, verified real and used in every preview iteration since V4, had never been backported into this downloadable project — it only ever existed in the browser-only preview artifacts. `components/CollegeLogo.tsx` fixes that, with the same graceful hotlink-fallback pattern already validated in preview.

**New features:**
- **Suggested follow-up questions** after each answer — rule-based (`lib/followUps.ts`), keyed off the top retrieved category, computed server-side and sent alongside the answer. No extra API call, so it can't itself introduce a hallucinated claim — worst case is the same honest fallback as any other question.
- **Edit & resend** your last message — puts it back in the input and truncates the conversation from that point, rather than leaving a stale duplicate thread.
- **Persistent local chat history** (`lib/localHistory.ts`) — resumes your last conversation on reload. This is entirely client-side (localStorage in your own browser) and does **not** conflict with the server-side session-isolation guarantee below — that guarantee is about the *server* holding zero cross-user state; this is the same category of thing as a browser remembering your last open tab.
- **Export conversation** as a Markdown file (`lib/exportChat.ts`), including sources — no new dependency, just a Blob download.
- **Feedback that actually persists** — the thumbs up/down buttons previously only changed their own icon color. `app/api/feedback/route.ts` now logs real ratings to `data/feedback/feedback-log.jsonl`. Honest caveat: this works for the self-hosted/long-running-Node deployment model this README assumes (same assumption the crawler already makes); it will **not** persist reliably on a serverless platform with an ephemeral filesystem (e.g. Vercel's default runtime) — swap in a real datastore there.
- **PWA basics** — `public/manifest.json`, theme-color, apple-touch-icon, so the app is properly installable on Android home screens, matching the "Android-friendly" requirement already in this project's spec. One honest limitation: the manifest icon references the real hotlinked logo with `sizes: "any"` rather than a specific pixel dimension, because I can't verify the source image's actual dimensions without network access in this environment — a self-hosted, properly-sized PNG icon set would be more robust if you want a polished installed-app icon.

**Deliberately not done in this pass** (scope was already large; these deserve their own dedicated round rather than being half-built): a multi-conversation session switcher (this version persists one conversation, not a list of past ones), an offline-detection banner, and an admin/analytics dashboard for the feedback log (needs a real auth decision from you first — I didn't want to ship an unprotected admin page).

A full Phase 1-16 audit (inspect → identify problems → fix → test → verify) found that several fixes made during interactive preview iteration had never been backported into this production codebase — most importantly, **the real 429 bug was still live here** even after being fixed in the preview. Confirmed via grep before touching anything (see git-style evidence in the PR-equivalent below), then fixed and re-tested:

| Problem found | Where | Fix |
|---|---|---|
| Zero retry/backoff logic — any transient 429/5xx immediately surfaced as a raw error | `lib/anthropic.ts` | Exponential backoff + jitter (1.5s/3s/6s ±30%), max 3 retries, non-retryable errors (bad key, malformed request) fail fast instead of wasting retries |
| No per-request timeout — a hung connection could block forever | `lib/anthropic.ts` | 30s timeout via `AbortController`, combined with the client's own abort signal |
| Send-guard was only React state, which can lag a fast double-click/Enter combo | `lib/chatClient.ts` | Synchronous module-level lock checked *before* any network call starts |
| Voice input had no error handling at all — permission denial, no-mic, and unsupported-browser all failed identically silently | `components/ChatWindow.tsx` | Extracted to `lib/useVoiceInput.ts`: real state machine (idle/requesting/listening/processing/error) with distinct messages per failure mode, plus unmount cleanup that was previously missing entirely |
| No stop-generation button existed | `components/ChatWindow.tsx`, `lib/chatClient.ts`, `app/api/chat/route.ts`, `lib/anthropic.ts` | `AbortController` wired all the way from the Stop button through the fetch, through Next's `req.signal`, to the upstream Claude call — an aborted request actually cancels upstream, not just the UI |
| "Who is the principal" didn't trigger a live check (spec explicitly names this as an example) | `lib/retrieval.ts` | Added principal/HOD to the current-info trigger patterns |
| "Deep Research Mode" was specified in detail but never implemented | `lib/retrieval.ts`, `lib/systemPrompt.ts` | 8 trigger phrases force web search + switch to the structured Answer/Key Information/Verification/Sources format |
| Source-authority language didn't name Anna University/AICTE/DOTE explicitly, no social-media-verification caveat | `lib/systemPrompt.ts` | Rewrote with explicit tiering and the spec's exact suggested transparency phrasing |
| Citation links only checked `.startsWith("http")` | `components/MessageBubble.tsx` | Added a real `new URL()` parse-and-protocol check before any string becomes an `href` |

All 76 tests pass (`npm test`) — 59 pre-existing + 17 new, including unit tests for the retry/backoff decision logic itself (stress-tested 10x for jitter-related flakiness, none found).

### Second audit pass (same document, sent twice — read as a signal to re-check, not repeat)

Re-auditing the first pass's own report against the checklist found 4 more real gaps and one confirmed-safe non-issue:

| Found | Fix |
|---|---|
| Citations showed raw URLs only, no document title (Phase 6 explicitly asks for this) | `RetrievedItem` and `SourceRef` now carry a real `title` (page title / FAQ question / search-result title where the API provides one) |
| Prompt-injection guard only covered "the user's message," not retrieved CONTEXT or web-search results | Extended explicitly: a crawled page or search result cannot issue instructions, no matter how it's phrased |
| Zero `aria-label`s outside the Stop/Send buttons — Header, QuickActions, MessageBubble's action buttons, and the voice mic/cancel buttons relied on `title` only | Added throughout, plus `role="status"`/`aria-live="polite"` on the voice-state region so screen readers announce state changes |
| `isSafeUrl` (citation validation) existed with zero test coverage | Extracted to standalone `lib/urlSafety.ts`, 6 new tests (javascript:/data:/file: URIs rejected, malformed strings don't throw) |
| Checked: `requestNewSession().then(setSessionId)` has no `.catch()` | **Confirmed safe, not fixed** — the function's own internal try/catch means it can never reject; "fixing" it would be cosmetic, not a real bug |

One test I wrote was itself wrong and caught its own bug: it assumed the first FAQ result for "who is the principal" would always be the principal FAQ specifically — but "Are scholarships available?" legitimately ties on score (its answer mentions "Principal's-office"), so insertion order won that tie. That's correct retrieval behavior, not a bug — the test's assumption was too strict, so I fixed the test, not the code.

All 84 tests pass (76 + 8 new), stability-checked across 5 consecutive runs.

---

## Architecture

```
Official gcetly.ac.in
        |
   scripts/crawl-gcetly.ts        (BFS crawl, robots.txt-aware, incremental)
        v
  data/crawled/pages/*.json        (raw + cleaned text, source URL, timestamp)
        |
   scripts/update-knowledge.ts     (categorize, chunk)
        v
  data/gcetly-knowledge.auto.json  (auto-generated, refreshable)
        +
  data/gcetly-knowledge.json       (hand-curated, verified -- never overwritten)
  data/gcetly-faq.json             (curated Q&A with phrasing variations)
        |
   lib/retrieval.ts                (TF-IDF-weighted keyword retrieval, English+Tamil)
        v
  app/api/chat/route.ts  <-- user question (+ THIS conversation's own history only)
        |
   lib/systemPrompt.ts             (grounding rules, hallucination control, citations)
        v
   lib/anthropic.ts                (Claude API, streaming, optional live web_search)
        v
   Verified, cited answer  -->  components/ChatWindow.tsx
```

**Why keyword retrieval instead of a vector database?** The project spec explicitly permits "a suitable vector database OR a lightweight local retrieval architecture" and asks for something "simple enough for a student developer to understand and maintain." A TF-IDF-weighted keyword retriever over ~60 curated entries needs no external service, no embedding API calls, and no infrastructure — and its behavior is fully verified in `tests/test-questions.ts` (59 passing tests, see below). This is retrieval, not a trained model — nothing here is a fine-tuned or trained AI; it's the standard crawl → chunk → retrieve → prompt → verified-answer pipeline the spec asks for.

## Why sessions are actually isolated (not just told not to leak)

`app/api/chat/route.ts` holds **no server-side conversation store at all** — no database, no cache, no in-memory map keyed by user or session. The only conversation history that ever reaches the server is whatever the calling browser tab's own React state sends in that single request's body. That means:

- A new chat (fresh page load, or the **New Chat** button, which resets the client's message array to empty and requests a fresh session id from `/api/session/new`) is structurally guaranteed to start with zero prior context — there's nothing server-side that *could* leak in.
- Two different browser tabs or users can never influence each other, because their requests never touch shared mutable state.
- `sessionId` is used **only** as an in-memory rate-limit bucket key (see `lib/rateLimit.ts`) — never to store or look up message content.

This is verified in `tests/test-questions.ts` (the "MEMORY ISOLATION" section) at the retrieval layer, and is true by construction at the API layer — there's simply no code path that could reuse another request's data.

---

## 1. Setup

Requires Node.js 18.17+.

```bash
npm install
cp .env.example .env.local
# edit .env.local: add ANTHROPIC_API_KEY (from https://console.anthropic.com/)

npm run dev
```

Visit http://localhost:3000.

## 2. Try it

- "Hi" → a real greeting (this was a confirmed bug in an earlier iteration — "Hi" was hitting the knowledge-base fallback instead of greeting; now covered by a regression test)
- "hostel fees?" → grounded answer with a source citation
- "girls hostel?" → confirms availability with capacity figures
- "who is the ECE HOD?" → honestly reports that the college's own site names two different people in two different places, rather than guessing
- "I want admission" → asks which type (B.E. First Year / Lateral / M.E. / Part-Time) instead of assuming
- "விடுதி கட்டணம் என்ன?" → answers in natural Tamil
- "what's the wifi password" → the exact "I couldn't verify..." fallback (nothing in the knowledge base covers this — proves grounding, not a bug)
- Click **New Chat**, then ask "what is my name?" after previously introducing yourself → confirms no memory carries over

## 3. Testing

```bash
npm test
```

This runs `tests/test-questions.ts`: **59 tests**, all passing, covering every category from the spec (Admissions, Fees, Hostel, Courses, Departments, Placements, Scholarships, Examinations, Facilities, Research, Student Activities, Contact, Notifications), Tamil questions, spelling mistakes, ambiguous questions, unknown/unanswerable questions, the greeting bug-fix regression, and memory isolation. It runs the real retrieval engine against the real data files — no network access or API key required, since it tests the grounding layer directly rather than mocking it.

Sample output:
```
59 passed, 0 failed, 59 total
```

Three real bugs were caught and fixed while building this (not merely theoretical -- see git-style history in this session): "where is the college" wasn't matching CONTACT because "where" was being stripped as a stopword (an over-broad stopword list is a classic retrieval bug); "what is tomorrow's lottery number" was retrieving unrelated FEES/HOSTEL content because the generic word "number" incidentally appears everywhere (phone numbers, room numbers); and the Tamil FAQ dataset initially had zero actual Tamil-language text in it (only English descriptions of Tamil support), so Tamil-only queries retrieved nothing until real Tamil variations were added.

**What this test suite does NOT cover:** the live Claude API call itself (final answer phrasing, clarification-question behavior, live web search results) — that needs a real `ANTHROPIC_API_KEY` and is best verified by actually using the running app, since LLM output isn't deterministic the way retrieval is.

## 4. Crawling fresh content from gcetly.ac.in (and other sites)

```bash
npm run crawl                              # crawl gcetly.ac.in from the homepage, up to 150 pages
npm run crawl -- --max-pages 60            # smaller run
npm run crawl -- --force                   # ignore incremental cache, re-store everything
npm run crawl -- --site "annauniv.edu|https://www.annauniv.edu|government_portal|1|Anna University"
npm run update-knowledge                   # turn the crawl into data/gcetly-knowledge.auto.json
```

`crawl-gcetly.ts` does a breadth-first, same-domain (per configured site) crawl with robots.txt compliance, boilerplate stripping, linked-PDF collection, and an incremental content-hash cache (unchanged pages are skipped on re-crawl). Add `--site` flags to crawl additional trusted sites alongside gcetly.ac.in, each with its own trust tier -- see `scripts/crawlerCore.ts` for the format. `update-knowledge.ts` categorizes and chunks whatever was crawled into `data/gcetly-knowledge.auto.json`, which is loaded **alongside** (never replacing) the hand-curated `data/gcetly-knowledge.json` -- see `lib/knowledgeStore.ts`. Auto-categorization is a best-effort keyword heuristic; skim the output file before fully trusting it, especially for FEES/EXAMINATIONS/NOTIFICATIONS where specific figures and dates matter most.

**Optional JS-rendering fallback:** if a page's static HTML looks too thin (likely client-rendered), the crawler tries Playwright automatically if it's installed (`npm i -D playwright && npx playwright install chromium`); otherwise it just logs a warning and moves on with whatever static content it got.

**Keeping this fresh automatically:** `.github/workflows/recrawl.yml` runs this crawl + rebuild on a daily schedule (or on manual dispatch) and commits `data/gcetly-knowledge.auto.json` back to the repo when it changes, which triggers Vercel to redeploy with the updated knowledge base. This runs in GitHub Actions rather than as a Vercel cron/API route specifically because Vercel's serverless filesystem can't durably persist a crawl's output for the live app to read -- see the comments at the top of that workflow file for the one-time repo settings it needs (Actions write permissions, branch protection exceptions if `main` is protected).

## 5. Voice input — states, limitations, and iframe embedding

`lib/useVoiceInput.ts` implements a real state machine: `idle → requesting → listening → processing → idle`, with a distinct `error` state that names *why* it failed rather than failing silently:

| Failure | Message shown |
|---|---|
| Permission denied | "Microphone access is disabled. Please allow microphone permission in your browser settings." |
| No speech detected | "Didn't catch that — no speech detected. Tap the mic and try again." |
| No microphone on device | "No microphone was found on this device." |
| Browser doesn't support Speech Recognition | "Voice input isn't supported in this browser. Please use Chrome or another supported browser." |
| Not on HTTPS | "Voice input needs a secure (HTTPS) connection." |

The recognition instance and its listeners are torn down on component unmount, so navigating away mid-listen can't leave the microphone active.

**If you embed this app in an iframe on gcetly.ac.in** (per the spec's "floating website assistant" intent): browsers only grant microphone access to an iframe if the *hosting* page's embed explicitly allows it. No code inside this app can grant that permission itself — it's a property of the `<iframe>` tag on the page that embeds it:
```html
<iframe src="https://your-deployed-assistant.example.com" allow="microphone" title="GCE-TLY AI Assistant"></iframe>
```
Without `allow="microphone"` on that tag, voice input will correctly show the "permission denied" state — that's the browser's iframe security model, not a bug in this code.

## 6. Live web search for time-sensitive questions
Questions containing words like "latest," "current," "2026-27," "notification," "deadline," or role-holder questions like "who is the principal" (see `needsCurrentInfo()` in `lib/retrieval.ts`) automatically enable Claude's server-executed `web_search` tool for that request, in addition to local knowledge-base grounding — satisfying the spec's "web search for current information" requirement without needing a separate search API key, since the search runs on Anthropic's side. A local-knowledge-base miss (nothing relevant found) *also* enables web search now, rather than going straight to the fallback message — the exact fallback sentence is still the final safety net if web search comes up empty too. Any URLs the model actually cites from live search are shown as distinct "web" source chips (gold, globe icon) alongside local "gcetly.ac.in" citations (teal, document icon) in the UI.

**Deep Research Mode:** phrases like "deep research on X," "verify this," or "search the web for X" (see `isDeepResearchRequest()`) force web search on and switch the response to a structured `## Answer / ## Key Information / ## Verification / ## Sources` format instead of the normal concise style.

**Stop generating:** the send button becomes a Stop button while streaming. Clicking it aborts the fetch client-side, which Next.js surfaces as the request's `AbortSignal` firing server-side too, which in turn cancels the in-flight Claude API call — not just a UI-level "give up listening" that leaves the request running server-side burning tokens.

## 7. What's real vs. what's a documented limitation

**Real and verified:**
- 22 hand-curated knowledge entries + 36 FAQ entries (12 with real Tamil variations), built from ~12 pages actually fetched from gcetly.ac.in, each with a source URL and last-checked date
- TF-IDF keyword retrieval engine, unit-tested with 59 passing tests including three real bugs caught and fixed during development
- Hallucination control: zero-retrieval queries get the exact spec-mandated fallback sentence, never an invented answer
- Session isolation: structural, not policy-based (see architecture section above)
- Every source `.ts`/`.tsx` file passes syntax validation (esbuild transpile check)

**Honest limitations:**
- I don't have a standing connection to gcetly.ac.in from my own environment — the ~12 pages behind the curated knowledge base were fetched directly while building this, not by running the crawler script live. The crawler code itself is complete and was validated as thoroughly as possible without live network access (its HTML-extraction and incremental-caching logic mirrors an earlier Python crawler that WAS validated against synthetic HTML in this same conversation); running it for real against the live site, on a machine with internet access, is the way to extend coverage beyond the ~12 pages already included.
- `npm install` / `next build` / `next dev` were not run end-to-end in my environment (no network access there either) — every file was syntax-checked individually and the core retrieval/language/prompt logic was actually executed and tested (see `npm test` output above), but a full Next.js build was not performed. Standard Next.js 14 App Router conventions were followed throughout.
- Keyword retrieval (not semantic/vector search) means paraphrases with zero shared vocabulary can miss — e.g. "how do I get in" without any of "admission/apply/join" won't retrieve well. The FAQ `variations` arrays exist specifically to cover the phrasings people actually use; add more as you observe real queries missing.
- Thumbs up/down feedback is local UI state only (no backend persistence) — intentional, to avoid storing any conversation content server-side, consistent with the privacy requirements in the spec.

## 8. Production deployment

Works on any Node.js host (Vercel, Railway, Fly.io, a plain VPS with `npm run build && npm start`). Notes:
- Set `ANTHROPIC_API_KEY` as a server-side environment variable on your host — never in client-visible config.
- The in-memory rate limiter (`lib/rateLimit.ts`) resets if the process restarts and doesn't share state across multiple instances/regions. Fine for a single instance; swap in a shared store (e.g., Upstash Redis) behind the same `checkRateLimit()` interface if you scale horizontally.
- Re-run `npm run crawl && npm run update-knowledge` periodically (a cron job, GitHub Action, or your host's scheduled-task feature) to keep `data/gcetly-knowledge.auto.json` current, then redeploy or restart so `lib/knowledgeStore.ts` picks up the change (it already re-reads if the file's mtime changed, without needing a full rebuild).

## 9. Project structure

```
app/
  page.tsx, layout.tsx, globals.css
  api/chat/route.ts          Main chat endpoint (streaming, stateless, grounded)
  api/session/new/route.ts   Issues a fresh session id (rate-limit bucket only)
  api/health/route.ts        Health check
  api/feedback/route.ts      v2.0: persists thumbs up/down ratings to a log file
components/
  ChatWindow.tsx              Main state + streaming + new-chat reset + voice input + local history + edit/resend
  Header.tsx                  Letterhead branding, new chat, export, language toggle, dark mode
  CollegeLogo.tsx              v2.0: the real official logo, with graceful fallback
  MessageBubble.tsx           Copy/regenerate/feedback/speak, source citations, edit affordance, follow-up chips
  QuickActions.tsx            The 12 quick-action buttons from the spec
  MarkdownLite.tsx            Dependency-free markdown rendering
lib/
  types.ts                    Shared types
  language.ts                 English/Tamil/mixed detection
  knowledgeStore.ts            Loads + merges curated/auto knowledge, FAQ (server-only, fs)
  retrieval.ts                  TF-IDF retrieval + intent detection (greeting/current-info/deep-research)
  systemPrompt.ts                Grounding rules, source-authority tiers, deep-research format, fallback text
  retryLogic.ts                   Pure retry/backoff decision logic (dependency-free, unit-tested)
  anthropic.ts                     Claude API streaming client, retry/backoff/timeout, optional web_search tool
  useVoiceInput.ts                  Voice state machine (idle/requesting/listening/processing/error)
  urlSafety.ts                      Citation URL validation (dependency-free, unit-tested)
  followUps.ts                       v2.0: rule-based suggested next questions (dependency-free, unit-tested)
  localHistory.ts                    v2.0: persistent local chat history, parsing separated for testability
  exportChat.ts                      v2.0: conversation -> Markdown export
  rateLimit.ts                       In-memory rate limiter
  chatClient.ts                       Browser-side SSE consumption + duplicate-send guard (client-only)
data/
  gcetly-knowledge.json        Hand-curated, verified knowledge base
  gcetly-faq.json               Curated FAQ with EN+TA phrasing variations
  gcetly-knowledge.auto.json     Generated by update-knowledge.ts (gitignored initially)
  feedback/                       v2.0: feedback-log.jsonl, gitignored (see app/api/feedback/route.ts)
public/
  manifest.json                v2.0: PWA manifest
scripts/
  crawlerCore.ts                Shared crawl utilities (fetch, extract, robots.txt, storage)
  crawl-gcetly.ts                 CLI: crawl the live site
  update-knowledge.ts               CLI: regenerate the auto knowledge base from a crawl
tests/
  test-questions.ts             100 tests: categories, Tamil, typos, ambiguity, hallucination control,
  greeting regression, memory isolation, retry/backoff, deep research, current-info triggers, citation
  safety, source titles, follow-ups, local-history parsing, Markdown export
```

## 10. Environment variables

See `.env.example`:
```
ANTHROPIC_API_KEY=       # required -- https://console.anthropic.com/
ANTHROPIC_MODEL=claude-sonnet-5
RATE_LIMIT_PER_MINUTE=20
```
