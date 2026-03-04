// ContextKit CLI v0.2

import { Command } from 'commander';
import { lintCommand } from './commands/lint.js';
import { buildCommand } from './commands/build.js';
import { tierCommand } from './commands/tier.js';
import { explainCommand } from './commands/explain.js';
import { fixCommand } from './commands/fix.js';
import { devCommand } from './commands/dev.js';
import { initCommand } from './commands/init.js';
import { siteCommand } from './commands/site.js';
import { serveCommand } from './commands/serve.js';
import { validateOsiCommand } from './commands/validate-osi.js';
import { introspectCommand } from './commands/introspect.js';

const program = new Command();

program
  .name('context')
  .description('ContextKit — AI-ready metadata governance over OSI')
  .version('0.2.0');

// Register all commands
program.addCommand(lintCommand);
program.addCommand(buildCommand);
program.addCommand(tierCommand);
program.addCommand(explainCommand);
program.addCommand(fixCommand);
program.addCommand(devCommand);
program.addCommand(initCommand);
program.addCommand(siteCommand);
program.addCommand(serveCommand);
program.addCommand(validateOsiCommand);
program.addCommand(introspectCommand);

program.parse();
