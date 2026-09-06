import type { AIProvider } from "@webrecon/ai-providers";
import type { AIMode, AIModel, AITaskType } from "@webrecon/types";
import { NotFoundError, ValidationError } from "@webrecon/shared";
import type { AIProviderRegistry } from "./provider-registry.js";
import type { AIModelRegistry } from "./model-registry.js";
import { rankModels } from "./scoring.js";
import { rankCodingModels } from "./coding-rankings.js";

export interface RouteRequest {
  mode: AIMode;
  taskType?: AITaskType;
  /** Required (and only used) for CUSTOM mode. */
  providerId?: string;
  model?: string;
}

export interface RouteResult {
  provider: AIProvider;
  model: AIModel;
}

/**
 * Selects provider+model candidates for a request, best-first. Each mode
 * has its own constraint set (spec Section 23), and the router never
 * crosses those constraints even when falling back:
 * - CUSTOM: exactly the requested provider+model, one candidate, no
 *   substitution -- spec Section 26: "If CUSTOM: do not silently switch
 *   providers."
 * - FREE: only zero-cost models, ranked; fallback stays within free models.
 * - BEST_CODING: only tool-capable models, ranked by configured coding
 *   rankings.
 * - AUTO: every available model, ranked by task-aware capability + cost
 *   scoring.
 */
export class AIRouter {
  constructor(
    private readonly providerRegistry: AIProviderRegistry,
    private readonly modelRegistry: AIModelRegistry,
  ) {}

  /** Single best pick -- kept for callers that don't need the fallback list. */
  async select(request: RouteRequest): Promise<RouteResult> {
    const candidates = await this.selectCandidates(request);
    const best = candidates[0];
    if (!best) {
      throw new NotFoundError(
        `No available models for mode "${request.mode}"` +
          (request.taskType ? ` and task "${request.taskType}"` : ""),
      );
    }
    return best;
  }

  /** Ranked candidates, best-first, for fallback execution (spec Section 26). */
  async selectCandidates(request: RouteRequest): Promise<RouteResult[]> {
    switch (request.mode) {
      case "CUSTOM":
        return [await this.selectCustom(request)];
      case "FREE":
        return this.selectFree(request);
      case "BEST_CODING":
        return this.selectBestCoding();
      case "AUTO":
        return this.selectAuto(request);
      default:
        throw new ValidationError(`Unknown AI mode: ${String(request.mode)}`);
    }
  }

  private async selectCustom(request: RouteRequest): Promise<RouteResult> {
    if (!request.providerId || !request.model) {
      throw new ValidationError("CUSTOM mode requires both providerId and model");
    }

    const provider = this.providerRegistry.get(request.providerId);
    if (!provider) throw new NotFoundError(`Unknown provider: ${request.providerId}`);

    const models = await this.modelRegistry.getModels(request.providerId);
    const model = models.find((candidate) => candidate.id === request.model);
    if (!model) {
      throw new NotFoundError(
        `Model "${request.model}" not found on provider "${request.providerId}"`,
      );
    }

    return { provider, model };
  }

  /** Every registered provider's models, flattened with their owning AIProvider attached. */
  private async allModelsWithProviders(): Promise<RouteResult[]> {
    const providers = this.providerRegistry.list();
    const perProvider = await Promise.all(
      providers.map(async (provider) => {
        const models = await this.modelRegistry.getModels(provider.id);
        return models.map((model) => ({ provider, model }));
      }),
    );
    return perProvider.flat();
  }

  private async selectFree(request: RouteRequest): Promise<RouteResult[]> {
    const all = await this.allModelsWithProviders();
    const freeOnly = all.filter((candidate) => candidate.model.isFree);
    const ranked = rankModels(
      freeOnly.map((candidate) => candidate.model),
      request.taskType,
    );
    return this.reorderByRankedModels(freeOnly, ranked);
  }

  private async selectBestCoding(): Promise<RouteResult[]> {
    const all = await this.allModelsWithProviders();
    const ranked = rankCodingModels(all.map((candidate) => candidate.model));
    return this.reorderByRankedModels(all, ranked);
  }

  private async selectAuto(request: RouteRequest): Promise<RouteResult[]> {
    const all = await this.allModelsWithProviders();
    const ranked = rankModels(
      all.map((candidate) => candidate.model),
      request.taskType,
    );
    return this.reorderByRankedModels(all, ranked);
  }

  /** Re-orders `candidates` to match the already-ranked `orderedModels` sequence. */
  private reorderByRankedModels(candidates: RouteResult[], orderedModels: AIModel[]): RouteResult[] {
    const byModelKey = new Map<string, RouteResult>();
    for (const candidate of candidates) {
      byModelKey.set(`${candidate.provider.id}:${candidate.model.id}`, candidate);
    }
    return orderedModels
      .map((model) => byModelKey.get(`${model.providerId}:${model.id}`))
      .filter((candidate): candidate is RouteResult => candidate !== undefined);
  }
}
