import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ApiKey } from "@webrecon/types";
import { NotFoundError, ForbiddenError, generateId, nowIso } from "@webrecon/shared";
import { generateApiKey } from "@webrecon/security";
import { getFirebaseAdminFirestore } from "@webrecon/firebase/admin";
import { COLLECTIONS } from "@webrecon/firebase";

const ApiKeyIdParams = z.object({ id: z.string().min(1) });
const CreateApiKeyInput = z.object({ label: z.string().min(1).max(100) });

export default async function apiKeyRoutes(app: FastifyInstance) {
  const db = getFirebaseAdminFirestore;

  app.get("/api-keys", async (request) => {
    const userId = request.requireUserId();
    const snapshot = await db().collection(COLLECTIONS.apiKeys).where("userId", "==", userId).get();
    // hashedKey is part of the stored record but must never round-trip to the client.
    const keys = snapshot.docs.map((doc) => {
      const { hashedKey: _hashedKey, ...rest } = ApiKey.parse(doc.data());
      return rest;
    });
    return { keys };
  });

  app.post("/api-keys", async (request, reply) => {
    const userId = request.requireUserId();
    const { label } = CreateApiKeyInput.parse(request.body);

    const generated = generateApiKey();
    const id = generateId("apikey");
    const record = ApiKey.parse({
      id,
      userId,
      label,
      prefix: generated.prefix,
      hashedKey: generated.hash,
      createdAt: nowIso(),
    });

    await db().collection(COLLECTIONS.apiKeys).doc(id).set(record);

    // The raw key is returned exactly once, here, and never again — the
    // server only ever stores its hash from this point forward.
    const { hashedKey: _hashedKey, ...publicRecord } = record;
    return reply.status(201).send({ ...publicRecord, key: generated.raw });
  });

  app.post("/api-keys/:id/revoke", async (request) => {
    const userId = request.requireUserId();
    const { id } = ApiKeyIdParams.parse(request.params);

    const doc = await db().collection(COLLECTIONS.apiKeys).doc(id).get();
    if (!doc.exists) throw new NotFoundError("API key not found");
    const record = ApiKey.parse(doc.data());
    if (record.userId !== userId) throw new ForbiddenError();

    await db().collection(COLLECTIONS.apiKeys).doc(id).set({ revokedAt: nowIso() }, { merge: true });
    return { revoked: true };
  });

  app.delete("/api-keys/:id", async (request, reply) => {
    const userId = request.requireUserId();
    const { id } = ApiKeyIdParams.parse(request.params);

    const doc = await db().collection(COLLECTIONS.apiKeys).doc(id).get();
    if (!doc.exists) throw new NotFoundError("API key not found");
    const record = ApiKey.parse(doc.data());
    if (record.userId !== userId) throw new ForbiddenError();

    await db().collection(COLLECTIONS.apiKeys).doc(id).delete();
    return reply.status(204).send();
  });
}
