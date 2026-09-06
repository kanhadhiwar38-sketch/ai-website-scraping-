import { getFirebaseAdminFirestore } from "@webrecon/firebase/admin";
import { COLLECTIONS } from "@webrecon/firebase";
import { generateId, nowIso } from "@webrecon/shared";
import { AIAnalysis, AIAnalysisContent, type AIMode } from "@webrecon/types";
import type { AIGateway } from "./gateway.js";
import type { WebsiteAnalysisContext } from "./context-builder.js";
import { parseJsonResponse } from "./json-response.js";

const SYSTEM_PROMPT = `You are a senior front-end architect analyzing a website that has already \
been crawled and inspected by an authorized tool. You are given a structural summary — page \
headings/navigation text, DOM element counts by category, discovered asset counts by type, and \
a schema-only summary of the site's API calls (no secrets, no raw response values). You never \
received and must never claim to have seen server-side source code, credentials, or private data.

Respond with ONLY a single JSON object (no prose, no markdown fences) matching exactly this shape:
{
  "siteType": string,
  "pages": string[],
  "components": string[],
  "navigation": object,
  "layout": object,
  "colors": string[],
  "fonts": string[],
  "spacing": object,
  "responsiveBehavior": object,
  "forms": object[],
  "dataSources": string[],
  "apiSummary": object[],
  "assetSummary": object[]
}`;

export interface AnalyzeWebsiteInput {
  userId: string;
  projectId: string;
  mode: AIMode;
  providerId?: string;
  model?: string;
  context: WebsiteAnalysisContext;
}

export async function analyzeWebsite(gateway: AIGateway, input: AnalyzeWebsiteInput): Promise<AIAnalysis> {
  const response = await gateway.chat({
    mode: input.mode,
    taskType: "WEBSITE_ANALYSIS",
    userId: input.userId,
    projectId: input.projectId,
    providerId: input.providerId,
    model: input.model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: JSON.stringify(input.context) },
    ],
    temperature: 0.2,
    maxTokens: 4000,
  });

  const content = parseJsonResponse(response.content, AIAnalysisContent);

  const analysis = AIAnalysis.parse({
    id: generateId("analysis"),
    userId: input.userId,
    projectId: input.projectId,
    createdAt: nowIso(),
    ...content,
  });

  await getFirebaseAdminFirestore()
    .collection(COLLECTIONS.aiAnalyses)
    .doc(analysis.id)
    .set(analysis);

  return analysis;
}
