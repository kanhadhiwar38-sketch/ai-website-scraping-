import type { AIModel } from "@webrecon/types";
import { AIProviderError } from "./types.js";
import { OpenAICompatibleProvider, type OpenAICompatibleConfig } from "./openai-compatible-client.js";

export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

interface OpenRouterModelEntry {
  id: string;
  name?: string;
  context_length?: number;
  pricing?: { prompt?: string; completion?: string };
  architecture?: { input_modalities?: string[]; output_modalities?: string[] };
  supported_parameters?: string[];
}

interface OpenRouterModelsResponse {
  data: OpenRouterModelEntry[];
}

export function isFreeModel(entry: OpenRouterModelEntry): boolean {
  if (entry.id.endsWith(":free")) return true;
  const promptPrice = Number.parseFloat(entry.pricing?.prompt ?? "");
  const completionPrice = Number.parseFloat(entry.pricing?.completion ?? "");
  return promptPrice === 0 && completionPrice === 0;
}

export function toPricePerMillion(rawPricePerToken: string | undefined): number | undefined {
  const price = Number.parseFloat(rawPricePerToken ?? "");
  return Number.isFinite(price) ? price * 1_000_000 : undefined;
}

export interface OpenRouterConfig {
  id?: string;
  name?: string;
  apiKey: string;
  /** Optional attribution headers OpenRouter uses for its public leaderboard. */
  appTitle?: string;
  siteUrl?: string;
}

/**
 * OpenRouter is the platform's built-in AI provider (spec Section 22). It's
 * fully OpenAI-compatible for chat/completions, so this only needs to
 * override listModels() with OpenRouter's richer catalog schema — pricing,
 * context length, and supported_parameters give us real capability data
 * instead of the OpenAICompatibleProvider defaults.
 */
export class OpenRouterProvider extends OpenAICompatibleProvider {
  constructor(config: OpenRouterConfig) {
    const openAICompatibleConfig: OpenAICompatibleConfig = {
      id: config.id ?? "openrouter",
      name: config.name ?? "OpenRouter",
      baseURL: OPENROUTER_BASE_URL,
      apiKey: config.apiKey,
      extraHeaders: {
        ...(config.siteUrl ? { "HTTP-Referer": config.siteUrl } : {}),
        ...(config.appTitle ? { "X-Title": config.appTitle } : {}),
      },
    };
    super(openAICompatibleConfig);
  }

  async listModels(): Promise<AIModel[]> {
    const response = await fetch(`${this.baseURL}/models`, { headers: this.headers() });
    if (!response.ok) {
      throw new AIProviderError(
        `Failed to list OpenRouter models: ${response.status} ${response.statusText}`,
        this.id,
        response.status,
      );
    }
    const body = (await response.json()) as OpenRouterModelsResponse;

    return body.data.map((entry) => {
      const supportedParameters = entry.supported_parameters ?? [];
      return {
        id: entry.id,
        providerId: this.id,
        contextLength: entry.context_length,
        inputModalities: entry.architecture?.input_modalities ?? ["text"],
        outputModalities: entry.architecture?.output_modalities ?? ["text"],
        supportsTools: supportedParameters.includes("tools"),
        supportsStructuredOutput:
          supportedParameters.includes("structured_outputs") ||
          supportedParameters.includes("response_format"),
        supportsVision: (entry.architecture?.input_modalities ?? []).includes("image"),
        supportsReasoning:
          supportedParameters.includes("reasoning") ||
          supportedParameters.includes("include_reasoning"),
        supportsStreaming: true,
        pricePerMInputTokens: toPricePerMillion(entry.pricing?.prompt),
        pricePerMOutputTokens: toPricePerMillion(entry.pricing?.completion),
        isFree: isFreeModel(entry),
        available: true,
      };
    });
  }
}
