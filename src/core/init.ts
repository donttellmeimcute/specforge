import { join } from 'node:path';
import { stringify as stringifyYaml } from 'yaml';
import { ensureDir, writeTextFile, pathExists } from '../utils/file-system.js';
import {
  SPECFORGE_DIR,
  CONFIG_FILE,
  SPECS_DIR,
  CHANGES_DIR,
  SCHEMAS_DIR,
  ARCHIVE_DIR,
} from '../utils/constants.js';
import { ProjectConfig } from './artifact-graph/types.js';
import { logger } from '../utils/logger.js';

export interface InitOptions {
  schema?: string;
  context?: string;
}

/**
 * Initialize a new SpecForge project in the given directory.
 * Creates the .specforge/ structure with config.yaml and default directories.
 */
export async function initProject(
  projectDir: string,
  options: InitOptions = {},
): Promise<void> {
  const specforgeDir = join(projectDir, SPECFORGE_DIR);

  if (await pathExists(specforgeDir)) {
    throw new Error(
      `SpecForge already initialized in ${projectDir}. ` +
        `Remove ${SPECFORGE_DIR}/ to re-initialize.`,
    );
  }

  // Create directory structure
  await ensureDir(specforgeDir);
  await ensureDir(join(specforgeDir, SPECS_DIR));
  await ensureDir(join(specforgeDir, CHANGES_DIR));
  await ensureDir(join(specforgeDir, CHANGES_DIR, ARCHIVE_DIR));
  await ensureDir(join(specforgeDir, SCHEMAS_DIR));

  // Write config.yaml
  const config: ProjectConfig = {
    schema: options.schema ?? 'spec-driven',
    context: options.context,
    rules: undefined,
    plugins: undefined,
  };

  const configYaml = stringifyYaml(config, { lineWidth: 100 });
  await writeTextFile(join(specforgeDir, CONFIG_FILE), configYaml);

  // Write .gitkeep files so directories are tracked
  await writeTextFile(join(specforgeDir, SPECS_DIR, '.gitkeep'), '');
  await writeTextFile(join(specforgeDir, CHANGES_DIR, ARCHIVE_DIR, '.gitkeep'), '');
  await writeTextFile(join(specforgeDir, SCHEMAS_DIR, '.gitkeep'), '');

  logger.success(`SpecForge initialized in ${SPECFORGE_DIR}/`);
  logger.info(`Schema: ${config.schema}`);
  logger.info(`Run \`specforge new change <name>\` to create your first change.`);
}
