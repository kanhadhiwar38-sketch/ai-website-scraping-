import type { ZodType } from "zod";
import { ValidationError } from "@webrecon/shared";

const CODE_FENCE_PATTERN = /^```(?:json)?\s*([\s\S]*?)\s*```$/;

/**
 * LLMs asked for "raw JSON only" frequently still wrap it in a markdown
 * code fence. Strip that before parsing rather than instructing-and-hoping.
 */
function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  const match = CODE_FENCE_PATTERN.exec(trimmed);
  return match ? (match[1] as string) : trimmed;
}

/**
 * Parses `content` as JSON and validates it against `schema`. Because the
 * target schemas (AIAnalysisContent, ImplementationPlanContent) default
 * every array/object field, a model that only partially follows the
 * requested shape still produces a usable, fully-typed result rather than
 * failing outright — but genuinely malformed JSON still throws a clear
 * ValidationError rather than silently returning empty defaults for
 * everything.
 */
export function parseJsonResponse<T>(content: string, schema: ZodType<T>): T {
  const jsonText = stripCodeFence(content);

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (error) {
    throw new ValidationError(
      `AI response was not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new ValidationError(`AI response did not match expected shape: ${result.error.message}`);
  }

  return result.data;
}
