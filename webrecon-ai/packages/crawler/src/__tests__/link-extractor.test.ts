import { describe, expect, it } from "vitest";
import { resolveInternalLinks } from "../link-extractor.js";

describe("resolveInternalLinks", () => {
  const base = "https://example.com/blog/post-1";

  it("resolves relative hrefs against the base URL", () => {
    const result = resolveInternalLinks(base, [{ href: "/about", text: "About" }], [
      "example.com",
    ]);
    expect(result).toEqual(["https://example.com/about"]);
  });

  it("keeps subdomains of an allowed domain", () => {
    const result = resolveInternalLinks(
      base,
      [{ href: "https://shop.example.com/item", text: "Shop" }],
      ["example.com"],
    );
    expect(result).toEqual(["https://shop.example.com/item"]);
  });

  it("drops links to domains outside the allowlist", () => {
    const result = resolveInternalLinks(
      base,
      [{ href: "https://evil.com/phish", text: "click" }],
      ["example.com"],
    );
    expect(result).toEqual([]);
  });

  it("drops mailto/tel/javascript schemes", () => {
    const result = resolveInternalLinks(
      base,
      [
        { href: "mailto:hi@example.com", text: "Email" },
        { href: "tel:+1234567890", text: "Call" },
        { href: "javascript:void(0)", text: "JS" },
      ],
      ["example.com"],
    );
    expect(result).toEqual([]);
  });

  it("strips fragments and dedupes", () => {
    const result = resolveInternalLinks(
      base,
      [
        { href: "/pricing#top", text: "Pricing" },
        { href: "/pricing#bottom", text: "Pricing again" },
      ],
      ["example.com"],
    );
    expect(result).toEqual(["https://example.com/pricing"]);
  });

  it("ignores empty hrefs", () => {
    const result = resolveInternalLinks(base, [{ href: "", text: "" }], ["example.com"]);
    expect(result).toEqual([]);
  });

  it("ignores malformed hrefs without throwing", () => {
    const result = resolveInternalLinks(base, [{ href: "http://[::::]", text: "bad" }], [
      "example.com",
    ]);
    expect(result).toEqual([]);
  });
});
