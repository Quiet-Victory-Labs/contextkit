import { Command } from 'commander';

export const devCommand = new Command('dev')
  .description('Watch context files and rebuild on change')
  .action(() => {
    console.log('Dev watch mode coming soon.');
  });
