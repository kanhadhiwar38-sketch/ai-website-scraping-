import type { AIModel, AITaskType } from "@webrecon/types";

/**
 * Task types that benefit meaningfully from specific model capabilities.
 * Used to weight scoring toward models that actually support what the task
 * needs, rather than scoring every task identically.
 */
const TASK_CAPABILITY_WEIGHTS: Partial<
  Record<AITaskType, { tools?: number; vision?: number; structuredOutput?: number; reasoning?: number }>
> = {
  CODE_GENERATION: { tools: 15, reasoning: 10 },
  CODE_REVIEW: { tools: 5, reasoning: 15 },
  DEBUGGING: { tools: 10, reasoning: 15 },
  IMPLEMENTATION_PLAN: { structuredOutput: 15, reasoning: 10 },
  SCREENSHOT_ANALYSIS: { vision: 25 },
  VISUAL_COMPARISON: { vision: 25 },
  WEBSITE_ANALYSIS: { structuredOutput: 10 },
  DOM_ANALYSIS: { structuredOutput: 10 },
  NETWORK_ANALYSIS: { structuredOutput: 5 },
};

const MAX_CONTEXT_SCORE = 20;
const CONTEXT_SCORE_REFERENCE = 128_000; // context length that earns the full context-length score

/**
 * Scores a model 0-100+ for a given task. Higher is better. Unavailable
 * models score -Infinity so they never win a comparison (callers should
 * still filter them out explicitly — this is a safety net, not the primary
 * filter).
 */
export function scoreModel(model: AIModel, taskType?: AITaskType): number {
  if (model.available === false) return Number.NEGATIVE_INFINITY;

  let score = 0;

  // Context length: diminishing returns, capped.
  if (model.contextLength) {
    score += Math.min(MAX_CONTEXT_SCORE, (model.contextLength / CONTEXT_SCORE_REFERENCE) * MAX_CONTEXT_SCORE);
  }

  // Baseline capability bonuses (useful regardless of task).
  if (model.supportsTools) score += 5;
  if (model.supportsStructuredOutput) score += 5;
  if (model.supportsReasoning) score += 5;

  // Task-specific bonuses on top of the baseline.
  const weights = taskType ? TASK_CAPABILITY_WEIGHTS[taskType] : undefined;
  if (weights) {
    if (weights.tools && model.supportsTools) score += weights.tools;
    if (weights.vision && model.supportsVision) score += weights.vision;
    if (weights.structuredOutput && model.supportsStructuredOutput) score += weights.structuredOutput;
    if (weights.reasoning && model.supportsReasoning) score += weights.reasoning;
  }

  // Cost: cheaper is better, but this is a mild tiebreaker, not the primary
  // signal — a much more capable expensive model should still usually win.
  const inputCost = model.pricePerMInputTokens ?? 0;
  score -= Math.min(10, inputCost / 2);

  return score;
}

/** Sorts candidates best-first using scoreModel, stable for ties (input order preserved). */
export function rankModels(models: AIModel[], taskType?: AITaskType): AIModel[] {
  return [...models]
    .filter((model) => model.available !== false)
    .sort((a, b) => scoreModel(b, taskType) - scoreModel(a, taskType));
}
