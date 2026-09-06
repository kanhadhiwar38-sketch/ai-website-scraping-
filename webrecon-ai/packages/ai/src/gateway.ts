import type { AIMessage, AIResponse, AIToolDefinition } from "@webrecon/ai-providers";
import { AIProviderError } from "@webrecon/ai-providers";
import type { AIMode, AITaskType } from "@webrecon/types";
import {
  AIRouter,
  AIProviderRegistry,
  AIModelRegistry,
  buildProviderRegistryForUser,
  type RouteResult,
} from "@webrecon/ai-router";
import { AppError } from "@webrecon/shared";
import { createLogger } from "@webrecon/logger";
import { recordUsage } from "./usage-tracker.js";

const logger = createLogger({ name: "ai-gateway" });

export interface AIGatewayChatRequest {
  mode: AIMode;
  taskType: AITaskType;
  userId: string;
  projectId?: string;
  /** Required for CUSTOM mode; ignored by other modes. */
  providerId?: string;
  model?: string;
  messages: AIMessage[];
  temperature?: number;
  maxTokens?: number;
  tools?: AIToolDefinition[];
  /** Max candidates to try before giving up (spec Section 26 fallback chain). Default 3. */
  maxAttempts?: number;
}

export interface AIGatewayChatResult extends AIResponse {
  providerId: string;
  /** How many candidates were attempted before this one succeeded. */
  attempt: number;
}

export class AllCandidatesFailedError extends AppError {
  constructor(mode: string, attempts: number, lastError: unknown) {
    const detail = lastError instanceof Error ? lastError.message : String(lastError);
    super(
      "AI_ALL_CANDIDATES_FAILED",
      `All ${attempts} candidate model(s) for mode "${mode}" failed. Last error: ${detail}`,
      502,
    );
  }
}

/**
 * The single entry point the rest of the app talks to for anything
 * AI-related. Handles mode-aware model selection (via AIRouter), fallback
 * across ranked candidates (spec Section 26), and usage tracking (spec
 * Section 29) for every attempt -- successful or not.
 */
export class AIGateway {
  constructor(
    private readonly router: AIRouter,
    private readonly providerRegistry: AIProviderRegistry,
    private readonly modelRegistry: AIModelRegistry,
  ) {}

  async chat(request: AIGatewayChatRequest): Promise<AIGatewayChatResult> {
    const candidates = await this.router.selectCandidates({
      mode: request.mode,
      taskType: request.taskType,
      providerId: request.providerId,
      model: request.model,
    });

    const maxAttempts = Math.max(1, Math.min(request.maxAttempts ?? 3, candidates.length));
    let lastError: unknown;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const candidate = candidates[attempt] as RouteResult;
      const startedAt = Date.now();

      try {
        const response = await candidate.provider.chat({
          model: candidate.model.id,
          messages: request.messages,
          temperature: request.temperature,
          maxTokens: request.maxTokens,
          tools: request.tools,
        });

        await recordUsage({
          userId: request.userId,
          projectId: request.projectId,
          providerId: candidate.provider.id,
          model: candidate.model,
          taskType: request.taskType,
          inputTokens: response.usage.inputTokens,
          outputTokens: response.usage.outputTokens,
          latencyMs: Date.now() - startedAt,
          status: "ok",
        }).catch((error: unknown) => logger.warn({ error }, "failed to record AI usage"));

        return { ...response, providerId: candidate.provider.id, attempt };
      } catch (error) {
        lastError = error;
        await recordUsage({
          userId: request.userId,
          projectId: request.projectId,
          providerId: candidate.provider.id,
          model: candidate.model,
          taskType: request.taskType,
          inputTokens: 0,
          outputTokens: 0,
          latencyMs: Date.now() - startedAt,
          status: "error",
        }).catch((usageError: unknown) => logger.warn({ error: usageError }, "failed to record AI usage"));

        logger.warn(
          {
            mode: request.mode,
            providerId: candidate.provider.id,
            modelId: candidate.model.id,
            attempt,
            error: error instanceof AIProviderError ? error.message : error,
          },
          "AI candidate failed, trying next fallback candidate if any",
        );

        // CUSTOM mode has exactly one candidate by construction (spec
        // Section 26: never silently switch providers under CUSTOM), so
        // the loop naturally can't fall back further for it anyway.
      }
    }

    throw new AllCandidatesFailedError(request.mode, maxAttempts, lastError);
  }

  getProviderRegistry(): AIProviderRegistry {
    return this.providerRegistry;
  }

  getModelRegistry(): AIModelRegistry {
    return this.modelRegistry;
  }
}

/** Builds a fully-wired Gateway scoped to one user's configured providers. */
export async function buildGatewayForUser(userId: string): Promise<AIGateway> {
  const providerRegistry = await buildProviderRegistryForUser(userId);
  const modelRegistry = new AIModelRegistry(providerRegistry);
  const router = new AIRouter(providerRegistry, modelRegistry);
  return new AIGateway(router, providerRegistry, modelRegistry);
}
