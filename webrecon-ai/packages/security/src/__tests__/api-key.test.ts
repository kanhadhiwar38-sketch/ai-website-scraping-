import { describe, expect, it } from "vitest";
import { generateApiKey, hashApiKey, looksLikeApiKey } from "../api-key.js";

describe("generateApiKey", () => {
  it("produces a key with the wr_live_ prefix", () => {
    const { raw } = generateApiKey();
    expect(raw.startsWith("wr_live_")).toBe(true);
  });

  it("produces a hash that matches hashApiKey(raw)", () => {
    const { raw, hash } = generateApiKey();
    expect(hashApiKey(raw)).toBe(hash);
  });

  it("produces different keys on each call", () => {
    const a = generateApiKey();
    const b = generateApiKey();
    expect(a.raw).not.toBe(b.raw);
    expect(a.hash).not.toBe(b.hash);
  });

  it("the displayable prefix is a strict substring prefix of the raw key", () => {
    const { raw, prefix } = generateApiKey();
    expect(raw.startsWith(prefix)).toBe(true);
    expect(prefix.length).toBeLessThan(raw.length);
  });
});

describe("looksLikeApiKey", () => {
  it("recognizes WebRecon API keys", () => {
    expect(looksLikeApiKey("wr_live_abc123")).toBe(true);
  });

  it("rejects things that aren't API keys", () => {
    expect(looksLikeApiKey("eyJhbGciOiJSUzI1NiJ9.abc.def")).toBe(false);
    expect(looksLikeApiKey("")).toBe(false);
  });
});
