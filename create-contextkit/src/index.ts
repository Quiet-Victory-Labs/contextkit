import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const templatesDir = path.resolve(__dirname, '..', 'templates', 'minimal');

function toKebabCase(input: string): string {
  return input
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

function toTitleCase(input: string): string {
  return input
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function copyDir(src: string, dest: string, createdFiles: string[], projectDir: string, projectName: string, displayName: string): void {
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      copyDir(srcPath, destPath, createdFiles, projectDir, projectName, displayName);
    } else if (entry.name.endsWith('.template')) {
      // Process template files: replace placeholders and remove .template extension
      let content = fs.readFileSync(srcPath, 'utf-8');
      content = content.replace(/\{\{PROJECT_NAME\}\}/g, projectName);
      content = content.replace(/\{\{PROJECT_DISPLAY_NAME\}\}/g, displayName);
      const finalPath = destPath.replace(/\.template$/, '');
      fs.writeFileSync(finalPath, content, 'utf-8');
      createdFiles.push(path.relative(projectDir, finalPath));
    } else {
      fs.copyFileSync(srcPath, destPath);
      createdFiles.push(path.relative(projectDir, destPath));
    }
  }
}

function main(): void {
  const projectNameArg = process.argv[2];

  if (!projectNameArg) {
    console.log('Usage: create-contextkit <project-name>');
    console.log('');
    console.log('Example:');
    console.log('  npm create contextkit my-project');
    console.log('  pnpm create contextkit my-project');
    process.exit(1);
  }

  const projectName = toKebabCase(projectNameArg);
  const displayName = toTitleCase(projectName);
  const projectDir = path.resolve(process.cwd(), projectName);

  // Check if directory already exists
  if (fs.existsSync(projectDir)) {
    console.error(`Error: Directory "${projectName}" already exists. Please choose a different name or remove the existing directory.`);
    process.exit(1);
  }

  console.log(`Creating ContextKit project: ${projectName}`);
  console.log('');

  // Create project directory
  fs.mkdirSync(projectDir, { recursive: true });

  // Copy template files
  const createdFiles: string[] = [];
  copyDir(templatesDir, projectDir, createdFiles, projectDir, projectName, displayName);

  // Print created files
  for (const file of createdFiles) {
    console.log(`  Created ${file}`);
  }

  console.log('');
  console.log('Done! Next steps:');
  console.log(`  cd ${projectName}`);
  console.log('  pnpm add -D @runcontext/cli');
  console.log('  npx context lint');
  console.log('  npx context tier');
}

main();
