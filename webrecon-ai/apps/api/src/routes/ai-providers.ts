import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AIProviderConfig } from "@webrecon/types";
import { NotFoundError, ForbiddenError, generateId, nowIso } from "@webrecon/shared";
import { getFirebaseAdminFirestore } from "@webrecon/firebase/admin";
import { COLLECTIONS } from "@webrecon/firebase";
import {
  OpenAICompatibleProvider,
  OpenRouterProvider,
  OPENROUTER_BASE_URL,
  AIProviderError,
} from "@webrecon/ai-providers";
import { AIModelRegistry, AIProviderRegistry, buildProviderRegistryForUser } from "@webrecon/ai-router";
import { summarizeUsage } from "@webrecon/ai";

const ProviderIdParams = z.object({ id: z.string().min(1) });

const CreateProviderInput = z.object({
  name: z.string().min(1),
  kind: z.enum(["openrouter", "custom"]),
  apiKey: z.string().min(1),
  /** Required for kind="custom"; ignored for kind="openrouter" (always OpenRouter's own URL). */
  baseURL: z.string().url().optional(),
});

export default async function aiProviderRoutes(app: FastifyInstance) {
  const db = getFirebaseAdminFirestore;

  async function requireOwnedProviderConfig(id: string, userId: string) {
    const doc = await db().collection(COLLECTIONS.aiProviders).doc(id).get();
    if (!doc.exists) throw new NotFoundError("AI provider not found");
    const config = AIProviderConfig.parse(doc.data());
    if (config.userId !== userId) throw new ForbiddenError();
    return config;
  }

  app.get("/ai/providers", async (request) => {
    const userId = request.requireUserId();
    const snapshot = await db()
      .collection(COLLECTIONS.aiProviders)
      .where("userId", "==", userId)
      .get();
    const providers = snapshot.docs.map((doc) => AIProviderConfig.parse(doc.data()));
    return { providers };
  });

  app.post("/ai/providers", async (request, reply) => {
    const userId = request.requireUserId();
    const input = CreateProviderInput.parse(request.body);

    if (input.kind === "custom" && !input.baseURL) {
      return reply.status(400).send({
        error: { code: "VALIDATION_ERROR", message: "baseURL is required for custom providers" },
      });
    }

    const id = generateId("aiprovider");
    const now = nowIso();
    const config = AIProviderConfig.parse({
      id,
      userId,
      kind: input.kind,
      name: input.name,
      baseURL: input.kind === "openrouter" ? OPENROUTER_BASE_URL : input.baseURL,
      status: "untested",
      disabled: false,
      createdAt: now,
      updatedAt: now,
    });

    // Config (public) and secret (server-only) are two separate documents,
    // written together — the API key never appears in `config`, so it can
    // never accidentally be returned from GET /ai/providers (spec Section 28).
    const batch = db().batch();
    batch.set(db().collection(COLLECTIONS.aiProviders).doc(id), config);
    batch.set(db().collection(COLLECTIONS.aiProviderSecrets).doc(id), { apiKey: input.apiKey });
    await batch.commit();

    return reply.status(201).send(config);
  });

  app.post("/ai/providers/:id/test", async (request) => {
    const userId = request.requireUserId();
    const { id } = ProviderIdParams.parse(request.params);
    const config = await requireOwnedProviderConfig(id, userId);

    const secretDoc = await db().collection(COLLECTIONS.aiProviderSecrets).doc(id).get();
    const apiKey = (secretDoc.data() as { apiKey?: string } | undefined)?.apiKey;
    if (!apiKey) throw new NotFoundError("No API key stored for this provider");

    const provider =
      config.kind === "openrouter"
        ? new OpenRouterProvider({ id: config.id, name: config.name, apiKey })
        : new OpenAICompatibleProvider({
            id: config.id,
            name: config.name,
            baseURL: config.baseURL,
            apiKey,
          });

    let status: "ok" | "error" = "ok";
    let errorMessage: string | undefined;
    try {
      await provider.listModels();
    } catch (error) {
      status = "error";
      errorMessage =
        error instanceof AIProviderError ? error.message : "Failed to connect to provider";
    }

    const updated: AIProviderConfig = {
      ...config,
      status,
      lastTestedAt: nowIso(),
      updatedAt: nowIso(),
    };
    await db().collection(COLLECTIONS.aiProviders).doc(id).set(updated);

    return { status, error: errorMessage };
  });

  app.post("/ai/providers/:id/models", async (request) => {
    const userId = request.requireUserId();
    const { id } = ProviderIdParams.parse(request.params);
    await requireOwnedProviderConfig(id, userId);

    // Reuse the same loader the Gateway uses so "what models does this
    // provider have" always reflects the same construction logic.
    const registry: AIProviderRegistry = await buildProviderRegistryForUser(userId);
    const modelRegistry = new AIModelRegistry(registry);
    const models = await modelRegistry.getModels(id, true);

    return { models };
  });

  app.delete("/ai/providers/:id", async (request, reply) => {
    const userId = request.requireUserId();
    const { id } = ProviderIdParams.parse(request.params);
    await requireOwnedProviderConfig(id, userId);

    const batch = db().batch();
    batch.delete(db().collection(COLLECTIONS.aiProviders).doc(id));
    batch.delete(db().collection(COLLECTIONS.aiProviderSecrets).doc(id));
    await batch.commit();

    return reply.status(204).send();
  });

  // spec Section 29 dashboard stats: total requests, tokens, estimated
  // cost, free vs paid request counts, per-provider breakdown.
  app.get("/ai/usage", async (request) => {
    const userId = request.requireUserId();
    return summarizeUsage(userId);
  });
}
