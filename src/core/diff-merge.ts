import fg from 'fast-glob';
import { join } from 'node:path';
import { readTextFile } from '../utils/file-system.js';
import { resolveSpecforgePath } from '../utils/path-utils.js';
import { SPECS_DIR, CHANGES_DIR } from '../utils/constants.js';

export interface DiffEntry {
  domain: string;
  file: string;
  type: 'added' | 'modified' | 'unchanged';
  mainContent: string | null;
  changeContent: string | null;
}

/**
 * Compare delta specs in a change against the main specs.
 */
export async function diffSpecs(
  projectRoot: string,
  changeName: string,
): Promise<DiffEntry[]> {
  const mainSpecsDir = resolveSpecforgePath(projectRoot, SPECS_DIR);
  const changeSpecsDir = resolveSpecforgePath(
    projectRoot,
    CHANGES_DIR,
    changeName,
    SPECS_DIR,
  );

  // Find all spec files in both dirs
  const mainFiles = await fg('**/*.md', {
    cwd: mainSpecsDir,
    onlyFiles: true,
  }).catch(() => [] as string[]);

  const changeFiles = await fg('**/*.md', {
    cwd: changeSpecsDir,
    onlyFiles: true,
  }).catch(() => [] as string[]);

  const allFiles = new Set([...mainFiles, ...changeFiles]);
  const diffs: DiffEntry[] = [];

  for (const file of allFiles) {
    const mainContent = await readTextFile(join(mainSpecsDir, file));
    const changeContent = await readTextFile(join(changeSpecsDir, file));

    const domain = file.split('/')[0] ?? file;

    let type: DiffEntry['type'];
    if (!mainContent && changeContent) {
      type = 'added';
    } else if (mainContent && changeContent && mainContent !== changeContent) {
      type = 'modified';
    } else {
      type = 'unchanged';
    }

    diffs.push({ domain, file, type, mainContent, changeContent });
  }

  return diffs;
}

/**
 * Merge delta specs from a change into the main specs directory.
 */
export async function mergeSpecs(
  projectRoot: string,
  changeName: string,
): Promise<{ merged: string[]; conflicts: string[] }> {
  const { writeTextFile, ensureDir } = await import('../utils/file-system.js');
  const mainSpecsDir = resolveSpecforgePath(projectRoot, SPECS_DIR);
  const diffs = await diffSpecs(projectRoot, changeName);

  const merged: string[] = [];
  const conflicts: string[] = [];

  for (const diff of diffs) {
    if (diff.type === 'unchanged' || !diff.changeContent) continue;

    const targetPath = join(mainSpecsDir, diff.file);
    await ensureDir(join(targetPath, '..'));
    await writeTextFile(targetPath, diff.changeContent);
    merged.push(diff.file);
  }

  return { merged, conflicts };
}
