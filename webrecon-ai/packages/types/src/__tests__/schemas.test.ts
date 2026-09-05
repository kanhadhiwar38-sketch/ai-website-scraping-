import { describe, expect, it } from "vitest";
import { Asset, AssetType, CreateProjectInput, HttpUrl, Project, ResponsiveAnalysis } from "../index.js";

describe("HttpUrl", () => {
  it("accepts http and https URLs", () => {
    expect(HttpUrl.safeParse("https://example.com").success).toBe(true);
    expect(HttpUrl.safeParse("http://example.com/path?x=1").success).toBe(true);
  });

  it("rejects non-http(s) protocols and malformed input", () => {
    expect(HttpUrl.safeParse("ftp://example.com").success).toBe(false);
    expect(HttpUrl.safeParse("javascript:alert(1)").success).toBe(false);
    expect(HttpUrl.safeParse("not a url").success).toBe(false);
  });
});

describe("CreateProjectInput", () => {
  it("accepts a bare URL with no options", () => {
    const result = CreateProjectInput.safeParse({ url: "https://example.com" });
    expect(result.success).toBe(true);
  });

  it("accepts partial options", () => {
    const result = CreateProjectInput.safeParse({
      url: "https://example.com",
      options: { maxPages: 10 },
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid URL", () => {
    expect(CreateProjectInput.safeParse({ url: "not-a-url" }).success).toBe(false);
  });
});

describe("Project", () => {
  it("parses a fully-formed project record", () => {
    const now = new Date().toISOString();
    const result = Project.safeParse({
      id: "project_abc",
      userId: "user_abc",
      url: "https://example.com",
      allowedDomains: ["example.com"],
      status: "created",
      options: {
        maxPages: 50,
        maxDepth: 3,
        autoScroll: true,
        screenshots: true,
        networkInspection: true,
        assetDiscovery: true,
        responsiveInspection: true,
        aiAnalysis: true,
      },
      pagesScanned: 0,
      createdAt: now,
      updatedAt: now,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a project missing allowedDomains", () => {
    const now = new Date().toISOString();
    const result = Project.safeParse({
      id: "project_abc",
      userId: "user_abc",
      url: "https://example.com",
      allowedDomains: [],
      status: "created",
      options: {},
      pagesScanned: 0,
      createdAt: now,
      updatedAt: now,
    });
    expect(result.success).toBe(false);
  });
});

describe("Asset", () => {
  it("parses a discovered image asset", () => {
    const result = Asset.safeParse({
      id: "asset_abc",
      userId: "user_abc",
      projectId: "project_abc",
      url: "https://example.com/logo.png",
      type: "image",
      mimeType: "image/png",
      sizeBytes: 2048,
      dimensions: { width: 200, height: 100 },
      sourcePageId: "page_abc",
      discoveredAt: new Date().toISOString(),
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown asset type", () => {
    const result = AssetType.safeParse("torrent");
    expect(result.success).toBe(false);
  });

  it("allows an asset with no size/dimension metadata", () => {
    const result = Asset.safeParse({
      id: "asset_abc",
      userId: "user_abc",
      projectId: "project_abc",
      url: "https://example.com/app.js",
      type: "js",
      discoveredAt: new Date().toISOString(),
    });
    expect(result.success).toBe(true);
  });
});

describe("ResponsiveAnalysis", () => {
  it("parses a report with snapshots, differences, and breakpoints", () => {
    const now = new Date().toISOString();
    const result = ResponsiveAnalysis.safeParse({
      id: "responsive_abc",
      userId: "user_abc",
      projectId: "project_abc",
      pageId: "page_abc",
      snapshots: [
        {
          viewport: "desktop",
          width: 1440,
          height: 900,
          documentHeight: 2200,
          navigationVariant: "horizontal-nav",
          elements: [
            {
              selector: "#sidebar",
              tag: "aside",
              visible: true,
              boundingBox: { x: 0, y: 0, width: 300, height: 800 },
            },
          ],
        },
      ],
      differences: [
        {
          selector: "#sidebar",
          kind: "hidden",
          from: "desktop",
          to: "mobile",
          detail: "aside visible at desktop, hidden at mobile",
        },
      ],
      breakpoints: [{ widthPx: 579, betweenViewports: ["tablet", "mobile"], changeCount: 1 }],
      analyzedAt: now,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a difference with an invalid kind", () => {
    const result = ResponsiveAnalysis.shape.differences.element.safeParse({
      selector: "#x",
      kind: "teleported",
      from: "desktop",
      to: "mobile",
      detail: "n/a",
    });
    expect(result.success).toBe(false);
  });
});
