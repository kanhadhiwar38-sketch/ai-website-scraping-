import type { AIModel } from "@webrecon/types";
import { createLogger } from "@webrecon/logger";
import {
  AIProviderError,
  type AIChunk,
  type AIProvider,
  type AIRequest,
  type AIResponse,
  type AIToolCall,
} from "./types.js";

const logger = createLogger({ name: "openai-compatible-provider" });

export interface OpenAICompatibleConfig {
  id: string;
  name: string;
  baseURL: string;
  apiKey: string;
  /** Extra headers some providers require beyond Authorization (e.g. OpenRouter). */
  extraHeaders?: Record<string, string>;
}

interface OpenAIChatCompletionResponse {
  choices: Array<{
    message: {
      content: string | null;
      tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }>;
    };
    finish_reason: string;
  }>;
  usage?: { prompt_tokens: number; completion_tokens: number };
  model: string;
}

interface OpenAIModelsResponse {
  data: Array<{ id: string; context_length?: number }>;
}

function toOpenAITools(tools: AIRequest["tools"]) {
  if (!tools || tools.length === 0) return undefined;
  return tools.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters ?? {},
    },
  }));
}

/**
 * Talks to any OpenAI-compatible `/chat/completions` + `/models` endpoint.
 * Capability metadata (tools/vision/structured-output/streaming/reasoning
 * support) is NOT assumed here — vanilla OpenAI-compatible `/models`
 * doesn't expose it, so every listed model defaults capability flags to
 * false/unknown (spec Section 21: "do not assume all providers support...
 * check capabilities dynamically when possible"). OpenRouterProvider
 * overrides listModels() with OpenRouter's richer schema.
 */
export class OpenAICompatibleProvider implements AIProvider {
  readonly id: string;
  readonly name: string;
  readonly baseURL: string;
  protected readonly apiKey: string;
  protected readonly extraHeaders: Record<string, string>;

  constructor(config: OpenAICompatibleConfig) {
    this.id = config.id;
    this.name = config.name;
    this.baseURL = config.baseURL.replace(/\/$/, "");
    this.apiKey = config.apiKey;
    this.extraHeaders = config.extraHeaders ?? {};
  }

  protected headers(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiKey}`,
      ...this.extraHeaders,
    };
  }

  async listModels(): Promise<AIModel[]> {
    const response = await fetch(`${this.baseURL}/models`, { headers: this.headers() });
    if (!response.ok) {
      throw new AIProviderError(
        `Failed to list models: ${response.status} ${response.statusText}`,
        this.id,
        response.status,
      );
    }
    const body = (await response.json()) as OpenAIModelsResponse;

    return body.data.map((model) => ({
      id: model.id,
      providerId: this.id,
      contextLength: model.context_length,
      inputModalities: ["text"],
      outputModalities: ["text"],
      supportsTools: false,
      supportsStructuredOutput: false,
      supportsVision: false,
      supportsReasoning: false,
      supportsStreaming: true, // OpenAI-compatible chat/completions almost always supports stream:true
      isFree: false,
      available: true,
    }));
  }

  async chat(request: AIRequest): Promise<AIResponse> {
    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        model: request.model,
        messages: request.messages.map((message) => ({
          role: message.role,
          content: message.content,
          ...(message.toolCallId ? { tool_call_id: message.toolCallId } : {}),
        })),
        temperature: request.temperature,
        max_tokens: request.maxTokens,
        tools: toOpenAITools(request.tools),
        stream: false,
      }),
    });

    if (!response.ok) {
      const bodyText = await response.text().catch(() => "");
      throw new AIProviderError(
        `Chat request failed: ${response.status} ${response.statusText} ${bodyText}`.trim(),
        this.id,
        response.status,
      );
    }

    const body = (await response.json()) as OpenAIChatCompletionResponse;
    const choice = body.choices[0];
    if (!choice) {
      throw new AIProviderError("Provider returned no choices", this.id);
    }

    const toolCalls: AIToolCall[] | undefined = choice.message.tool_calls?.map((call) => ({
      id: call.id,
      name: call.function.name,
      arguments: call.function.arguments,
    }));

    return {
      content: choice.message.content ?? "",
      model: body.model ?? request.model,
      usage: {
        inputTokens: body.usage?.prompt_tokens ?? 0,
        outputTokens: body.usage?.completion_tokens ?? 0,
      },
      finishReason: choice.finish_reason,
      toolCalls,
    };
  }

  async *stream(request: AIRequest): AsyncIterable<AIChunk> {
    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        model: request.model,
        messages: request.messages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
        temperature: request.temperature,
        max_tokens: request.maxTokens,
        stream: true,
      }),
    });

    if (!response.ok || !response.body) {
      throw new AIProviderError(
        `Stream request failed: ${response.status} ${response.statusText}`,
        this.id,
        response.status,
      );
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice("data:".length).trim();
          if (payload === "[DONE]") {
            yield { delta: "", done: true };
            return;
          }
          try {
            const parsed = JSON.parse(payload) as {
              choices: Array<{ delta?: { content?: string } }>;
            };
            const delta = parsed.choices[0]?.delta?.content ?? "";
            if (delta) yield { delta, done: false };
          } catch (error) {
            logger.warn({ providerId: this.id, error }, "failed to parse SSE chunk");
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    yield { delta: "", done: true };
  }
}
