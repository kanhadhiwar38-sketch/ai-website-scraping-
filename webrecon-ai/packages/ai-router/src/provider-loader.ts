import { getFirebaseAdminFirestore } from "@webrecon/firebase/admin";
import { COLLECTIONS } from "@webrecon/firebase";
import { AIProviderConfig } from "@webrecon/types";
import { OpenAICompatibleProvider, OpenRouterProvider } from "@webrecon/ai-providers";
import { createLogger } from "@webrecon/logger";
import { AIProviderRegistry } from "./provider-registry.js";

const logger = createLogger({ name: "ai-provider-loader" });

async function getSecretApiKey(providerId: string): Promise<string | undefined> {
  const db = getFirebaseAdminFirestore();
  const doc = await db.collection(COLLECTIONS.aiProviderSecrets).doc(providerId).get();
  if (!doc.exists) return undefined;
  const data = doc.data() as { apiKey?: string } | undefined;
  return data?.apiKey;
}

/**
 * Loads every enabled provider configured for a user (Firestore
 * `aiProviders`, keys from the server-only `aiProviderSecrets` collection —
 * spec Section 28: provider keys never leave the server) and registers a
 * built-in OpenRouter provider too: the user's own OpenRouter config if
 * they've added one, otherwise the platform default from
 * `OPENROUTER_API_KEY` if that env var is set.
 */
export async function buildProviderRegistryForUser(userId: string): Promise<AIProviderRegistry> {
  const registry = new AIProviderRegistry();
  const db = getFirebaseAdminFirestore();

  const snapshot = await db
    .collection(COLLECTIONS.aiProviders)
    .where("userId", "==", userId)
    .where("disabled", "==", false)
    .get();

  const configs = snapshot.docs.map((doc) => AIProviderConfig.parse(doc.data()));

  let userConfiguredOpenRouter = false;

  for (const config of configs) {
    const apiKey = await getSecretApiKey(config.id);
    if (!apiKey) {
      logger.warn({ providerId: config.id }, "provider config has no stored API key, skipping");
      continue;
    }

    if (config.kind === "openrouter") {
      registry.register(new OpenRouterProvider({ id: config.id, name: config.name, apiKey }));
      userConfiguredOpenRouter = true;
    } else {
      registry.register(
        new OpenAICompatibleProvider({
          id: config.id,
          name: config.name,
          baseURL: config.baseURL,
          apiKey,
        }),
      );
    }
  }

  const platformOpenRouterKey = process.env.OPENROUTER_API_KEY;
  if (!userConfiguredOpenRouter && platformOpenRouterKey) {
    registry.register(new OpenRouterProvider({ id: "openrouter", apiKey: platformOpenRouterKey }));
  }

  return registry;
}
