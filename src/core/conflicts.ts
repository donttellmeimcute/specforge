import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import fg from 'fast-glob';
import { resolveSpecforgePath } from '../utils/path-utils.js';
import { CHANGES_DIR, ARCHIVE_DIR } from '../utils/constants.js';
import { pathExists } from '../utils/file-system.js';

export interface Conflict {
  domain: string;
  file: string;
  changes: string[];
}

/**
 * Detect conflicts between active changes that modify the same spec domains.
 */
export async function detectConflicts(
  projectRoot: string,
): Promise<Conflict[]> {
  const changesDir = resolveSpecforgePath(projectRoot, CHANGES_DIR);

  if (!(await pathExists(changesDir))) {
    return [];
  }

  const entries = await readdir(changesDir, { withFileTypes: true });
  const changeSpecFiles = new Map<string, Set<string>>(); // file → set of change names

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === ARCHIVE_DIR) continue;

    const specsDir = join(changesDir, entry.name, 'specs');
    if (!(await pathExists(specsDir))) continue;

    const specFiles = await fg('**/*.md', { cwd: specsDir, onlyFiles: true });
    for (const file of specFiles) {
      if (!changeSpecFiles.has(file)) {
        changeSpecFiles.set(file, new Set());
      }
      changeSpecFiles.get(file)!.add(entry.name);
    }
  }

  const conflicts: Conflict[] = [];
  for (const [file, changes] of changeSpecFiles) {
    if (changes.size > 1) {
      conflicts.push({
        domain: file.split('/')[0] ?? file,
        file,
        changes: [...changes].sort(),
      });
    }
  }

  return conflicts;
}
