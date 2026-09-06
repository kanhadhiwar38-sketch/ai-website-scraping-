import { describe, expect, it } from "vitest";
import { scoreModel, rankModels } from "../scoring.js";
import type { AIModel } from "@webrecon/types";

function makeModel(overrides: Partial<AIModel> = {}): AIModel {
  return {
    id: "model",
    providerId: "provider",
    inputModalities: ["text"],
    outputModalities: ["text"],
    supportsTools: false,
    supportsStructuredOutput: false,
    supportsVision: false,
    supportsReasoning: false,
    supportsStreaming: false,
    isFree: false,
    available: true,
    ...overrides,
  };
}

describe("scoreModel", () => {
  it("scores unavailable models as negative infinity", () => {
    expect(scoreModel(makeModel({ available: false }))).toBe(Number.NEGATIVE_INFINITY);
  });

  it("rewards larger context length up to the cap", () => {
    const small = scoreModel(makeModel({ contextLength: 4000 }));
    const large = scoreModel(makeModel({ contextLength: 200000 }));
    expect(large).toBeGreaterThan(small);
  });

  it("rewards vision support for SCREENSHOT_ANALYSIS", () => {
    const withVision = scoreModel(makeModel({ supportsVision: true }), "SCREENSHOT_ANALYSIS");
    const withoutVision = scoreModel(makeModel({ supportsVision: false }), "SCREENSHOT_ANALYSIS");
    expect(withVision).toBeGreaterThan(withoutVision);
  });

  it("penalizes higher input cost", () => {
    const cheap = scoreModel(makeModel({ pricePerMInputTokens: 0 }));
    const expensive = scoreModel(makeModel({ pricePerMInputTokens: 50 }));
    expect(cheap).toBeGreaterThan(expensive);
  });
});

describe("rankModels", () => {
  it("filters out unavailable models entirely", () => {
    const models = [makeModel({ id: "a", available: true }), makeModel({ id: "b", available: false })];
    const ranked = rankModels(models);
    expect(ranked.map((m) => m.id)).toEqual(["a"]);
  });

  it("sorts best-first", () => {
    const models = [
      makeModel({ id: "weak", contextLength: 4000 }),
      makeModel({ id: "strong", contextLength: 200000, supportsTools: true }),
    ];
    const ranked = rankModels(models);
    expect(ranked[0]?.id).toBe("strong");
  });
});
