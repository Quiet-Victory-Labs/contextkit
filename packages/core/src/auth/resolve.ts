import type { ProviderRegistry } from './registry.js';
import type { CredentialStore } from './credential-store.js';

/**
 * Resolve an `auth:` config reference (e.g. "neon:ep-red-rain") into
 * a live connection string. Called at runtime — never writes to disk.
 *
 * 1. Load stored credential by key
 * 2. Look up provider plugin
 * 3. Validate credentials (refresh if needed)
 * 4. Call provider.getConnectionString()
 */
export async function resolveAuthConnection(
  authKey: string,
  registry: ProviderRegistry,
  store: CredentialStore,
): Promise<string> {
  const cred = await store.load(authKey);
  if (!cred) {
    throw new Error(`No stored credential found for "${authKey}". Run \`context auth\` to authenticate.`);
  }

  const providerId = authKey.split(':')[0]!;
  const provider = registry.get(providerId);
  if (!provider) {
    throw new Error(`No auth provider registered for "${providerId}".`);
  }

  // Validate and refresh if needed
  const valid = await provider.validateCredentials(cred);
  if (!valid) {
    // Attempt re-authentication
    const result = await provider.authenticate();
    if (!result.ok) {
      throw new Error(`Re-authentication with ${provider.displayName} failed: ${result.error}`);
    }
    cred.token = result.token;
    cred.expiresAt = result.expiresAt;
    await store.save(cred);
  }

  // Build connection string from credential metadata
  const dbEntry = {
    id: authKey.split(':').slice(1).join(':'),
    name: (cred.metadata?.database as string) ?? '',
    host: (cred.metadata?.host as string) ?? '',
    adapter: provider.adapters[0]!,
    metadata: cred.metadata,
  } as import('./types.js').DatabaseEntry;

  return provider.getConnectionString(dbEntry);
}
