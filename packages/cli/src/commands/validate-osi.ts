import { Command } from 'commander';
import chalk from 'chalk';
import path from 'node:path';
import { parseFile, osiDocumentSchema } from '@runcontext/core';
import { formatJson } from '../formatters/json.js';
import { formatError, formatSuccess } from '../formatters/pretty.js';

export const validateOsiCommand = new Command('validate-osi')
  .description('Validate a single OSI file against the schema')
  .argument('<file>', 'Path to the OSI YAML file')
  .option('--format <type>', 'Output format: pretty or json', 'pretty')
  .action(async (file: string, opts) => {
    try {
      const filePath = path.resolve(file);

      // Parse the file
      const parsed = await parseFile(filePath, 'model');

      // Validate against the schema
      const result = osiDocumentSchema.safeParse(parsed.data);

      if (result.success) {
        if (opts.format === 'json') {
          console.log(
            formatJson({
              valid: true,
              file: filePath,
              data: result.data,
            }),
          );
        } else {
          console.log(formatSuccess(`${filePath} is valid.`));
        }
      } else {
        const issues = result.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        }));

        if (opts.format === 'json') {
          console.log(
            formatJson({
              valid: false,
              file: filePath,
              issues,
            }),
          );
        } else {
          console.error(chalk.red(`Validation failed for ${filePath}:`));
          for (const issue of issues) {
            console.error(chalk.red(`  ${issue.path}: ${issue.message}`));
          }
        }
        process.exit(1);
      }
    } catch (err) {
      console.error(formatError((err as Error).message));
      process.exit(1);
    }
  });
