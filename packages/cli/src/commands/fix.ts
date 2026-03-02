import { Command } from 'commander';

export const fixCommand = new Command('fix')
  .description('Apply autofixes to context files')
  .action(() => {
    console.log("Fix command coming soon. Run 'context lint' to see issues.");
  });
