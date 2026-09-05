import type { Page } from "playwright";
import type { DomElement } from "@webrecon/types";

export interface DomExtractionResult {
  elements: DomElement[];
  /** External stylesheet hrefs (not inline <style> contents). */
  styles: string[];
  /** External script srcs (not inline script contents). */
  scripts: string[];
}

export interface DomExtractionOptions {
  /** Max elements collected per category before capping (spec Section 12 categories). */
  maxPerCategory?: number;
}

const CATEGORY_SELECTORS: Record<string, string> = {
  heading: "h1, h2, h3, h4, h5, h6",
  button: 'button, [role="button"], input[type="button"], input[type="submit"]',
  link: "a[href]",
  form: "form",
  input: "input, textarea, select",
  image: "img",
  video: "video",
  navigation: 'nav, [role="navigation"]',
  card: '[class*="card" i]',
  table: "table",
  dialog: 'dialog, [role="dialog"], [aria-modal="true"]',
};

// Attributes worth surfacing to the AI analyzer without dumping every
// attribute on every element (spec Section 12: "normalize ... before AI
// processing" — this is the extraction-time half of that normalization).
const RELEVANT_ATTRIBUTES = [
  "href",
  "src",
  "alt",
  "type",
  "name",
  "placeholder",
  "role",
  "aria-label",
  "title",
  "for",
  "value",
];

const MAX_TEXT_LENGTH = 200;

/**
 * Extracts a structured, size-bounded snapshot of the page's interactive
 * and semantic elements, plus a list of external stylesheet/script URLs.
 * Runs entirely inside the page context (page.evaluate) so it only sees
 * what's rendered to the browser — never server-side source.
 */
export async function extractDomSnapshot(
  page: Page,
  options: DomExtractionOptions = {},
): Promise<DomExtractionResult> {
  const maxPerCategory = options.maxPerCategory ?? 40;

  return page.evaluate(
    ({ categorySelectors, relevantAttributes, maxTextLength, maxPerCategory: maxPer }) => {
      function buildSelector(element: Element): string {
        if (element.id) return `#${element.id}`;

        const parts: string[] = [];
        let current: Element | null = element;
        let depth = 0;

        while (current && current !== document.body && depth < 5) {
          let part = current.tagName.toLowerCase();
          const parent: Element | null = current.parentElement;
          if (parent) {
            const siblings: Element[] = Array.from(parent.children).filter(
              (sibling: Element) => sibling.tagName === current!.tagName,
            );
            if (siblings.length > 1) {
              const index = siblings.indexOf(current) + 1;
              part += `:nth-of-type(${index})`;
            }
          }
          parts.unshift(part);
          current = parent;
          depth += 1;
        }

        return parts.join(" > ");
      }

      function toDomElement(element: Element): DomElementLite {
        const rect = element.getBoundingClientRect();
        const attributes: Record<string, string> = {};
        for (const attributeName of relevantAttributes) {
          const value = element.getAttribute(attributeName);
          if (value !== null) attributes[attributeName] = value;
        }

        const text = (element.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, maxTextLength);

        return {
          tag: element.tagName.toLowerCase(),
          id: element.id || undefined,
          classes: Array.from(element.classList),
          text: text || undefined,
          attributes,
          boundingBox: {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          },
          selector: buildSelector(element),
          role: element.getAttribute("role") ?? undefined,
        };
      }

      interface DomElementLite {
        tag: string;
        id?: string;
        classes: string[];
        text?: string;
        attributes: Record<string, string>;
        boundingBox: { x: number; y: number; width: number; height: number };
        selector: string;
        role?: string;
      }

      const collected: DomElementLite[] = [];
      const seenSelectors = new Set<string>();

      for (const selector of Object.values(categorySelectors)) {
        const matches = Array.from(document.querySelectorAll(selector)).slice(0, maxPer);
        for (const match of matches) {
          const domElement = toDomElement(match);
          if (seenSelectors.has(domElement.selector)) continue;
          seenSelectors.add(domElement.selector);
          collected.push(domElement);
        }
      }

      const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"][href]'))
        .map((el) => (el as HTMLLinkElement).href)
        .filter(Boolean);

      const scripts = Array.from(document.querySelectorAll("script[src]"))
        .map((el) => (el as HTMLScriptElement).src)
        .filter(Boolean);

      return { elements: collected, styles, scripts };
    },
    {
      categorySelectors: CATEGORY_SELECTORS,
      relevantAttributes: RELEVANT_ATTRIBUTES,
      maxTextLength: MAX_TEXT_LENGTH,
      maxPerCategory,
    },
  );
}
