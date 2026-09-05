import type { BrowserContext } from "playwright";
import { VIEWPORT_PRESETS } from "@webrecon/browser";
import { extractDomSnapshot, normalizeElements } from "@webrecon/dom-inspector";
import type { ResponsiveViewportSnapshot, ViewportPreset } from "@webrecon/types";
import { createLogger } from "@webrecon/logger";

const logger = createLogger({ name: "responsive-analyzer" });

// Selectors used only to guess which navigation pattern is active at a given
// width (spec Section 19: "navigation changes"). This is a heuristic, not an
// exhaustive detector — sites that build a custom menu component without any
// of these signals won't be classified, and that's reflected by leaving
// `navigationVariant` undefined rather than guessing wrong.
const HAMBURGER_SELECTOR =
  '[class*="hamburger" i], [class*="menu-toggle" i], [aria-label*="menu" i][role="button"], button[aria-label*="menu" i]';
const HORIZONTAL_NAV_SELECTOR = 'nav a, [role="navigation"] a';

function isVisible(boundingBox: { width: number; height: number } | undefined): boolean {
  return Boolean(boundingBox && boundingBox.width > 0 && boundingBox.height > 0);
}

/**
 * Loads `url` at a single viewport preset and captures document height plus
 * a normalized element snapshot (selector, tag, bounding box) that can later
 * be compared across viewports. Opens a fresh page per viewport, same
 * rationale as screenshot-engine: some responsive behavior only initializes
 * on a real load at that width, not on an in-page resize.
 */
export async function collectResponsiveSnapshot(
  context: BrowserContext,
  url: string,
  viewport: ViewportPreset,
  navigationTimeoutMs = 30_000,
): Promise<ResponsiveViewportSnapshot> {
  const dimensions = VIEWPORT_PRESETS[viewport];
  const page = await context.newPage();

  try {
    await page.setViewportSize(dimensions);
    await page.goto(url, { waitUntil: "networkidle", timeout: navigationTimeoutMs });

    const documentHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    const domSnapshot = await extractDomSnapshot(page);
    const elements = normalizeElements(domSnapshot.elements);

    const hamburgerVisible = await page
      .locator(HAMBURGER_SELECTOR)
      .first()
      .isVisible()
      .catch(() => false);
    const horizontalNavLinkCount = await page.locator(HORIZONTAL_NAV_SELECTOR).count();

    let navigationVariant: string | undefined;
    if (hamburgerVisible) navigationVariant = "hamburger-menu";
    else if (horizontalNavLinkCount > 0) navigationVariant = "horizontal-nav";

    return {
      viewport,
      width: dimensions.width,
      height: dimensions.height,
      documentHeight,
      navigationVariant,
      elements: elements.map((element) => ({
        selector: element.selector,
        tag: element.tag,
        visible: isVisible(element.boundingBox),
        boundingBox: element.boundingBox ?? { x: 0, y: 0, width: 0, height: 0 },
      })),
    };
  } catch (error) {
    logger.warn({ url, viewport, error }, "failed to collect responsive snapshot");
    return {
      viewport,
      width: dimensions.width,
      height: dimensions.height,
      documentHeight: 0,
      elements: [],
    };
  } finally {
    await page.close();
  }
}

const ALL_VIEWPORTS: ViewportPreset[] = ["desktop", "tablet", "mobile"];

/** Collects snapshots for every configured viewport, largest first (desktop → mobile). */
export async function collectAllResponsiveSnapshots(
  context: BrowserContext,
  url: string,
  viewports: ViewportPreset[] = ALL_VIEWPORTS,
): Promise<ResponsiveViewportSnapshot[]> {
  const snapshots: ResponsiveViewportSnapshot[] = [];
  for (const viewport of viewports) {
    snapshots.push(await collectResponsiveSnapshot(context, url, viewport));
  }
  return snapshots;
}
