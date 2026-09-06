import { getFirebaseAdminFirestore } from "@webrecon/firebase/admin";
import { COLLECTIONS } from "@webrecon/firebase";
import { generateId, nowIso } from "@webrecon/shared";
import {
  AIAnalysis,
  ImplementationPlan,
  ImplementationPlanContent,
  type AIMode,
} from "@webrecon/types";
import type { AIGateway } from "./gateway.js";
import { parseJsonResponse } from "./json-response.js";

const SYSTEM_PROMPT = `You are a senior front-end architect. You are given a structured analysis \
of a website (siteType, components, navigation, layout, colors, fonts, forms, API summary) that \
was produced by inspecting a live, authorized crawl. Produce a concrete, independent \
reimplementation plan -- routes, components, state management approach, API integration points, \
responsive behavior notes, and a testing plan. This must be an original implementation plan, not \
a description of copying any proprietary source code (which you were never given access to).

Respond with ONLY a single JSON object (no prose, no markdown fences) matching exactly this shape:
{
  "routes": string[],
  "components": string[],
  "pages": string[],
  "stateManagement": string,
  "apiIntegration": string[],
  "responsiveBehavior": string,
  "testingPlan": string[]
}`;

export interface PlanImplementationInput {
  userId: string;
  projectId: string;
  mode: AIMode;
  providerId?: string;
  model?: string;
  analysis: AIAnalysis;
}

export async function planImplementation(
  gateway: AIGateway,
  input: PlanImplementationInput,
): Promise<ImplementationPlan> {
  // Send the analysis without its bookkeeping fields (id/userId/projectId/
  // createdAt) -- the model only needs the content, not our record-keeping.
  const {
    id: _id,
    userId: _userId,
    projectId: _projectId,
    createdAt: _createdAt,
    ...analysisContent
  } = input.analysis;

  const response = await gateway.chat({
    mode: input.mode,
    taskType: "IMPLEMENTATION_PLAN",
    userId: input.userId,
    projectId: input.projectId,
    providerId: input.providerId,
    model: input.model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: JSON.stringify(analysisContent) },
    ],
    temperature: 0.2,
    maxTokens: 3000,
  });

  const content = parseJsonResponse(response.content, ImplementationPlanContent);

  const plan = ImplementationPlan.parse({
    id: generateId("plan"),
    userId: input.userId,
    projectId: input.projectId,
    createdAt: nowIso(),
    ...content,
  });

  await getFirebaseAdminFirestore()
    .collection(COLLECTIONS.implementationPlans)
    .doc(plan.id)
    .set(plan);

  return plan;
}
