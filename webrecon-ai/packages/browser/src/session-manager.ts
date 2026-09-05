import {
  chromium,
  type Browser,
  type BrowserContext,
  type Page,
} from "playwright";
import { NotFoundError, generateId, nowIso } from "@webrecon/shared";
import { assertSafeUrl } from "@webrecon/security";
import { createLogger } from "@webrecon/logger";
import {
  extractDomSnapshot,
  extractLinks,
  extractRenderedHtml,
  normalizeElements,
  type DomExtractionResult,
  type ExtractedLink,
} from "@webrecon/dom-inspector";
import {
  NetworkCapture,
  summarizeApiRequests,
  type ApiSummaryEntry,
  type CapturedNetworkRequest,
} from "@webrecon/network-inspector";
import type { BrowserSessionStatus, ViewportPreset } from "@webrecon/types";

const logger = createLogger({ name: "browser-session-manager" });

export const VIEWPORT_PRESETS: Record<ViewportPreset, { width: number; height: number }> = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 390, height: 844 },
};

export interface CreateSessionInput {
  userId: string;
  projectId: string;
  /** Domains this session is permitted to navigate to (spec Section 38). */
  allowedDomains: string[];
  viewport?: { width: number; height: number };
  /** Milliseconds before the session is auto-closed. Defaults to MAX_BROWSER_TIME env or 3 min. */
  maxSessionTimeMs?: number;
}

export interface SessionInfo {
  id: string;
  userId: string;
  projectId: string;
  status: BrowserSessionStatus;
  currentUrl?: string;
  viewport: { width: number; height: number };
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
}

interface SessionRecord extends SessionInfo {
  context: BrowserContext;
  page: Page;
  allowedDomains: string[];
  expiryTimer: NodeJS.Timeout;
  networkCapture: NetworkCapture;
}

function toSessionInfo(record: SessionRecord): SessionInfo {
  const {
    context: _context,
    page: _page,
    expiryTimer: _timer,
    allowedDomains: _domains,
    networkCapture: _networkCapture,
    ...info
  } = record;
  return info;
}

const DEFAULT_MAX_SESSION_TIME_MS = 3 * 60 * 1000;

/**
 * Manages isolated Playwright BrowserContexts, one per user-facing "browser
 * session" (spec Section 9). A single shared Chromium process is reused
 * across sessions; isolation between sessions/users comes from separate
 * BrowserContexts, not separate browser processes — this keeps resource use
 * bounded (spec Section 37: "protect against browser resource exhaustion").
 */
export class BrowserSessionManager {
  private browser: Browser | undefined;
  private readonly sessions = new Map<string, SessionRecord>();

  private async getBrowser(): Promise<Browser> {
    if (this.browser?.isConnected()) return this.browser;
    this.browser = await chromium.launch({ headless: true });
    return this.browser;
  }

  async create(input: CreateSessionInput): Promise<SessionInfo> {
    const browser = await this.getBrowser();
    const viewport = input.viewport ?? VIEWPORT_PRESETS.desktop;
    const maxSessionTimeMs = input.maxSessionTimeMs ?? DEFAULT_MAX_SESSION_TIME_MS;

    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const networkCapture = new NetworkCapture();
    networkCapture.attach(page);

    const id = generateId("session");
    const now = nowIso();
    const expiresAt = new Date(Date.now() + maxSessionTimeMs).toISOString();

    const expiryTimer = setTimeout(() => {
      logger.warn({ sessionId: id }, "session exceeded max session time, closing");
      void this.close(id);
    }, maxSessionTimeMs);

    const record: SessionRecord = {
      id,
      userId: input.userId,
      projectId: input.projectId,
      status: "ready",
      viewport,
      createdAt: now,
      updatedAt: now,
      expiresAt,
      context,
      page,
      allowedDomains: input.allowedDomains,
      expiryTimer,
      networkCapture,
    };

    this.sessions.set(id, record);
    logger.info({ sessionId: id, projectId: input.projectId }, "browser session created");
    return toSessionInfo(record);
  }

  private getRecord(sessionId: string): SessionRecord {
    const record = this.sessions.get(sessionId);
    if (!record) throw new NotFoundError(`Browser session not found: ${sessionId}`);
    return record;
  }

  private touch(record: SessionRecord) {
    record.updatedAt = nowIso();
  }

  async navigate(sessionId: string, url: string): Promise<SessionInfo> {
    const record = this.getRecord(sessionId);
    await assertSafeUrl(url, { allowedDomains: record.allowedDomains });
    record.status = "busy";
    await record.page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    record.currentUrl = record.page.url();
    record.status = "ready";
    this.touch(record);
    return toSessionInfo(record);
  }

  async reload(sessionId: string): Promise<SessionInfo> {
    const record = this.getRecord(sessionId);
    await record.page.reload({ waitUntil: "domcontentloaded", timeout: 30_000 });
    this.touch(record);
    return toSessionInfo(record);
  }

  async back(sessionId: string): Promise<SessionInfo> {
    const record = this.getRecord(sessionId);
    await record.page.goBack({ waitUntil: "domcontentloaded", timeout: 30_000 });
    record.currentUrl = record.page.url();
    this.touch(record);
    return toSessionInfo(record);
  }

  async forward(sessionId: string): Promise<SessionInfo> {
    const record = this.getRecord(sessionId);
    await record.page.goForward({ waitUntil: "domcontentloaded", timeout: 30_000 });
    record.currentUrl = record.page.url();
    this.touch(record);
    return toSessionInfo(record);
  }

  async click(sessionId: string, selector: string): Promise<SessionInfo> {
    const record = this.getRecord(sessionId);
    await record.page.click(selector, { timeout: 10_000 });
    this.touch(record);
    return toSessionInfo(record);
  }

  async type(sessionId: string, selector: string, text: string): Promise<SessionInfo> {
    const record = this.getRecord(sessionId);
    await record.page.fill(selector, text, { timeout: 10_000 });
    this.touch(record);
    return toSessionInfo(record);
  }

  async hover(sessionId: string, selector: string): Promise<SessionInfo> {
    const record = this.getRecord(sessionId);
    await record.page.hover(selector, { timeout: 10_000 });
    this.touch(record);
    return toSessionInfo(record);
  }

  async scroll(sessionId: string, deltaY: number): Promise<SessionInfo> {
    const record = this.getRecord(sessionId);
    await record.page.mouse.wheel(0, deltaY);
    this.touch(record);
    return toSessionInfo(record);
  }

  /** Returns a PNG screenshot as a base64 string. */
  async screenshot(sessionId: string, fullPage = false): Promise<string> {
    const record = this.getRecord(sessionId);
    const buffer = await record.page.screenshot({ fullPage, type: "png" });
    this.touch(record);
    return buffer.toString("base64");
  }

  async getPageInfo(sessionId: string): Promise<{
    url: string;
    title: string;
    viewport: { width: number; height: number } | null;
  }> {
    const record = this.getRecord(sessionId);
    return {
      url: record.page.url(),
      title: await record.page.title(),
      viewport: record.page.viewportSize(),
    };
  }

  getSessionInfo(sessionId: string): SessionInfo {
    return toSessionInfo(this.getRecord(sessionId));
  }

  /** Rendered HTML of the current page (spec Section 13 GET /page/html). */
  async getHtml(sessionId: string): Promise<string> {
    const record = this.getRecord(sessionId);
    return extractRenderedHtml(record.page);
  }

  /** Normalized DOM element snapshot + stylesheet/script inventory (Section 12/13). */
  async getDom(sessionId: string): Promise<DomExtractionResult> {
    const record = this.getRecord(sessionId);
    const snapshot = await extractDomSnapshot(record.page);
    return { ...snapshot, elements: normalizeElements(snapshot.elements) };
  }

  /** Raw anchor list, unfiltered (spec Section 13 GET /page/links). */
  async getLinks(sessionId: string): Promise<ExtractedLink[]> {
    const record = this.getRecord(sessionId);
    return extractLinks(record.page);
  }

  /** Captured + redacted network requests for this session (spec Section 14). */
  getNetworkRequests(sessionId: string): CapturedNetworkRequest[] {
    const record = this.getRecord(sessionId);
    return record.networkCapture.getRecords();
  }

  /** Public/client-observable API summary derived from captured traffic (Section 16). */
  getApiSummary(sessionId: string): ApiSummaryEntry[] {
    const record = this.getRecord(sessionId);
    return summarizeApiRequests(record.networkCapture.getRecords());
  }

  async close(sessionId: string): Promise<void> {
    const record = this.sessions.get(sessionId);
    if (!record) return;
    clearTimeout(record.expiryTimer);
    this.sessions.delete(sessionId);
    try {
      await record.context.close();
    } catch (error) {
      logger.warn({ sessionId, error }, "error closing browser context");
    }
    logger.info({ sessionId }, "browser session closed");
  }

  /** Closes every open session and the shared browser process. Call on server shutdown. */
  async shutdown(): Promise<void> {
    await Promise.all(Array.from(this.sessions.keys()).map((id) => this.close(id)));
    if (this.browser?.isConnected()) {
      await this.browser.close();
    }
  }

  listActiveSessionIds(): string[] {
    return Array.from(this.sessions.keys());
  }
}

let sharedManager: BrowserSessionManager | undefined;

/** Process-wide singleton, shared across all API routes. */
export function getBrowserSessionManager(): BrowserSessionManager {
  if (!sharedManager) sharedManager = new BrowserSessionManager();
  return sharedManager;
}
