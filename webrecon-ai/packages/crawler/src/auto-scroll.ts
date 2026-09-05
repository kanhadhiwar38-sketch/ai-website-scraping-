import type { Page } from "playwright";
import { createLogger } from "@webrecon/logger";

const logger = createLogger({ name: "auto-scroll-engine" });

export interface AutoScrollOptions {
  /** Hard cap on scroll iterations, regardless of whether content is still changing. */
  maxIterations?: number;
  /** Wait time after each scroll step for lazy-loaded content to settle. */
  stepDelayMs?: number;
  /** Consecutive no-change reads required before declaring the page "settled". */
  stableReadsRequired?: number;
}

export interface AutoScrollResult {
  iterations: number;
  startHeight: number;
  finalHeight: number;
  scrollPositions: number[];
  stoppedReason: "settled" | "max-iterations";
}

const DEFAULTS: Required<AutoScrollOptions> = {
  maxIterations: 20,
  stepDelayMs: 300,
  stableReadsRequired: 2,
};

/**
 * Scrolls the page in viewport-sized increments, capturing new content as it
 * loads (lazy images, infinite-scroll feeds, etc.), and stops once the
 * document height stops changing for `stableReadsRequired` consecutive
 * reads or `maxIterations` is hit — whichever comes first (spec Section 11:
 * "prevent infinite scrolling").
 */
export async function autoScroll(
  page: Page,
  options: AutoScrollOptions = {},
): Promise<AutoScrollResult> {
  const config = { ...DEFAULTS, ...options };

  const startHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  const scrollPositions: number[] = [];

  let lastHeight = startHeight;
  let stableReads = 0;
  let iterations = 0;
  let stoppedReason: AutoScrollResult["stoppedReason"] = "max-iterations";

  for (; iterations < config.maxIterations; iterations += 1) {
    const viewportHeight = page.viewportSize()?.height ?? 900;
    await page.evaluate((y) => window.scrollBy(0, y), viewportHeight);
    await page.waitForTimeout(config.stepDelayMs);

    const scrollY = await page.evaluate(() => window.scrollY);
    scrollPositions.push(scrollY);

    const currentHeight = await page.evaluate(() => document.documentElement.scrollHeight);

    if (currentHeight === lastHeight) {
      stableReads += 1;
      if (stableReads >= config.stableReadsRequired) {
        stoppedReason = "settled";
        iterations += 1;
        break;
      }
    } else {
      stableReads = 0;
    }
    lastHeight = currentHeight;
  }

  logger.debug(
    { startHeight, finalHeight: lastHeight, iterations, stoppedReason },
    "auto-scroll finished",
  );

  return {
    iterations,
    startHeight,
    finalHeight: lastHeight,
    scrollPositions,
    stoppedReason,
  };
}
