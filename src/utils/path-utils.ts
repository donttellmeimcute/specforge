import { resolve, join } from 'node:path';
import { SPECFORGE_DIR } from './constants.js';
import { pathExists } from './file-system.js';

/**
 * Walk up the directory tree to find the nearest directory containing `.specforge/`.
 * Returns the project root path or null if not found.
 */
export async function findProjectRoot(startDir?: string): Promise<string | null> {
  let current = resolve(startDir ?? process.cwd());

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const candidate = join(current, SPECFORGE_DIR);
    if (await pathExists(candidate)) {
      return current;
    }

    const parent = resolve(current, '..');
    if (parent === current) {
      // Reached filesystem root without finding .specforge
      return null;
    }
    current = parent;
  }
}

/** Resolve a path relative to the `.specforge/` directory */
export function resolveSpecforgePath(projectRoot: string, ...segments: string[]): string {
  return join(projectRoot, SPECFORGE_DIR, ...segments);
}
