# WebRecon AI — Implementation Plan

## 1. Purpose & Scope
WebRecon AI inspects websites the user owns or is authorized to analyze (DOM, HTML,
browser-observable network traffic, public assets, responsive behavior), stores the
results, runs AI analysis to produce an implementation plan, and drives a coding agent
(via MCP) to produce an **independent reimplementation**, iterating against visual diffs.

Explicitly out of scope (never implemented, at any phase):
auth/CAPTCHA/paywall/DRM bypass, credential/cookie theft, private API exploitation,
server-side source extraction, secret/env exfiltration, vulnerability exploitation,
unauthorized access of any kind, use as a general SSRF proxy.

## 2. Monorepo Layout
See root tree below (`pnpm` workspaces + `turbo`-free simple scripts to start; Turborepo
can be added later without changing package boundaries).

```
webrecon-ai/
  apps/{web,api,browser-worker,mcp-server}
  packages/{shared,types,firebase,browser,crawler,network-inspector,
            dom-inspector,asset-analyzer,screenshot-engine,
            responsive-analyzer,ai,ai-providers,ai-router,
            mcp-tools,security,logger}
  infrastructure/{docker,redis}
  docs/
```

## 3. Package Responsibilities
- **types**: shared Zod schemas + inferred TS types (Project, BrowserSession, Page,
  NetworkRequest, Asset, Screenshot, Job, AIAnalysis, ImplementationPlan,
  GeneratedProject, AIProvider, AIUsage, ApiKey). Single source of truth — every other
  package imports from here, never redefines shapes.
- **shared**: cross-cutting utilities (result types, error classes, id generation, URL
  validation helpers) with no framework dependency.
- **firebase**: two entry points — `firebase/client` (safe for `apps/web`, uses public
  config) and `firebase/admin` (server-only, service-account init, used by `apps/api`
  and `apps/browser-worker`). The admin entry throws if imported in a browser bundle.
- **logger**: structured JSON logger (pino) with a redaction list applied at the
  transport level so secrets can never leak into logs regardless of call site.
- **security**: SSRF guard (DNS resolution + private/link-local/metadata IP blocking,
  redirect re-validation), secret-pattern redaction, domain allowlist enforcement, rate
  limiter primitives. Used by `browser-worker`, `network-inspector`, and `api`.
- **browser**: `BrowserSessionManager` wrapping Playwright `BrowserContext` lifecycle.
- **crawler / dom-inspector / network-inspector / asset-analyzer /
  screenshot-engine / responsive-analyzer**: single-responsibility analysis modules
  consumed by `browser-worker` jobs; each returns typed, already-redacted data.
- **ai / ai-providers / ai-router**: provider-independent AI Gateway (Section 20 of the
  spec). `ai-providers` implements the OpenAI-compatible + OpenRouter clients;
  `ai-router` implements AUTO/FREE/BEST_CODING/CUSTOM selection and fallback; `ai`
  exposes task-oriented functions (analyzeWebsite, planImplementation, reviewDiff...).
- **mcp-tools**: tool schemas + handlers shared between `apps/mcp-server` and internal
  validation, so the MCP surface and the REST surface can't drift apart.

## 4. Firestore Schema (Section 5/6 of spec)
Collections: `users`, `projects`, `browserSessions`, `pages`, `networkRequests`,
`assets`, `screenshots`, `jobs`, `aiAnalyses`, `implementationPlans`,
`generatedProjects`, `aiProviders`, `aiUsage`, `apiKeys`.

Every document carries `userId`; Firestore security rules (added in Phase 1) restrict
reads/writes to `request.auth.uid == resource.data.userId`, with `apiKeys` additionally
storing only a bcrypt/sha256 hash, never the raw key. Storage paths mirror
`/users/{userId}/projects/{projectId}/...` per spec Section 6.

## 5. API Contracts (Section 36)
Fastify app, Zod-validated request/response schemas generated from `packages/types`.
All long-running work (`POST /projects/:id/analyze`, rebuild, visual-test) enqueues a
BullMQ job and returns `{ jobId, status: "queued" }` immediately — no crawling inside
the HTTP request/response cycle. Job status/streaming via `GET /jobs/:id` and
`WS /ws/jobs/:jobId`.

## 6. MCP Tool Surface (Section 31)
Tools are 1:1 wrappers around REST capabilities (browser_*, project_*) implemented once
in `packages/mcp-tools` and exposed identically via `apps/mcp-server` (stdio/SSE) and
internally to `apps/api`. Every tool call is validated against the same domain
allowlist and SSRF guard as the REST API — MCP is not a side-channel that skips
security.

## 7. AI Routing Strategy (Sections 20–29)
`AIProvider` interface → `AIProviderRegistry` (OpenRouter built-in + N custom
OpenAI-compatible providers) → `AIModelRegistry` (dynamic capability discovery, cached
with TTL) → `AIRouter.select(mode, taskType, constraints)`:
- **FREE**: filters to zero-cost models only (OpenRouter `:free` suffix / provider-
  reported $0 pricing); never silently falls back to a paid model.
- **BEST_CODING**: filters to coding-capable models, ranks by a configurable scoring
  function (coding, reasoning, context length, tool-calling, structured output).
- **AUTO**: scores across task type + capability + cost + availability.
- **CUSTOM**: pinned provider/model, no substitution.
Fallback chains stay inside the selected mode's candidate set — CUSTOM never falls back
to a different provider; FREE never falls back to a paid one.

## 8. Security Model (Section 37–39)
SSRF guard resolves and re-checks IPs (including after redirects) against RFC1918,
link-local, loopback, and cloud-metadata (169.254.169.254 etc.) ranges. Every project
stores `allowedDomains`; the crawler and browser tool calls reject navigation outside
that set. Secret redaction runs at capture time (network-inspector) before anything
reaches Firestore, logs, or the AI Gateway — not just at display time. API key auth
compares a hash; provider AI keys live only in server env / Firestore (server-only
collection, never returned to the client). Rate limits are per-user, configurable, and
enforced at the API gateway layer.

## 9. Background Jobs (Section 35)
Redis + BullMQ queues: `crawl`, `network-analysis`, `asset-analysis`, `screenshot`,
`ai-analysis`, `project-generation`, `visual-test`. Each queue has its own concurrency
limit, retry/backoff policy, and timeout; progress is published over the job's
WebSocket channel.

## 10. Testing Strategy (Section 48)
- Unit (Vitest): URL validation, SSRF guard, secret redaction, AI router mode
  selection/fallback, MCP tool validation.
- Integration: Fastify routes against a Firebase emulator + Redis test instance;
  BullMQ job processing end-to-end with a mock website fixture (no real network calls
  in CI).
- E2E (Playwright): full workflow against a local fixture site (Section 48's flow),
  never against third-party production sites in automated test runs.

## 11. Phase Sequencing
Phases exactly as specified in the master prompt, Section 51. This document is
Phase 0 deliverable #2 (repo inspected — empty — plan written). Phase 1 follows
immediately below in this same session.

## 12. Phase 1 Definition of Done
- Monorepo builds (`pnpm -w typecheck`) with no TS errors.
- Lint passes (`pnpm -w lint`) with no critical errors.
- `apps/web`: Next.js + Tailwind dashboard shell, Firebase client auth (email/password
  + Google), protected routes, empty-state Projects page.
- `apps/api`: Fastify server, Firebase Admin init, Firestore-backed `users`/`projects`
  read endpoints, Zod validation, structured error format, health check.
- `packages/types`, `packages/firebase`, `packages/shared`, `packages/logger` fully
  implemented (later phases only add to them).
- Unit tests for URL/domain validation and the Zod schemas pass under Vitest.
- `.env.example` documents every variable needed to run Phase 1 locally against a real
  Firebase project.

## 13. Phase 6 Definition of Done (Asset Discovery, Screenshots, Responsive Analysis)
- `packages/asset-analyzer`: `discoverAssetsFromDom` (images, favicon, external CSS/JS,
  video, external SVG — DOM-observed only), `enrichAssetsFromNetwork` (adds fonts only
  visible via network traffic, fills `mimeType`/`sizeBytes` from response headers,
  never overwrites DOM-known metadata, never invents assets the browser didn't
  request), `storeAssets` (Firestore batch write, deduped by URL per page).
- `packages/screenshot-engine`: `captureScreenshotSet` (fresh page per viewport preset —
  desktop 1440x900 / tablet 768x1024 / mobile 390x844 — full-page + viewport PNG each),
  `storeScreenshots` (binary → Firebase Storage under
  `users/{userId}/projects/{projectId}/screenshots/`, metadata → Firestore
  `screenshots` collection), `getScreenshotSignedUrl` for UI display.
- `packages/responsive-analyzer`: `collectResponsiveSnapshot` (per-viewport DOM
  snapshot + a heuristic navigation-variant guess: hamburger vs horizontal nav),
  `compareResponsiveSnapshots` (adjacent-viewport diffing by shared `selector`:
  hidden/shown/resized/nav-reflow, plus an approximate breakpoint width — a coarse
  midpoint between the two sampled preset widths, not a binary-searched exact value),
  `buildResponsiveAnalysis`/`exportResponsiveAnalysis` (writes
  `responsive-analysis-{pageId}.json` to Storage's `reports/` path per Section 19/44 —
  deliberately NOT a new Firestore collection, since Section 5's schema is fixed).
- `packages/types`: added the missing `AssetType` type export, plus
  `ResponsiveElementState` / `ResponsiveViewportSnapshot` / `ResponsiveDifference` /
  `ResponsiveBreakpoint` / `ResponsiveAnalysis` schemas.
- `apps/api`: `GET /projects/:id/assets` and `GET /projects/:id/screenshots` (Section 36).
- All new logic covered by Vitest (asset/network merge rules, viewport-diff rules);
  Zod schema round-trips covered in `packages/types`.
- `pnpm -w typecheck`, `pnpm -w lint`, `pnpm -w test` all pass with zero errors across
  all 15 workspace projects (75 tests total, no failures).
- Not yet wired into `apps/browser-worker` / BullMQ — that's Phase 7 (background job
  system), which is what will actually invoke these three packages during a crawl.
