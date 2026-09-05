import type { DomElement } from "@webrecon/types";

export interface NormalizeOptions {
  /** Hard cap on total elements kept, applied after dedup. */
  maxElements?: number;
  /** Truncates element.text beyond this length. */
  maxTextLength?: number;
}

const DEFAULTS: Required<NormalizeOptions> = {
  maxElements: 300,
  maxTextLength: 200,
};

/**
 * Shrinks a DOM element snapshot to a size safe to hand to an LLM: dedupes
 * by selector, truncates long text content, and caps the total element
 * count. Extraction-time capping (packages/dom-inspector/extractor.ts,
 * per-category limits) handles the common case; this is the second,
 * independent safety net for whatever slips through — e.g. a page with an
 * unusually large number of distinct categories.
 */
export function normalizeElements(
  elements: DomElement[],
  options: NormalizeOptions = {},
): DomElement[] {
  const config = { ...DEFAULTS, ...options };

  const seen = new Set<string>();
  const deduped: DomElement[] = [];

  for (const element of elements) {
    if (seen.has(element.selector)) continue;
    seen.add(element.selector);
    deduped.push({
      ...element,
      text: element.text ? element.text.slice(0, config.maxTextLength) : element.text,
    });
  }

  return deduped.slice(0, config.maxElements);
}
