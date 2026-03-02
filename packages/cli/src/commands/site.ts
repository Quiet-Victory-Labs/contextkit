import { Command } from 'commander';

export const siteCommand = new Command('site')
  .description('Site generator commands');

siteCommand
  .command('build')
  .description('Build the context documentation site')
  .action(() => {
    console.log('Site generator coming soon.');
  });
