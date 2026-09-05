import { chromium, type Browser } from "playwright";
import { assertSafeUrl } from "@webrecon/security";
import { createLogger } from "@webrecon/logger";
import { extractDomSnapshot, extractLinks, normalizeElements } from "@webrecon/dom-inspector";
import { NetworkCapture, type CapturedNetworkRequest } from "@webrecon/network-inspector";
import { discoverAssets, type DiscoveredAsset } from "@webrecon/asset-analyzer";
import type { DomElement } from "@webrecon/types";
import { autoScroll, type AutoScrollResult } from "./auto-scroll.js";
import { resolveInternalLinks } from "./link-extractor.js";

const logger = createLogger({ name: "crawler-engine" });

export interface CrawlLimits {
  /** Hard cap on total pages visited (spec Section 10). */
  maxPages: number;
  /** Hard cap on link-following depth from the start URL. */
  maxDepth: number;
  /** Hard cap on total wall-clock crawl time. */
  maxSessionTimeMs?: number;
  /** Passed through to AutoScrollEngine per page. */
  maxScrollIterations?: number;
  /** Captured HTML is truncated beyond this size (defends against oversized responses). */
  maxResponseSizeBytes?: number;
}

export interface CrawlOptions {
  startUrl: string;
  allowedDomains: string[];
  limits: CrawlLimits;
  autoScroll?: boolean;
  /** Called after each page finishes (for job progress reporting — Phase 7). */
  onPageCrawled?: (page: CrawledPage, pagesSoFar: number) => void;
  /**
   * Checked before each page fetch; return true to stop the crawl early
   * (spec Section 35 "cancellation"). Errors from this hook are treated as
   * "don't cancel" so a flaky check never kills a crawl outright.
   */
  shouldAbort?: () => boolean | Promise<boolean>;
}

export interface CrawledPage {
  url: string;
  title: string;
  depth: number;
  html: string;
  links: string[];
  elements: DomElement[];
  styles: string[];
  scripts: string[];
  networkRequests: CapturedNetworkRequest[];
  assets: DiscoveredAsset[];
  scroll?: AutoScrollResult;
  truncated: boolean;
}

export type CrawlStoppedReason = "maxPages" | "maxSessionTime" | "cancelled" | "queue-empty";

export interface CrawlResult {
  pages: CrawledPage[];
  stoppedReason: CrawlStoppedReason;
}

interface QueueEntry {
  url: string;
  depth: number;
}

const DEFAULT_MAX_RESPONSE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export class CrawlerEngine {
  /** Optionally inject a pre-launched browser (used by tests / shared pools). */
  constructor(private readonly browserOverride?: Browser) {}

  async crawl(options: CrawlOptions): Promise<CrawlResult> {
    const browser = this.browserOverride ?? (await chromium.launch({ headless: true }));
    const context = await browser.newContext();

    const pages: CrawledPage[] = [];
    const visited = new Set<string>([options.startUrl]);
    const queue: QueueEntry[] = [{ url: options.startUrl, depth: 0 }];
    const startedAt = Date.now();
    let stoppedReason: CrawlStoppedReason = "queue-empty";

    try {
      while (queue.length > 0) {
        if (pages.length >= options.limits.maxPages) {
          stoppedReason = "maxPages";
          break;
        }
        if (
          options.limits.maxSessionTimeMs &&
          Date.now() - startedAt > options.limits.maxSessionTimeMs
        ) {
          stoppedReason = "maxSessionTime";
          break;
        }
        if (options.shouldAbort) {
          const abort = await Promise.resolve(options.shouldAbort()).catch(() => false);
          if (abort) {
            stoppedReason = "cancelled";
            break;
          }
        }

        const entry = queue.shift();
        if (!entry) break;

        try {
          await assertSafeUrl(entry.url, { allowedDomains: options.allowedDomains });
        } catch (error) {
          logger.warn({ url: entry.url, error }, "skipping disallowed URL during crawl");
          continue;
        }

        const page = await context.newPage();
        const networkCapture = new NetworkCapture();
        networkCapture.attach(page);
        try {
          await page.goto(entry.url, { waitUntil: "domcontentloaded", timeout: 30_000 });
          const title = await page.title();

          const maxSize = options.limits.maxResponseSizeBytes ?? DEFAULT_MAX_RESPONSE_SIZE_BYTES;
          let html = await page.content();
          let truncated = false;
          if (html.length > maxSize) {
            html = html.slice(0, maxSize);
            truncated = true;
            logger.warn({ url: entry.url, size: html.length }, "captured HTML truncated to size limit");
          }

          let scroll: AutoScrollResult | undefined;
          if (options.autoScroll ?? true) {
            scroll = await autoScroll(page, { maxIterations: options.limits.maxScrollIterations });
          }

          const rawLinks = await extractLinks(page);
          const links = resolveInternalLinks(page.url(), rawLinks, options.allowedDomains);

          const domSnapshot = await extractDomSnapshot(page);
          const elements = normalizeElements(domSnapshot.elements);
          const assets = await discoverAssets(page, networkCapture.getRecords());

          const crawledPage: CrawledPage = {
            url: page.url(),
            title,
            depth: entry.depth,
            html,
            links,
            elements,
            styles: domSnapshot.styles,
            scripts: domSnapshot.scripts,
            networkRequests: networkCapture.getRecords(),
            assets,
            scroll,
            truncated,
          };
          pages.push(crawledPage);
          options.onPageCrawled?.(crawledPage, pages.length);

          if (entry.depth < options.limits.maxDepth) {
            for (const link of links) {
              if (!visited.has(link)) {
                visited.add(link);
                queue.push({ url: link, depth: entry.depth + 1 });
              }
            }
          }
        } catch (error) {
          logger.warn({ url: entry.url, error }, "failed to crawl page, skipping");
        } finally {
          await page.close();
        }
      }
    } finally {
      await context.close();
      if (!this.browserOverride) {
        await browser.close();
      }
    }

    logger.info(
      { pagesCrawled: pages.length, stoppedReason, startUrl: options.startUrl },
      "crawl finished",
    );

    return { pages, stoppedReason };
  }
}
