import type { AuthProvider } from './types.js';

/**
 * Registry of all available auth providers.
 * Providers are registered at startup; CLI, wizard, and db server all
 * look up providers from the same registry.
 */
export class ProviderRegistry {
  private providers = new Map<string, AuthProvider>();

  register(provider: AuthProvider): void {
    this.providers.set(provider.id, provider);
  }

  get(id: string): AuthProvider | undefined {
    return this.providers.get(id);
  }

  getAll(): AuthProvider[] {
    return Array.from(this.providers.values());
  }

  listIds(): string[] {
    return Array.from(this.providers.keys());
  }
}
