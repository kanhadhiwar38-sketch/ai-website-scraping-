import type { AIModel } from "@webrecon/types";

/**
 * Substring-matched against a model's id (case-insensitive). This is a
 * curated, explicitly-maintained ranking rather than a live benchmark feed
 * — spec Section 23 calls this "configured model rankings", i.e. operator
 * configuration, not something every provider reports. Update this table as
 * new strong coding models ship; it intentionally lives in one place so
 * that's a one-line change.
 *
 * Scores are 0-100. Order matters only in that more specific patterns
 * should appear before more general ones they'd otherwise be shadowed by.
 */
const CODING_MODEL_RANKINGS: Array<{ pattern: RegExp; score: number }> = [
  { pattern: /claude-(opus|sonnet)-4/i, score: 98 },
  { pattern: /claude-.*-4/i, score: 95 },
  { pattern: /gpt-5/i, score: 96 },
  { pattern: /o3/i, score: 94 },
  { pattern: /gpt-4\.1/i, score: 92 },
  { pattern: /deepseek-(coder|r1)/i, score: 90 },
  { pattern: /qwen.*coder/i, score: 88 },
  { pattern: /gpt-4o/i, score: 85 },
  { pattern: /claude-3/i, score: 85 },
  { pattern: /gemini-.*pro/i, score: 82 },
  { pattern: /codestral/i, score: 80 },
  { pattern: /llama-3\.1-70b|llama-3\.1-405b/i, score: 70 },
  { pattern: /mixtral/i, score: 60 },
];

/**
 * A model must support tool calling to be considered "coding-capable" at
 * all for this mode — code-generation workflows in this platform rely on
 * tool use (spec Section 32/33 coding-agent integration). Models without
 * tool support are excluded outright, regardless of ranking table matches.
 */
export function isCodingCapable(model: AIModel): boolean {
  return model.supportsTools === true && model.available !== false;
}

/** Looks up (or estimates) a coding-capability score for a model, 0-100. */
export function codingScore(model: AIModel): number {
  if (model.codingScore !== undefined) return model.codingScore;

  for (const { pattern, score } of CODING_MODEL_RANKINGS) {
    if (pattern.test(model.id)) return score;
  }

  // Unrecognized model: fall back to a capability-based estimate so new
  // models aren't excluded outright just for being absent from the table.
  let estimate = 50;
  if (model.supportsReasoning) estimate += 10;
  if (model.supportsStructuredOutput) estimate += 5;
  if (model.contextLength && model.contextLength >= 100_000) estimate += 10;
  return estimate;
}

/** Ranks coding-capable models best-first for BEST_CODING mode. */
export function rankCodingModels(models: AIModel[]): AIModel[] {
  return models
    .filter(isCodingCapable)
    .sort((a, b) => codingScore(b) - codingScore(a));
}
