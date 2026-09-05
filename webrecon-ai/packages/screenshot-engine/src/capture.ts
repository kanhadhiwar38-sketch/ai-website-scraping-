import type { BrowserContext, Page } from "playwright";
import { VIEWPORT_PRESETS } from "@webrecon/browser";
import type { ViewportPreset } from "@webrecon/types";
import { createLogger } from "@webrecon/logger";

const logger = createLogger({ name: "screenshot-engine" });

export interface CapturedScreenshot {
  viewport: ViewportPreset;
  fullPage: boolean;
  buffer: Buffer;
  capturedAt: string;
}

export interface CaptureScreenshotSetOptions {
  /** Which presets to capture. Defaults to all three (spec Section 18). */
  viewports?: ViewportPreset[];
  /** Also capture a viewport-only (non-full-page) shot per preset. Defaults to true. */
  includeViewportOnly?: boolean;
  navigationTimeoutMs?: number;
}

const ALL_VIEWPORTS: ViewportPreset[] = ["desktop", "tablet", "mobile"];

/**
 * Captures full-page and viewport screenshots at each configured preset
 * width for a single URL. Opens one page per viewport (rather than resizing
 * a shared page) so viewport-triggered layout/JS (e.g. a mobile menu that
 * only initializes below a breakpoint) reflects a real fresh load, matching
 * how a real visitor would see each breakpoint.
 */
export async function captureScreenshotSet(
  context: BrowserContext,
  url: string,
  options: CaptureScreenshotSetOptions = {},
): Promise<CapturedScreenshot[]> {
  const viewports = options.viewports ?? ALL_VIEWPORTS;
  const includeViewportOnly = options.includeViewportOnly ?? true;
  const results: CapturedScreenshot[] = [];

  for (const viewport of viewports) {
    const page = await context.newPage();
    try {
      await page.setViewportSize(VIEWPORT_PRESETS[viewport]);
      await page.goto(url, {
        waitUntil: "networkidle",
        timeout: options.navigationTimeoutMs ?? 30_000,
      });

      const fullPageBuffer = await page.screenshot({ fullPage: true, type: "png" });
      results.push({
        viewport,
        fullPage: true,
        buffer: fullPageBuffer,
        capturedAt: new Date().toISOString(),
      });

      if (includeViewportOnly) {
        const viewportBuffer = await page.screenshot({ fullPage: false, type: "png" });
        results.push({
          viewport,
          fullPage: false,
          buffer: viewportBuffer,
          capturedAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      logger.warn({ url, viewport, error }, "failed to capture screenshot for viewport");
    } finally {
      await page.close();
    }
  }

  return results;
}

/** Captures both screenshot variants for a single already-open page at its current viewport. */
export async function captureCurrentPage(
  page: Page,
  viewport: ViewportPreset,
  fullPage = false,
): Promise<CapturedScreenshot> {
  const buffer = await page.screenshot({ fullPage, type: "png" });
  return { viewport, fullPage, buffer, capturedAt: new Date().toISOString() };
}
