#!/usr/bin/env node

import { startServer } from './server.js';

const args = process.argv.slice(2);

function getArg(name: string): string | undefined {
  const idx = args.indexOf(name);
  if (idx !== -1 && idx + 1 < args.length) {
    return args[idx + 1];
  }
  // Also support --name=value format
  const prefix = `${name}=`;
  const match = args.find((a) => a.startsWith(prefix));
  return match?.slice(prefix.length);
}

const url = getArg('--url');
const authKey = getArg('--auth');

if (!url && !authKey) {
  console.error('Usage: runcontext-db --url <connection-string>');
  console.error('       runcontext-db --auth <provider:key>');
  console.error('');
  console.error('Examples:');
  console.error('  runcontext-db --url postgres://user:pass@localhost:5432/mydb');
  console.error('  runcontext-db --url mysql://user:pass@localhost:3306/mydb');
  console.error('  runcontext-db --url /path/to/database.duckdb');
  console.error('  runcontext-db --url /path/to/database.sqlite');
  console.error('  runcontext-db --auth neon:my-project');
  process.exit(1);
}

if (authKey) {
  import('@runcontext/core').then(async ({ createDefaultRegistry, CredentialStore, resolveAuthConnection }) => {
    const registry = createDefaultRegistry();
    const store = new CredentialStore();
    const resolvedUrl = await resolveAuthConnection(authKey, registry, store);
    return startServer(resolvedUrl);
  }).catch((err) => {
    console.error('Failed to resolve auth credentials:', err);
    process.exit(1);
  });
} else {
  startServer(url!).catch((err) => {
    console.error('Failed to start runcontext-db server:', err);
    process.exit(1);
  });
}
