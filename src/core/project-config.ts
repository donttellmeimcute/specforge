import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { resolveSpecforgePath } from '../utils/path-utils.js';
import { readTextFile, writeTextFile } from '../utils/file-system.js';
import { CONFIG_FILE } from '../utils/constants.js';
import {
  ProjectConfig,
  ProjectConfigSchema,
  safeParse,
  formatZodErrors,
} from './artifact-graph/types.js';
import { logger } from '../utils/logger.js';

/** Load and validate the project config from .specforge/config.yaml */
export async function loadProjectConfig(
  projectRoot: string,
): Promise<ProjectConfig> {
  const configPath = resolveSpecforgePath(projectRoot, CONFIG_FILE);
  const content = await readTextFile(configPath);

  if (!content) {
    logger.debug('No config.yaml found, using defaults');
    return ProjectConfigSchema.parse({});
  }

  let raw: unknown;
  try {
    raw = parseYaml(content);
  } catch (e) {
    logger.warn(
      `Invalid YAML in ${configPath}: ${e instanceof Error ? e.message : String(e)}. Using defaults.`,
    );
    return ProjectConfigSchema.parse({});
  }

  const result = safeParse(ProjectConfigSchema, raw);
  if (!result.success) {
    const errors = formatZodErrors(result.errors);
    logger.warn(
      `Config validation warnings in ${configPath}:\n${errors.map((e) => `  - ${e}`).join('\n')}\nUsing defaults for invalid fields.`,
    );
    // Graceful degradation: parse what we can
    return ProjectConfigSchema.parse(raw ?? {});
  }

  return result.data;
}

/** Save project config to .specforge/config.yaml */
export async function saveProjectConfig(
  projectRoot: string,
  config: ProjectConfig,
): Promise<void> {
  const configPath = resolveSpecforgePath(projectRoot, CONFIG_FILE);
  const yaml = stringifyYaml(config, { lineWidth: 100 });
  await writeTextFile(configPath, yaml);
}
