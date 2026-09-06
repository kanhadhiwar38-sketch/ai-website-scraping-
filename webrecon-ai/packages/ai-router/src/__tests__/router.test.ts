import { describe, expect, it, vi } from "vitest";
import { AIRouter } from "../router.js";
import { AIProviderRegistry } from "../provider-registry.js";
import type { AIProvider } from "@webrecon/ai-providers";
import type { AIModel } from "@webrecon/types";
import type { AIModelRegistry } from "../model-registry.js";

function makeFakeProvider(id: string): AIProvider {
  return {
    id,
    name: id,
    baseURL: "https://example.com",
    listModels: vi.fn(),
    chat: vi.fn(),
    stream: vi.fn(),
  };
}

function makeFakeModelRegistry(models: Record<string, Partial<AIModel>[]>): AIModelRegistry {
  return {
    getModels: vi.fn(async (providerId: string) =>
      (models[providerId] ?? []).map(
        (m): AIModel => ({
          id: m.id ?? "model",
          providerId,
          inputModalities: ["text"],
          outputModalities: ["text"],
          supportsTools: m.supportsTools ?? false,
          supportsStructuredOutput: m.supportsStructuredOutput ?? false,
          supportsVision: m.supportsVision ?? false,
          supportsReasoning: m.supportsReasoning ?? false,
          supportsStreaming: m.supportsStreaming ?? false,
          isFree: m.isFree ?? false,
          available: m.available ?? true,
          contextLength: m.contextLength,
          pricePerMInputTokens: m.pricePerMInputTokens,
          pricePerMOutputTokens: m.pricePerMOutputTokens,
          codingScore: m.codingScore,
        }),
      ),
    ),
    getAllModels: vi.fn(),
    invalidate: vi.fn(),
  } as unknown as AIModelRegistry;
}

describe("AIRouter CUSTOM mode", () => {
  it("selects the requested provider and model", async () => {
    const providerRegistry = new AIProviderRegistry();
    providerRegistry.register(makeFakeProvider("openrouter"));
    const modelRegistry = makeFakeModelRegistry({ openrouter: [{ id: "gpt-4o" }] });
    const router = new AIRouter(providerRegistry, modelRegistry);

    const result = await router.select({ mode: "CUSTOM", providerId: "openrouter", model: "gpt-4o" });
    expect(result.provider.id).toBe("openrouter");
    expect(result.model.id).toBe("gpt-4o");
  });

  it("throws when providerId or model is missing", async () => {
    const providerRegistry = new AIProviderRegistry();
    const modelRegistry = makeFakeModelRegistry({});
    const router = new AIRouter(providerRegistry, modelRegistry);

    await expect(router.select({ mode: "CUSTOM" })).rejects.toThrow(/requires both/);
  });

  it("throws when the provider isn't registered", async () => {
    const providerRegistry = new AIProviderRegistry();
    const modelRegistry = makeFakeModelRegistry({});
    const router = new AIRouter(providerRegistry, modelRegistry);

    await expect(
      router.select({ mode: "CUSTOM", providerId: "nope", model: "x" }),
    ).rejects.toThrow(/Unknown provider/);
  });

  it("throws when the model isn't found on that provider", async () => {
    const providerRegistry = new AIProviderRegistry();
    providerRegistry.register(makeFakeProvider("openrouter"));
    const modelRegistry = makeFakeModelRegistry({ openrouter: [{ id: "gpt-4o" }] });
    const router = new AIRouter(providerRegistry, modelRegistry);

    await expect(
      router.select({ mode: "CUSTOM", providerId: "openrouter", model: "does-not-exist" }),
    ).rejects.toThrow(/not found/);
  });

  it("returns exactly one candidate (no fallback substitution across providers)", async () => {
    const providerRegistry = new AIProviderRegistry();
    providerRegistry.register(makeFakeProvider("openrouter"));
    const modelRegistry = makeFakeModelRegistry({ openrouter: [{ id: "gpt-4o" }] });
    const router = new AIRouter(providerRegistry, modelRegistry);

    const candidates = await router.selectCandidates({
      mode: "CUSTOM",
      providerId: "openrouter",
      model: "gpt-4o",
    });
    expect(candidates).toHaveLength(1);
  });
});

describe("AIRouter FREE mode", () => {
  it("only returns free models, ranked", async () => {
    const providerRegistry = new AIProviderRegistry();
    providerRegistry.register(makeFakeProvider("openrouter"));
    const modelRegistry = makeFakeModelRegistry({
      openrouter: [
        { id: "paid-model", isFree: false },
        { id: "free-model-a", isFree: true, contextLength: 8000 },
        { id: "free-model-b", isFree: true, contextLength: 32000 },
      ],
    });
    const router = new AIRouter(providerRegistry, modelRegistry);

    const candidates = await router.selectCandidates({ mode: "FREE" });
    expect(candidates.map((c) => c.model.id)).toEqual(["free-model-b", "free-model-a"]);
  });

  it("throws NotFoundError via select() when no free models exist", async () => {
    const providerRegistry = new AIProviderRegistry();
    providerRegistry.register(makeFakeProvider("openrouter"));
    const modelRegistry = makeFakeModelRegistry({ openrouter: [{ id: "paid", isFree: false }] });
    const router = new AIRouter(providerRegistry, modelRegistry);

    await expect(router.select({ mode: "FREE" })).rejects.toThrow(/No available models/);
  });
});

describe("AIRouter BEST_CODING mode", () => {
  it("only returns tool-capable models, ranked by coding score", async () => {
    const providerRegistry = new AIProviderRegistry();
    providerRegistry.register(makeFakeProvider("openrouter"));
    const modelRegistry = makeFakeModelRegistry({
      openrouter: [
        { id: "no-tools-model", supportsTools: false },
        { id: "anthropic/claude-opus-4", supportsTools: true },
        { id: "some/random-model", supportsTools: true },
      ],
    });
    const router = new AIRouter(providerRegistry, modelRegistry);

    const candidates = await router.selectCandidates({ mode: "BEST_CODING" });
    expect(candidates.map((c) => c.model.id)).toEqual([
      "anthropic/claude-opus-4",
      "some/random-model",
    ]);
  });
});

describe("AIRouter AUTO mode", () => {
  it("ranks all available models and prefers higher context length", async () => {
    const providerRegistry = new AIProviderRegistry();
    providerRegistry.register(makeFakeProvider("openrouter"));
    const modelRegistry = makeFakeModelRegistry({
      openrouter: [
        { id: "small-context", contextLength: 4000 },
        { id: "big-context", contextLength: 200000 },
      ],
    });
    const router = new AIRouter(providerRegistry, modelRegistry);

    const result = await router.select({ mode: "AUTO" });
    expect(result.model.id).toBe("big-context");
  });

  it("excludes unavailable models", async () => {
    const providerRegistry = new AIProviderRegistry();
    providerRegistry.register(makeFakeProvider("openrouter"));
    const modelRegistry = makeFakeModelRegistry({
      openrouter: [{ id: "down", available: false }],
    });
    const router = new AIRouter(providerRegistry, modelRegistry);

    await expect(router.select({ mode: "AUTO" })).rejects.toThrow(/No available models/);
  });
});
