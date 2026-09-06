import type { AIModel } from "@webrecon/types";
import { NotFoundError } from "@webrecon/shared";
import { createLogger } from "@webrecon/logger";
import type { AIProviderRegistry } from "./provider-registry.js";

const logger = createLogger({ name: "ai-model-registry" });

interface CacheEntry {
  models: AIModel[];
  fetchedAt: number;
}

const DEFAULT_TTL_MS = 10 * 60_000; // 10 minutes

/**
 * Caches each provider's `listModels()` result so the AI Router doesn't
 * re-fetch a provider's full catalog on every single routing decision
 * (spec Section 24: "fetch model information dynamically" — dynamic
 * doesn't have to mean "on every request").
 */
export class AIModelRegistry {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    private readonly providerRegistry: AIProviderRegistry,
    private readonly ttlMs: number = DEFAULT_TTL_MS,
  ) {}

  async getModels(providerId: string, forceRefresh = false): Promise<AIModel[]> {
    const cached = this.cache.get(providerId);
    const isFresh = cached && Date.now() - cached.fetchedAt < this.ttlMs;
    if (isFresh && !forceRefresh) return cached.models;

    const provider = this.providerRegistry.get(providerId);
    if (!provider) throw new NotFoundError(`Unknown provider: ${providerId}`);

    try {
      const models = await provider.listModels();
      this.cache.set(providerId, { models, fetchedAt: Date.now() });
      return models;
    } catch (error) {
      logger.error({ providerId, error }, "failed to fetch models");
      // Serve stale data rather than fail the whole routing decision, if we have it.
      if (cached) return cached.models;
      throw error;
    }
  }

  async getAllModels(forceRefresh = false): Promise<AIModel[]> {
    const results = await Promise.all(
      this.providerRegistry.list().map((provider) => this.getModels(provider.id, forceRefresh)),
    );
    return results.flat();
  }

  invalidate(providerId: string): void {
    this.cache.delete(providerId);
  }
}
