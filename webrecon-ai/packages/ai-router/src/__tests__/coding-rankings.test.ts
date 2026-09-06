import { describe, expect, it } from "vitest";
import { isCodingCapable, codingScore, rankCodingModels } from "../coding-rankings.js";
import type { AIModel } from "@webrecon/types";

function makeModel(overrides: Partial<AIModel> = {}): AIModel {
  return {
    id: "some/model",
    providerId: "provider",
    inputModalities: ["text"],
    outputModalities: ["text"],
    supportsTools: true,
    supportsStructuredOutput: false,
    supportsVision: false,
    supportsReasoning: false,
    supportsStreaming: false,
    isFree: false,
    available: true,
    ...overrides,
  };
}

describe("isCodingCapable", () => {
  it("requires tool support", () => {
    expect(isCodingCapable(makeModel({ supportsTools: false }))).toBe(false);
    expect(isCodingCapable(makeModel({ supportsTools: true }))).toBe(true);
  });

  it("excludes unavailable models", () => {
    expect(isCodingCapable(makeModel({ available: false }))).toBe(false);
  });
});

describe("codingScore", () => {
  it("uses the model's explicit codingScore if set", () => {
    expect(codingScore(makeModel({ codingScore: 42 }))).toBe(42);
  });

  it("matches known strong coding models via the ranking table", () => {
    const score = codingScore(makeModel({ id: "anthropic/claude-opus-4-1" }));
    expect(score).toBeGreaterThanOrEqual(90);
  });

  it("falls back to a capability-based estimate for unrecognized models", () => {
    const score = codingScore(makeModel({ id: "some-obscure-model", supportsReasoning: true }));
    expect(score).toBeGreaterThanOrEqual(50);
    expect(score).toBeLessThan(90);
  });
});

describe("rankCodingModels", () => {
  it("excludes non-tool-capable models and sorts best-first", () => {
    const models = [
      makeModel({ id: "no-tools", supportsTools: false }),
      makeModel({ id: "anthropic/claude-opus-4", supportsTools: true }),
      makeModel({ id: "random/model", supportsTools: true }),
    ];
    const ranked = rankCodingModels(models);
    expect(ranked.map((m) => m.id)).toEqual(["anthropic/claude-opus-4", "random/model"]);
  });
});
