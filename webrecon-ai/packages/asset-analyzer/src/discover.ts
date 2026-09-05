import type { Page } from "playwright";
import type { AssetType } from "@webrecon/types";
import type { CapturedNetworkRequest } from "@webrecon/network-inspector";

/**
 * An asset found by inspecting the rendered page and/or the network traffic
 * it generated. Never includes bytes — Section 17 only asks for metadata
 * (URL, MIME type, size, dimensions, source page), never the asset content
 * itself, and Section 17 explicitly forbids auto-reusing copyrighted assets.
 */
export interface DiscoveredAsset {
  url: string;
  type: AssetType;
  mimeType?: string;
  sizeBytes?: number;
  dimensions?: { width: number; height: number };
}

/**
 * Collects asset URLs that are actually referenced by the rendered DOM
 * (images, favicon, external CSS/JS, video, external SVG) — never assets
 * only reachable by guessing paths. Runs inside the page context so it only
 * sees what the browser itself resolved.
 */
export async function discoverAssetsFromDom(page: Page): Promise<DiscoveredAsset[]> {
  const rawResults = await page.evaluate(() => {
    const results: {
      url: string;
      type: string;
      width?: number;
      height?: number;
    }[] = [];

    function classifyByExtension(url: string): string | undefined {
      const path = (url.split("?")[0] ?? url).toLowerCase();
      if (path.endsWith(".svg")) return "svg";
      if (/\.(woff2?|ttf|otf|eot)$/.test(path)) return "font";
      if (/\.(mp4|webm|mov|m4v)$/.test(path)) return "video";
      return undefined;
    }

    for (const img of Array.from(document.querySelectorAll("img[src]"))) {
      const element = img as HTMLImageElement;
      if (!element.src) continue;
      results.push({
        url: element.src,
        type: classifyByExtension(element.src) ?? "image",
        width: element.naturalWidth || undefined,
        height: element.naturalHeight || undefined,
      });
    }

    for (const icon of Array.from(
      document.querySelectorAll('link[rel~="icon"][href], link[rel="shortcut icon"][href]'),
    )) {
      const href = (icon as HTMLLinkElement).href;
      if (href) results.push({ url: href, type: "favicon" });
    }

    for (const stylesheet of Array.from(
      document.querySelectorAll('link[rel="stylesheet"][href]'),
    )) {
      const href = (stylesheet as HTMLLinkElement).href;
      if (href) results.push({ url: href, type: "css" });
    }

    for (const script of Array.from(document.querySelectorAll("script[src]"))) {
      const src = (script as HTMLScriptElement).src;
      if (src) results.push({ url: src, type: "js" });
    }

    for (const font of Array.from(
      document.querySelectorAll('link[rel="preload"][as="font"][href]'),
    )) {
      const href = (font as HTMLLinkElement).href;
      if (href) results.push({ url: href, type: "font" });
    }

    for (const video of Array.from(document.querySelectorAll("video"))) {
      const element = video as HTMLVideoElement;
      const src = element.currentSrc || element.src;
      if (src) results.push({ url: src, type: "video" });
      for (const source of Array.from(element.querySelectorAll("source[src]"))) {
        const sourceSrc = (source as HTMLSourceElement).src;
        if (sourceSrc) results.push({ url: sourceSrc, type: "video" });
      }
    }

    for (const object of Array.from(document.querySelectorAll('object[data$=".svg"]'))) {
      const data = (object as HTMLObjectElement).data;
      if (data) results.push({ url: data, type: "svg" });
    }

    return results;
  });

  // page.evaluate can only return structurally-typed data, so `type` comes
  // back as `string` — narrow it against the known AssetType values here
  // rather than trusting the in-page classification blindly.
  const KNOWN_TYPES = new Set<AssetType>([
    "image",
    "svg",
    "font",
    "css",
    "js",
    "video",
    "favicon",
    "other",
  ]);

  return rawResults.map((asset): DiscoveredAsset => {
    const type = KNOWN_TYPES.has(asset.type as AssetType) ? (asset.type as AssetType) : "other";
    return {
      url: asset.url,
      type,
      dimensions:
        asset.width && asset.height ? { width: asset.width, height: asset.height } : undefined,
    };
  });
}

const FONT_URL_PATTERN = /\.(woff2?|ttf|otf|eot)(\?|$)/i;

/**
 * Adds assets that are only visible through network traffic — fonts loaded
 * via `@font-face` in CSS never appear as DOM elements — and enriches every
 * already-discovered asset with `mimeType`/`sizeBytes` from the matching
 * browser-observed response. Never invents an asset the browser didn't
 * actually request (Section 16/17: only what's legitimately observed).
 */
export function enrichAssetsFromNetwork(
  domAssets: DiscoveredAsset[],
  networkRecords: CapturedNetworkRequest[],
): DiscoveredAsset[] {
  const byUrl = new Map<string, DiscoveredAsset>();
  for (const asset of domAssets) {
    byUrl.set(asset.url, { ...asset });
  }

  for (const record of networkRecords) {
    const contentType = record.responseHeaders["content-type"];
    const contentLength = record.responseHeaders["content-length"];
    const sizeBytes = contentLength ? Number.parseInt(contentLength, 10) : undefined;

    const existing = byUrl.get(record.url);
    if (existing) {
      existing.mimeType = existing.mimeType ?? contentType;
      existing.sizeBytes = existing.sizeBytes ?? (Number.isFinite(sizeBytes) ? sizeBytes : undefined);
      continue;
    }

    if (record.resourceType === "font" || FONT_URL_PATTERN.test(record.url)) {
      byUrl.set(record.url, {
        url: record.url,
        type: "font",
        mimeType: contentType,
        sizeBytes: Number.isFinite(sizeBytes) ? sizeBytes : undefined,
      });
    }
  }

  return Array.from(byUrl.values());
}

/** Full discovery pass: DOM references enriched with network-observed metadata. */
export async function discoverAssets(
  page: Page,
  networkRecords: CapturedNetworkRequest[],
): Promise<DiscoveredAsset[]> {
  const domAssets = await discoverAssetsFromDom(page);
  return enrichAssetsFromNetwork(domAssets, networkRecords);
}
