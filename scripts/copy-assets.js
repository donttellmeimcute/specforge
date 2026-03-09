import { cpSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// Copy YAML schemas
cpSync(
  join(root, 'src', 'core', 'artifact-graph', 'schemas'),
  join(root, 'dist', 'core', 'artifact-graph', 'schemas'),
  { recursive: true },
);

// Copy templates
cpSync(join(root, 'src', 'core', 'templates'), join(root, 'dist', 'core', 'templates'), {
  recursive: true,
});

console.log('Assets copied to dist/');
