import { Command } from 'commander';

export const serveCommand = new Command('serve')
  .description('Start the MCP server')
  .action(() => {
    console.log('MCP server coming soon.');
  });
