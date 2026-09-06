import type { AIProvider } from "@webrecon/ai-providers";

/**
 * In-memory registry of configured providers for a single request/user
 * context. Deliberately dumb — it doesn't know how providers were
 * constructed (see provider-loader.ts for that); it just holds instances
 * and hands them back by id.
 */
export class AIProviderRegistry {
  private readonly providers = new Map<string, AIProvider>();

  register(provider: AIProvider): void {
    this.providers.set(provider.id, provider);
  }

  get(id: string): AIProvider | undefined {
    return this.providers.get(id);
  }

  list(): AIProvider[] {
    return Array.from(this.providers.values());
  }

  has(id: string): boolean {
    return this.providers.has(id);
  }
}
