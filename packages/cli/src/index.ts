import { Command } from 'commander';
import { buildCommand } from './commands/build.js';
import { lintCommand } from './commands/lint.js';
import { initCommand } from './commands/init.js';
import { explainCommand } from './commands/explain.js';
import { fixCommand } from './commands/fix.js';
import { devCommand } from './commands/dev.js';
import { siteCommand } from './commands/site.js';
import { serveCommand } from './commands/serve.js';

const program = new Command();

program
  .name('context')
  .version('0.1.0')
  .description('ContextKit — Git-native institutional context compiler');

program.addCommand(buildCommand);
program.addCommand(lintCommand);
program.addCommand(initCommand);
program.addCommand(explainCommand);
program.addCommand(fixCommand);
program.addCommand(devCommand);
program.addCommand(siteCommand);
program.addCommand(serveCommand);

await program.parseAsync(process.argv);
