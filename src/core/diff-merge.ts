import fg from 'fast-glob';
import { join } from 'node:path';
import { readTextFile } from '../utils/file-system.js';
import { resolveSpecforgePath } from '../utils/path-utils.js';
import { SPECS_DIR, CHANGES_DIR } from '../utils/constants.js';
import { loadGlobalConfig } from './global-config.js';
import { createAIProvider } from './ai-provider.js';
import { logger } from '../utils/logger.js';

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

export interface MergeOptions {
  useAi?: boolean;
}

/**
 * Merge delta specs from a change into the main specs directory.
 */
export async function mergeSpecs(
  projectRoot: string,
  changeName: string,
  options: MergeOptions = {},
): Promise<{ merged: string[]; conflicts: string[] }> {
  const { writeTextFile, ensureDir } = await import('../utils/file-system.js');
  const mainSpecsDir = resolveSpecforgePath(projectRoot, SPECS_DIR);
  const diffs = await diffSpecs(projectRoot, changeName);

  const merged: string[] = [];
  const conflicts: string[] = [];

  let aiProvider = null;
  if (options.useAi) {
    const globalConfig = await loadGlobalConfig();
    const aiConfig = globalConfig.ai;
    if (!aiConfig) {
      throw new Error(
        'AI configuration not found in global config. Run `specforge config set ai.provider ...` first.',
      );
    }
    // ensure type match
    aiProvider = await createAIProvider({
      provider: aiConfig.provider || 'openai',
      model: aiConfig.model,
      apiKey: aiConfig.apiKey,
      baseUrl: aiConfig.baseUrl,
    });
  }

  for (const diff of diffs) {
    if (diff.type === 'unchanged' || !diff.changeContent) continue;

    const targetPath = join(mainSpecsDir, diff.file);
    await ensureDir(join(targetPath, '..'));

    let contentToWrite = diff.changeContent;

    // Semantic Smart Merge
    if (diff.type === 'modified' && options.useAi && aiProvider && diff.mainContent) {
      logger.info(`Semantically merging ${diff.file}...`);
      const prompt = `You are an expert software architect and technical writer.
You need to merge two versions of a specification file: the MAIN version and the NEW version.
Resolve any conflicts intelligently, ensuring no business logic or acceptance criteria from either version are lost.
Output ONLY the final merged Markdown content.

=== MAIN VERSION ===
${diff.mainContent}

=== NEW VERSION ===
${diff.changeContent}

=== FINAL MERGED CONTENT ===`;

      try {
        contentToWrite = await aiProvider.generate(prompt);
      } catch (e) {
        logger.warn(
          `AI merge failed for ${diff.file}, falling back to overwrite: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }

    await writeTextFile(targetPath, contentToWrite);
    merged.push(diff.file);
  }

  return { merged, conflicts };
}
