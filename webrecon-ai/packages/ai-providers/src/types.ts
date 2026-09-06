import type { AIModel } from "@webrecon/types";

export type AIMessageRole = "system" | "user" | "assistant" | "tool";

export interface AIMessage {
  role: AIMessageRole;
  content: string;
  /** Present when role is "tool" — which tool call this message answers. */
  toolCallId?: string;
}

export interface AIToolDefinition {
  name: string;
  description?: string;
  /** JSON Schema for the tool's parameters. */
  parameters?: Record<string, unknown>;
}

export interface AIRequest {
  model: string;
  messages: AIMessage[];
  temperature?: number;
  maxTokens?: number;
  tools?: AIToolDefinition[];
  /** Ask the provider to constrain output to this JSON Schema, if it supports structured output. */
  responseSchema?: Record<string, unknown>;
}

export interface AIToolCall {
  id: string;
  name: string;
  arguments: string;
}

export interface AIResponse {
  content: string;
  model: string;
  usage: { inputTokens: number; outputTokens: number };
  finishReason?: string;
  toolCalls?: AIToolCall[];
}

export interface AIChunk {
  delta: string;
  done: boolean;
}

/**
 * Every AI backend WebRecon talks to — OpenRouter or a custom
 * OpenAI-compatible endpoint — implements this same interface (spec
 * Section 20). The AI Router only ever depends on this shape, never on a
 * specific provider's SDK.
 */
export interface AIProvider {
  id: string;
  name: string;
  baseURL: string;
  listModels(): Promise<AIModel[]>;
  chat(request: AIRequest): Promise<AIResponse>;
  stream(request: AIRequest): AsyncIterable<AIChunk>;
}

export class AIProviderError extends Error {
  constructor(
    message: string,
    readonly providerId: string,
    readonly statusCode?: number,
  ) {
    super(message);
    this.name = "AIProviderError";
  }
}
