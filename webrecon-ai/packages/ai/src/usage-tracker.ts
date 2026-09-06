import { getFirebaseAdminFirestore } from "@webrecon/firebase/admin";
import { COLLECTIONS } from "@webrecon/firebase";
import { generateId, nowIso } from "@webrecon/shared";
import { AIUsage, type AIModel, type AITaskType } from "@webrecon/types";

export interface RecordUsageInput {
  userId: string;
  projectId?: string;
  providerId: string;
  model: AIModel;
  taskType: AITaskType;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  status: "ok" | "error";
}

/** $/token pricing on AIModel is per-million-tokens (see packages/types). */
function estimateCost(model: AIModel, inputTokens: number, outputTokens: number): number {
  const inputCost = ((model.pricePerMInputTokens ?? 0) * inputTokens) / 1_000_000;
  const outputCost = ((model.pricePerMOutputTokens ?? 0) * outputTokens) / 1_000_000;
  return inputCost + outputCost;
}

export async function recordUsage(input: RecordUsageInput): Promise<AIUsage> {
  const usage = AIUsage.parse({
    id: generateId("usage"),
    userId: input.userId,
    projectId: input.projectId,
    providerId: input.providerId,
    model: input.model.id,
    taskType: input.taskType,
    inputTokens: input.inputTokens,
    outputTokens: input.outputTokens,
    estimatedCost: estimateCost(input.model, input.inputTokens, input.outputTokens),
    latencyMs: input.latencyMs,
    status: input.status,
    createdAt: nowIso(),
  });

  await getFirebaseAdminFirestore().collection(COLLECTIONS.aiUsage).doc(usage.id).set(usage);
  return usage;
}

export interface UsageSummary {
  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  estimatedCost: number;
  freeRequests: number;
  paidRequests: number;
  byProvider: Record<string, { requests: number; estimatedCost: number }>;
}

/** Aggregates a user's usage history for the dashboard (spec Section 29). */
export async function summarizeUsage(userId: string, limit = 5000): Promise<UsageSummary> {
  const snapshot = await getFirebaseAdminFirestore()
    .collection(COLLECTIONS.aiUsage)
    .where("userId", "==", userId)
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();

  const records = snapshot.docs.map((doc) => AIUsage.parse(doc.data()));

  const summary: UsageSummary = {
    totalRequests: records.length,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    estimatedCost: 0,
    freeRequests: 0,
    paidRequests: 0,
    byProvider: {},
  };

  for (const record of records) {
    summary.totalInputTokens += record.inputTokens;
    summary.totalOutputTokens += record.outputTokens;
    summary.estimatedCost += record.estimatedCost;
    if (record.estimatedCost === 0) summary.freeRequests += 1;
    else summary.paidRequests += 1;

    const providerStats = summary.byProvider[record.providerId] ?? {
      requests: 0,
      estimatedCost: 0,
    };
    providerStats.requests += 1;
    providerStats.estimatedCost += record.estimatedCost;
    summary.byProvider[record.providerId] = providerStats;
  }

  return summary;
}
