import { Command } from 'commander';
import fs from 'node:fs';
import path from 'node:path';

const SAMPLE_CONCEPT = `kind: concept
id: example-concept
definition: An example concept to get you started.
owner: example-team
tags:
  - example
status: draft
`;

const SAMPLE_OWNER = `kind: owner
id: example-team
displayName: Example Team
email: team@example.com
`;

function generateConfig(projectName: string): string {
  return `project:
  id: ${projectName}
  displayName: "${projectName}"
  version: "0.1.0"

paths:
  contextDir: context
  distDir: dist

lint:
  defaultSeverity: warning
`;
}

export const initCommand = new Command('init')
  .description('Create a new ContextKit project')
  .option('--name <name>', 'project name (defaults to directory basename)')
  .action((opts: { name?: string }) => {
    const cwd = process.cwd();
    const projectName = opts.name || path.basename(cwd);

    const dirs = [
      'context/concepts',
      'context/products',
      'context/policies',
      'context/entities',
      'context/owners',
      'context/terms',
    ];

    const files: Array<{ path: string; content: string }> = [
      { path: 'context/concepts/example-concept.ctx.yaml', content: SAMPLE_CONCEPT },
      { path: 'context/owners/example-team.owner.yaml', content: SAMPLE_OWNER },
      { path: 'contextkit.config.yaml', content: generateConfig(projectName) },
    ];

    // Create directories
    const created: string[] = [];
    for (const dir of dirs) {
      const fullPath = path.join(cwd, dir);
      fs.mkdirSync(fullPath, { recursive: true });
      created.push(dir + '/');
    }

    // Create files
    for (const file of files) {
      const fullPath = path.join(cwd, file.path);
      if (!fs.existsSync(fullPath)) {
        fs.writeFileSync(fullPath, file.content, 'utf-8');
        created.push(file.path);
      } else {
        console.log(`  Skipped (already exists): ${file.path}`);
      }
    }

    console.log(`Initialized ContextKit project "${projectName}":`);
    for (const item of created) {
      console.log(`  created ${item}`);
    }
  });
