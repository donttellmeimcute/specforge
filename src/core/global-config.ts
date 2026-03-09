import { join } from 'node:path';
import { homedir } from 'node:os';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { readTextFile, writeTextFile } from '../utils/file-system.js';
import { GLOBAL_CONFIG_DIR, CONFIG_FILE } from '../utils/constants.js';
import { GlobalConfig, GlobalConfigSchema, safeParse } from './artifact-graph/types.js';
import { logger } from '../utils/logger.js';

/** Get the path to the global config directory */
export function getGlobalConfigDir(): string {
  const xdgConfig = process.env['XDG_CONFIG_HOME'];
  if (xdgConfig) {
    return join(xdgConfig, GLOBAL_CONFIG_DIR);
  }

  // Windows: %APPDATA%, others: ~/.config
  const base =
    process.platform === 'win32'
      ? (process.env['APPDATA'] ?? join(homedir(), 'AppData', 'Roaming'))
      : join(homedir(), '.config');

  return join(base, GLOBAL_CONFIG_DIR);
}

/** Get the path to the global config file */
export function getGlobalConfigPath(): string {
  return join(getGlobalConfigDir(), CONFIG_FILE);
}

/** Load global user config */
export async function loadGlobalConfig(): Promise<GlobalConfig> {
  const configPath = getGlobalConfigPath();
  const content = await readTextFile(configPath);

  if (!content) {
    return GlobalConfigSchema.parse({});
  }

  let raw: unknown;
  try {
    raw = parseYaml(content);
  } catch {
    logger.warn('Invalid global config YAML, using defaults');
    return GlobalConfigSchema.parse({});
  }

  const result = safeParse(GlobalConfigSchema, raw);
  if (!result.success) {
    logger.warn('Global config validation failed, using defaults');
    return GlobalConfigSchema.parse({});
  }

  return result.data;
}

/** Save global user config */
export async function saveGlobalConfig(config: GlobalConfig): Promise<void> {
  const configPath = getGlobalConfigPath();
  const yaml = stringifyYaml(config, { lineWidth: 100 });
  await writeTextFile(configPath, yaml);
}
