import type { Asset, DomElement, Page } from "@webrecon/types";
import type { ApiSummaryEntry } from "@webrecon/network-inspector";

export interface PageContextSummary {
  url: string;
  title?: string;
  depth: number;
  headings: string[];
  navText: string[];
  counts: Record<string, number>;
  externalStyles: number;
  externalScripts: number;
  outboundLinkCount: number;
}

const CATEGORY_TAGS: Record<string, string> = {
  h1: "heading",
  h2: "heading",
  h3: "heading",
  h4: "heading",
  h5: "heading",
  h6: "heading",
  a: "link",
  form: "form",
  input: "input",
  textarea: "input",
  select: "input",
  img: "image",
  video: "video",
  table: "table",
  nav: "navigation",
  dialog: "dialog",
  button: "button",
};

function classify(element: DomElement): string {
  if (element.role === "navigation") return "navigation";
  if (element.role === "dialog") return "dialog";
  if (element.role === "button") return "button";
  return CATEGORY_TAGS[element.tag] ?? "other";
}

const MAX_HEADINGS = 15;
const MAX_NAV_TEXT = 10;
const MAX_TEXT_LENGTH = 80;

export function summarizePage(page: Page): PageContextSummary {
  const counts: Record<string, number> = {};
  const headings: string[] = [];
  const navText: string[] = [];

  for (const element of page.elements) {
    const category = classify(element);
    counts[category] = (counts[category] ?? 0) + 1;

    const text = element.text?.trim().slice(0, MAX_TEXT_LENGTH);
    if (!text) continue;
    if (category === "heading" && headings.length < MAX_HEADINGS) headings.push(text);
    if (category === "navigation" && navText.length < MAX_NAV_TEXT) navText.push(text);
  }

  return {
    url: page.url,
    title: page.title,
    depth: page.depth,
    headings,
    navText,
    counts,
    externalStyles: page.styles.length,
    externalScripts: page.scripts.length,
    outboundLinkCount: page.links.length,
  };
}

export interface AssetSummary {
  countsByType: Record<string, number>;
  totalUnique: number;
  sampleUrls: Record<string, string[]>;
}

const MAX_SAMPLE_URLS_PER_TYPE = 5;

export function summarizeAssets(assets: Asset[]): AssetSummary {
  const countsByType: Record<string, number> = {};
  const sampleUrls: Record<string, string[]> = {};

  for (const asset of assets) {
    countsByType[asset.type] = (countsByType[asset.type] ?? 0) + 1;
    const samples = sampleUrls[asset.type] ?? [];
    if (samples.length < MAX_SAMPLE_URLS_PER_TYPE) {
      samples.push(asset.url);
      sampleUrls[asset.type] = samples;
    }
  }

  return { countsByType, totalUnique: assets.length, sampleUrls };
}

export interface WebsiteAnalysisContext {
  url: string;
  pages: PageContextSummary[];
  assets: AssetSummary;
  apiEndpoints: ApiSummaryEntry[];
}

/**
 * Assembles the full context handed to the AI website analyzer. Everything
 * here is already redacted (network requests, at capture time) or
 * structural-only (asset counts, DOM element counts/short text snippets) —
 * no secrets, no raw response bodies, no full page HTML (spec Section 30:
 * "Never send secrets"; Section 12: "normalize ... before AI processing").
 */
export function buildWebsiteAnalysisContext(
  url: string,
  pages: Page[],
  assets: Asset[],
  apiEndpoints: ApiSummaryEntry[],
): WebsiteAnalysisContext {
  return {
    url,
    pages: pages.map(summarizePage),
    assets: summarizeAssets(assets),
    apiEndpoints,
  };
}
