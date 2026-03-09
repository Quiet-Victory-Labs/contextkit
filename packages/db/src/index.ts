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

if (!url) {
  console.error('Usage: runcontext-db --url <connection-string>');
  console.error('');
  console.error('Examples:');
  console.error('  runcontext-db --url postgres://user:pass@localhost:5432/mydb');
  console.error('  runcontext-db --url mysql://user:pass@localhost:3306/mydb');
  console.error('  runcontext-db --url /path/to/database.duckdb');
  console.error('  runcontext-db --url /path/to/database.sqlite');
  process.exit(1);
}

startServer(url).catch((err) => {
  console.error('Failed to start runcontext-db server:', err);
  process.exit(1);
});
