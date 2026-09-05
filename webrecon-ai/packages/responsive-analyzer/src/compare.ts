import type {
  ResponsiveBreakpoint,
  ResponsiveDifference,
  ResponsiveElementState,
  ResponsiveViewportSnapshot,
  ViewportPreset,
} from "@webrecon/types";

// Widths used only to order snapshots and to derive an approximate
// breakpoint width when adjacent presets disagree. Kept local rather than
// re-exported from @webrecon/browser's VIEWPORT_PRESETS to avoid this
// (pure, dependency-free) module needing a runtime import for two numbers.
const VIEWPORT_WIDTH: Record<ViewportPreset, number> = {
  desktop: 1440,
  tablet: 768,
  mobile: 390,
};

const RESIZE_THRESHOLD_PX = 8; // ignore sub-pixel/rounding noise as "resized"

function diffElementPair(
  selector: string,
  from: ResponsiveElementState | undefined,
  to: ResponsiveElementState | undefined,
  fromViewport: ViewportPreset,
  toViewport: ViewportPreset,
): ResponsiveDifference | undefined {
  if (!from || !to) return undefined;

  if (from.visible && !to.visible) {
    return {
      selector,
      kind: "hidden",
      from: fromViewport,
      to: toViewport,
      detail: `${from.tag} visible at ${fromViewport}, hidden at ${toViewport}`,
    };
  }
  if (!from.visible && to.visible) {
    return {
      selector,
      kind: "shown",
      from: fromViewport,
      to: toViewport,
      detail: `${to.tag} hidden at ${fromViewport}, visible at ${toViewport}`,
    };
  }
  if (!from.visible && !to.visible) return undefined;

  const widthDelta = Math.abs(from.boundingBox.width - to.boundingBox.width);
  const heightDelta = Math.abs(from.boundingBox.height - to.boundingBox.height);
  if (widthDelta > RESIZE_THRESHOLD_PX || heightDelta > RESIZE_THRESHOLD_PX) {
    return {
      selector,
      kind: "resized",
      from: fromViewport,
      to: toViewport,
      detail: `${from.boundingBox.width}x${from.boundingBox.height} at ${fromViewport} → ${to.boundingBox.width}x${to.boundingBox.height} at ${toViewport}`,
    };
  }

  return undefined;
}

/**
 * Compares consecutive viewport snapshots (desktop→tablet, tablet→mobile)
 * element-by-element, matched by the shared `selector` produced by
 * packages/dom-inspector. Only adjacent pairs are compared — desktop vs.
 * mobile directly would just restate what desktop→tablet and tablet→mobile
 * already show, and adjacency is what "breakpoint" means.
 */
export function compareResponsiveSnapshots(
  snapshots: ResponsiveViewportSnapshot[],
): { differences: ResponsiveDifference[]; breakpoints: ResponsiveBreakpoint[] } {
  const differences: ResponsiveDifference[] = [];
  const breakpoints: ResponsiveBreakpoint[] = [];

  for (let i = 0; i < snapshots.length - 1; i += 1) {
    const wider = snapshots[i];
    const narrower = snapshots[i + 1];
    if (!wider || !narrower) continue;

    const narrowerBySelector = new Map(narrower.elements.map((el) => [el.selector, el]));
    const pairDifferences: ResponsiveDifference[] = [];

    for (const element of wider.elements) {
      const match = narrowerBySelector.get(element.selector);
      const difference = diffElementPair(
        element.selector,
        element,
        match,
        wider.viewport,
        narrower.viewport,
      );
      if (difference) pairDifferences.push(difference);
    }

    if (wider.navigationVariant && narrower.navigationVariant &&
        wider.navigationVariant !== narrower.navigationVariant) {
      pairDifferences.push({
        selector: "nav",
        kind: "reflowed",
        from: wider.viewport,
        to: narrower.viewport,
        detail: `navigation changed from "${wider.navigationVariant}" to "${narrower.navigationVariant}"`,
      });
    }

    differences.push(...pairDifferences);

    if (pairDifferences.length > 0) {
      // Approximate breakpoint: the midpoint between the two sampled preset
      // widths. This is a coarse estimate (three fixed presets, not a
      // binary search across widths) — good enough to flag "something
      // changes between tablet and mobile", not a pixel-exact breakpoint.
      const widthPx = Math.round(
        (VIEWPORT_WIDTH[wider.viewport] + VIEWPORT_WIDTH[narrower.viewport]) / 2,
      );
      breakpoints.push({
        widthPx,
        betweenViewports: [wider.viewport, narrower.viewport],
        changeCount: pairDifferences.length,
      });
    }
  }

  return { differences, breakpoints };
}
