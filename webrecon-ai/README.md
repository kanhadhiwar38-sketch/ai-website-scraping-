# WebRecon AI

Browser inspection, scraping, and AI-rebuild platform. See `implementation_plan.md`
for architecture, schema, and phase sequencing.

> **Scope note:** WebRecon AI only inspects websites you own or are authorized to
> analyze. It does not implement auth/CAPTCHA/paywall/DRM bypass, credential or
> cookie theft, private API exploitation, or unauthorized access of any kind.

## Status

**Phase 7 of 15 complete** (Phase 1: auth/dashboard/Firestore; Phase 2: Playwright
BrowserSessionManager; Phase 3: CrawlerEngine + AutoScrollEngine + link discovery +
page storage; Phase 4: DOM Inspector; Phase 5: Network Inspector; Phase 6: Asset
Discovery + Screenshot Engine + Responsive Analyzer; Phase 7: Redis + BullMQ
background job system). See `implementation_plan.md` for the full phase list.

**Phase 7** wires the whole pipeline together:
- `POST /projects/:id/analyze` enqueues a `crawl` job and returns `{jobId, status}`
  immediately (spec Section 8/35 — no crawling inside the HTTP request).
- The `crawl` worker (`apps/browser-worker`) runs CrawlerEngine end-to-end (pages +
  DOM + network + assets in one pass), persists everything, then chains
  `network-analysis`, `asset-analysis`, and `screenshot` jobs automatically.
- `network-analysis`/`asset-analysis` workers aggregate already-stored data into
  `network-report.json`/`asset-report.json` exports (Firebase Storage).
- `screenshot` worker captures desktop/tablet/mobile shots for the project's start
  page.
- `ai-analysis`, `project-generation`, `visual-test` queues exist (so the plumbing
  is uniform) but fail fast with a clear "not implemented until Phase X" message —
  their engines land in Phases 9–12.
- `GET /jobs/:id`, `POST /jobs/:id/cancel`, `WS /ws/jobs/:id` for status/cancellation/
  live updates. Every queue has retries (3, exponential backoff), a hard per-job
  timeout, and a bounded concurrency limit.

Run Redis locally with `docker compose up -d redis`, then start the worker alongside
the API: `pnpm --filter @webrecon/browser-worker dev`.

> **Note on Playwright browsers:** `pnpm install` installs the Playwright *library*.
> The actual Chromium binary is downloaded separately via `npx playwright install
> chromium` (or `--with-deps chromium` on Linux CI) — run that once before starting
> `apps/api` or invoking `CrawlerEngine`/`BrowserSessionManager`. This download
> requires network access to Playwright's CDN, which may need to be allowlisted in
> restricted environments.
>
> The crawler itself (`packages/crawler`) is not yet wired to an HTTP route — per
> spec Section 8, long-running crawls must not run inside an HTTP request/response
> cycle. It will be triggered via the BullMQ `crawl` queue introduced in Phase 7.

## Monorepo layout

```
apps/
  web/            Next.js dashboard (Firebase auth, projects UI)
  api/             Fastify REST API (Firebase Admin, Firestore-backed)
  browser-worker/  BullMQ job consumer — crawl/network-analysis/asset-analysis/
                   screenshot processors (Phase 7, done); ai-analysis/
                   project-generation/visual-test are registered but stubbed
                   until Phases 9-12
  mcp-server/      MCP server for coding-agent integration (Phase 11+, not yet implemented)
packages/
  types/           Shared Zod schemas — single source of truth for every persisted shape
  shared/          Framework-free error classes, Result type, id generation
  firebase/        Firebase client/admin SDK init, Firestore/Storage path helpers
  logger/          Structured logger (pino) with mandatory secret redaction
  security/        SSRF guard + secret redaction + rate limiter
  browser/         Playwright BrowserSessionManager — isolated BrowserContext per
                   session, SSRF-checked navigation, session expiry (Phase 2, done)
  crawler/         CrawlerEngine + AutoScrollEngine + link discovery + Firestore
                   page storage (Phase 3, done)
  dom-inspector/   DOM element extraction, HTML extraction, link extraction,
                   DOM-tree normalization for AI processing (Phase 4, done)
  network-inspector/ Request/response capture, secret redaction integration,
                   resourceType classification, public API schema summarization
                   (Phase 5, done)
  asset-analyzer/  Asset discovery from DOM + network traffic, Firestore storage
                   (Phase 6, done)
  screenshot-engine/ Desktop/tablet/mobile screenshot capture, Firebase Storage
                   upload (Phase 6, done)
  responsive-analyzer/ Per-viewport DOM snapshots, cross-viewport diffing,
                   responsive-analysis.json export (Phase 6, done)
  jobs/            BullMQ queue definitions, Firestore job-lifecycle tracking,
                   retry/backoff/timeout/concurrency config (Phase 7, done)
  ai, ai-providers, ai-router,
  mcp-tools/       Scaffolded, implemented in later phases per implementation_plan.md
infrastructure/    Docker, Redis config (later phases)
docs/              Architecture/API/security docs (later phases)
```

## Local development (Phase 1)

### Prerequisites
- Node.js >= 20
- pnpm (`npm install -g pnpm`)
- A Firebase project with Authentication (Email/Password + Google) and Firestore enabled
- A Firebase service-account key (for the API server)

### Setup

```bash
pnpm install
cp .env.example .env.local   # fill in Firebase + other values, see below
```

Populate `.env.local` (or your shell env) with:
- `NEXT_PUBLIC_FIREBASE_*` — from your Firebase project's web app config
  (Firebase Console → Project settings → General → Your apps)
- `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`,
  `FIREBASE_STORAGE_BUCKET` — from a service-account JSON key
  (Firebase Console → Project settings → Service accounts → Generate new private key)

### Run

```bash
# Terminal 1 — Redis (required by the BullMQ job queue, Phase 7)
docker compose up -d redis

# Terminal 2 — API (Fastify, port 4000 by default)
pnpm --filter @webrecon/api dev

# Terminal 3 — Browser worker (BullMQ job consumer — crawl, screenshots, etc.)
pnpm --filter @webrecon/browser-worker dev

# Terminal 4 — Web (Next.js, port 3000 by default)
pnpm --filter @webrecon/web dev
```

Open http://localhost:3000 — sign up/in, create a project, then use "Start analysis"
(calls `POST /projects/:id/analyze`) to enqueue a real crawl. Watch progress via
`GET /jobs/:id` or the `WS /ws/jobs/:id` endpoint.

### Verify

```bash
pnpm -w typecheck   # all 8 workspace projects
pnpm -w lint        # apps/web (next lint) + apps/api (eslint)
pnpm -w test        # vitest across all packages
```

## AI provider setup, OpenRouter setup, MCP setup, Claude Code integration,
## Docker, production deployment

Not applicable yet — these are introduced in Phases 8–15 and this README will be
updated with each phase's setup instructions as they land.
