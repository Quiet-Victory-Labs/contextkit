import { Command } from 'commander';
import chalk from 'chalk';
import path from 'node:path';
import fs from 'node:fs';
import { formatSuccess, formatError } from '../formatters/pretty.js';

const EXAMPLE_OSI = `version: "1.0"

semantic_model:
  - name: example-model
    description: An example semantic model
    ai_context:
      instructions: "Use this model for general analytics queries"
      synonyms: ["example", "sample model"]

    datasets:
      - name: example_table
        source: warehouse.public.example_table
        primary_key: [id]
        description: "Example table"
        fields:
          - name: id
            expression:
              dialects:
                - dialect: ANSI_SQL
                  expression: id
            description: "Primary key"
            type: number
          - name: name
            expression:
              dialects:
                - dialect: ANSI_SQL
                  expression: name
            description: "Name field"
            type: string
`;

const EXAMPLE_GOVERNANCE = `model: example-model
owner: data-team
classification: internal
security:
  pii: false
  access_level: internal
datasets:
  example_table:
    grain: one row per example entity
    fields:
      id:
        description: "Primary key"
      name:
        description: "Name field"
`;

const EXAMPLE_TERM = `glossary:
  - term: Example Term
    definition: A sample glossary term to demonstrate the format
    aliases: ["sample term"]
    owner: data-team
`;

const EXAMPLE_OWNER = `team: data-team
name: Data Team
email: data-team@example.com
slack: "#data-team"
members:
  - name: Jane Doe
    role: lead
`;

const EXAMPLE_CONFIG = `context_dir: context
output_dir: dist
minimum_tier: bronze
`;

export const initCommand = new Command('init')
  .description('Scaffold a v0.2 RunContext project structure')
  .option('--dir <path>', 'Root directory for the project', '.')
  .action(async (opts) => {
    try {
      const rootDir = path.resolve(opts.dir);
      const contextDir = path.join(rootDir, 'context');

      // Create directory structure
      const dirs = [
        path.join(contextDir, 'models'),
        path.join(contextDir, 'governance'),
        path.join(contextDir, 'glossary'),
        path.join(contextDir, 'owners'),
      ];

      for (const dir of dirs) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Write example files (only if they don't already exist)
      const files: Array<{ path: string; content: string }> = [
        {
          path: path.join(contextDir, 'models', 'example-model.osi.yaml'),
          content: EXAMPLE_OSI,
        },
        {
          path: path.join(
            contextDir,
            'governance',
            'example-model.governance.yaml',
          ),
          content: EXAMPLE_GOVERNANCE,
        },
        {
          path: path.join(contextDir, 'glossary', 'glossary.term.yaml'),
          content: EXAMPLE_TERM,
        },
        {
          path: path.join(contextDir, 'owners', 'data-team.owner.yaml'),
          content: EXAMPLE_OWNER,
        },
        {
          path: path.join(rootDir, 'runcontext.config.yaml'),
          content: EXAMPLE_CONFIG,
        },
      ];

      let created = 0;
      let skipped = 0;

      for (const file of files) {
        if (fs.existsSync(file.path)) {
          console.log(chalk.gray(`  skip ${path.relative(rootDir, file.path)} (exists)`));
          skipped++;
        } else {
          fs.writeFileSync(file.path, file.content, 'utf-8');
          console.log(chalk.green(`  create ${path.relative(rootDir, file.path)}`));
          created++;
        }
      }

      console.log('');
      console.log(
        formatSuccess(
          `Initialized RunContext project: ${created} file(s) created, ${skipped} skipped.`,
        ),
      );
      console.log('');
      console.log(chalk.gray('Next steps:'));
      console.log(chalk.gray('  1. Edit the example files in context/'));
      console.log(chalk.gray('  2. Run: context lint'));
      console.log(chalk.gray('  3. Run: context build'));
    } catch (err) {
      console.error(formatError((err as Error).message));
      process.exit(1);
    }
  });
