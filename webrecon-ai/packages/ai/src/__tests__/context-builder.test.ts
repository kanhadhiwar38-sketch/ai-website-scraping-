import { describe, expect, it } from "vitest";
import type { Asset, DomElement, Page } from "@webrecon/types";
import { buildWebsiteAnalysisContext, summarizeAssets, summarizePage } from "../context-builder.js";

function makeElement(overrides: Partial<DomElement>): DomElement {
  return { tag: "div", classes: [], attributes: {}, selector: "div", ...overrides };
}

function makePage(overrides: Partial<Page> = {}): Page {
  return {
    id: "page_1",
    userId: "user_1",
    projectId: "project_1",
    url: "https://example.com",
    depth: 0,
    links: [],
    elements: [],
    styles: [],
    scripts: [],
    discoveredAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("summarizePage", () => {
  it("classifies headings and collects their text", () => {
    const page = makePage({
      elements: [
        makeElement({ tag: "h1", text: "Welcome" }),
        makeElement({ tag: "h2", text: "Features" }),
      ],
    });
    const summary = summarizePage(page);
    expect(summary.counts.heading).toBe(2);
    expect(summary.headings).toEqual(["Welcome", "Features"]);
  });

  it("classifies nav elements by role and collects nav text", () => {
    const page = makePage({
      elements: [makeElement({ tag: "div", role: "navigation", text: "Home About Contact" })],
    });
    const summary = summarizePage(page);
    expect(summary.counts.navigation).toBe(1);
    expect(summary.navText).toEqual(["Home About Contact"]);
  });

  it("counts forms, inputs, images, buttons", () => {
    const page = makePage({
      elements: [
        makeElement({ tag: "form" }),
        makeElement({ tag: "input" }),
        makeElement({ tag: "img" }),
        makeElement({ tag: "button" }),
      ],
    });
    const summary = summarizePage(page);
    expect(summary.counts.form).toBe(1);
    expect(summary.counts.input).toBe(1);
    expect(summary.counts.image).toBe(1);
    expect(summary.counts.button).toBe(1);
  });

  it("truncates long text", () => {
    const longText = "a".repeat(200);
    const page = makePage({ elements: [makeElement({ tag: "h1", text: longText })] });
    const summary = summarizePage(page);
    expect(summary.headings[0]?.length).toBeLessThanOrEqual(80);
  });

  it("caps the number of collected headings", () => {
    const elements = Array.from({ length: 30 }, (_, i) => makeElement({ tag: "h1", text: `H${i}` }));
    const page = makePage({ elements });
    const summary = summarizePage(page);
    expect(summary.headings.length).toBeLessThanOrEqual(15);
    // But the count reflects the true total, not the truncated sample.
    expect(summary.counts.heading).toBe(30);
  });
});

describe("summarizeAssets", () => {
  function makeAsset(overrides: Partial<Asset>): Asset {
    return {
      id: "asset_1",
      userId: "user_1",
      projectId: "project_1",
      url: "https://example.com/a.png",
      type: "image",
      discoveredAt: new Date().toISOString(),
      ...overrides,
    };
  }

  it("counts assets by type", () => {
    const summary = summarizeAssets([
      makeAsset({ type: "image" }),
      makeAsset({ type: "image" }),
      makeAsset({ type: "font" }),
    ]);
    expect(summary.countsByType.image).toBe(2);
    expect(summary.countsByType.font).toBe(1);
    expect(summary.totalUnique).toBe(3);
  });

  it("caps sample URLs per type", () => {
    const assets = Array.from({ length: 10 }, (_, i) =>
      makeAsset({ url: `https://example.com/${i}.png` }),
    );
    const summary = summarizeAssets(assets);
    expect(summary.sampleUrls.image?.length).toBeLessThanOrEqual(5);
  });
});

describe("buildWebsiteAnalysisContext", () => {
  it("never includes raw network response bodies or secrets", () => {
    const context = buildWebsiteAnalysisContext(
      "https://example.com",
      [makePage()],
      [],
      [{ method: "GET", endpoint: "/api/products", status: 200 }],
    );
    const serialized = JSON.stringify(context);
    expect(serialized).not.toContain("responseBody");
    expect(serialized).not.toContain("Authorization");
  });
});
