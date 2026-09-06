import { describe, expect, it } from "vitest";
import { isFreeModel, toPricePerMillion } from "../openrouter-provider.js";

describe("isFreeModel", () => {
  it("treats a ':free' suffixed id as free", () => {
    expect(isFreeModel({ id: "meta-llama/llama-3.1-8b-instruct:free" })).toBe(true);
  });

  it("treats zero pricing as free", () => {
    expect(isFreeModel({ id: "some/model", pricing: { prompt: "0", completion: "0" } })).toBe(
      true,
    );
  });

  it("treats non-zero pricing as not free", () => {
    expect(
      isFreeModel({ id: "openai/gpt-4o", pricing: { prompt: "0.0000025", completion: "0.00001" } }),
    ).toBe(false);
  });

  it("treats missing pricing as not free (fails safe, never silently 'free')", () => {
    expect(isFreeModel({ id: "some/model" })).toBe(false);
  });
});

describe("toPricePerMillion", () => {
  it("converts a per-token price string to per-million-token", () => {
    expect(toPricePerMillion("0.000002")).toBeCloseTo(2, 5);
  });

  it("returns undefined for missing or non-numeric input", () => {
    expect(toPricePerMillion(undefined)).toBeUndefined();
    expect(toPricePerMillion("not-a-number")).toBeUndefined();
  });
});
