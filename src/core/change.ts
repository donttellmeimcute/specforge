import { join } from 'node:path';
import { stringify as stringifyYaml } from 'yaml';
import {
  ensureDir,
  writeTextFile,
  pathExists,
  readTextFile,
} from '../utils/file-system.js';
import { resolveSpecforgePath } from '../utils/path-utils.js';
import { CHANGES_DIR, METADATA_FILE } from '../utils/constants.js';
import { ChangeMetadata } from './artifact-graph/types.js';
import { resolveSchema } from './artifact-graph/resolver.js';
import { logger } from '../utils/logger.js';
import { pluginManager } from './plugins.js';

export interface NewChangeOptions {
  schema?: string;
  tags?: string[];
  author?: string;
  asana?: string;
}

/**
 * Create a new change directory with metadata and initial artifact stubs.
 */
export async function createChange(
  projectRoot: string,
  changeName: string,
  options: NewChangeOptions = {},
): Promise<string> {
  // Validate name
  if (!/^[a-z0-9][a-z0-9-]*$/.test(changeName)) {
    throw new Error(
      `Invalid change name "${changeName}". Use lowercase alphanumeric with hyphens.`,
    );
  }

  const changeDir = resolveSpecforgePath(projectRoot, CHANGES_DIR, changeName);

  if (await pathExists(changeDir)) {
    throw new Error(`Change "${changeName}" already exists at ${changeDir}`);
  }

  await pluginManager.executeHook('beforeCreateChange', {
    projectRoot,
    changeName,
    changeDir,
    options,
  });

  // Resolve schema to validate it exists
  const schemaName = options.schema;
  if (schemaName) {
    await resolveSchema(schemaName, projectRoot);
  }

  // Create directory
  await ensureDir(changeDir);

  // Write metadata
  const now = new Date().toISOString();
  const metadata: ChangeMetadata = {
    schema: options.schema,
    createdAt: now,
    updatedAt: now,
    status: 'active',
    tags: options.tags || [],
    author: options.author,
  };

  await writeTextFile(
    join(changeDir, METADATA_FILE),
    stringifyYaml(metadata, { lineWidth: 100 }),
  );

  // Create specs subdirectory
  await ensureDir(join(changeDir, 'specs'));

  logger.success(`Change "${changeName}" created`);
  logger.info(`Path: ${changeDir}`);

  await pluginManager.executeHook('afterCreateChange', {
    projectRoot,
    changeName,
    changeDir,
    options,
  });

  return changeDir;
}

/** Load metadata for a change */
export async function loadChangeMetadata(
  changeDir: string,
): Promise<ChangeMetadata | null> {
  const { parse: parseYaml } = await import('yaml');
  const { ChangeMetadataSchema, safeParse } = await import('./artifact-graph/types.js');

  const content = await readTextFile(join(changeDir, METADATA_FILE));
  if (!content) return null;

  try {
    const raw = parseYaml(content);
    const result = safeParse(ChangeMetadataSchema, raw);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

/** Update metadata for a change */
export async function updateChangeMetadata(
  changeDir: string,
  updates: Partial<ChangeMetadata>,
): Promise<void> {
  const current = await loadChangeMetadata(changeDir);
  if (!current) {
    throw new Error(`No metadata found in ${changeDir}`);
  }

  const updated: ChangeMetadata = {
    ...current,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  await writeTextFile(
    join(changeDir, METADATA_FILE),
    stringifyYaml(updated, { lineWidth: 100 }),
  );
}
