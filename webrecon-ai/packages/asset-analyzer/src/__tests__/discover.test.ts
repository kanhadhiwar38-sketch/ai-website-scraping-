import { describe, expect, it } from "vitest";
import type { CapturedNetworkRequest } from "@webrecon/network-inspector";
import { enrichAssetsFromNetwork } from "../discover.js";
import type { DiscoveredAsset } from "../discover.js";

function makeRecord(overrides: Partial<CapturedNetworkRequest>): CapturedNetworkRequest {
  return {
    url: "https://example.com/logo.png",
    method: "GET",
    status: 200,
    resourceType: "image",
    requestHeaders: {},
    responseHeaders: {},
    queryParams: {},
    requestBody: null,
    responseBody: null,
    redacted: false,
    capturedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("enrichAssetsFromNetwork", () => {
  it("fills in mimeType and sizeBytes for an already-discovered asset", () => {
    const domAssets: DiscoveredAsset[] = [{ url: "https://example.com/logo.png", type: "image" }];
    const records = [
      makeRecord({
        responseHeaders: { "content-type": "image/png", "content-length": "12345" },
      }),
    ];

    const result = enrichAssetsFromNetwork(domAssets, records);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ mimeType: "image/png", sizeBytes: 12345 });
  });

  it("never overwrites metadata already known from the DOM", () => {
    const domAssets: DiscoveredAsset[] = [
      { url: "https://example.com/logo.png", type: "image", mimeType: "image/svg+xml" },
    ];
    const records = [makeRecord({ responseHeaders: { "content-type": "image/png" } })];

    const result = enrichAssetsFromNetwork(domAssets, records);
    expect(result[0]?.mimeType).toBe("image/svg+xml");
  });

  it("adds font assets found only in network traffic (not in the DOM)", () => {
    const records = [
      makeRecord({
        url: "https://example.com/fonts/inter.woff2",
        resourceType: "font",
        responseHeaders: { "content-type": "font/woff2" },
      }),
    ];

    const result = enrichAssetsFromNetwork([], records);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ type: "font", mimeType: "font/woff2" });
  });

  it("does not invent assets for non-asset resource types", () => {
    const records = [makeRecord({ url: "https://example.com/api/data", resourceType: "fetch" })];
    const result = enrichAssetsFromNetwork([], records);
    expect(result).toEqual([]);
  });

  it("deduplicates by URL", () => {
    const domAssets: DiscoveredAsset[] = [{ url: "https://example.com/logo.png", type: "image" }];
    const records = [makeRecord({}), makeRecord({})];
    const result = enrichAssetsFromNetwork(domAssets, records);
    expect(result).toHaveLength(1);
  });
});
