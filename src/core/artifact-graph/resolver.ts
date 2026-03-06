import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { readTextFile } from '../../utils/file-system.js';
import { resolveSpecforgePath } from '../../utils/path-utils.js';
import { SCHEMAS_DIR } from '../../utils/constants.js';
import {
  WorkflowSchema,
  WorkflowSchemaSchema,
  safeParse,
  formatZodErrors,
} from './types.js';
import { logger } from '../../utils/logger.js';

/** Paths to built-in schemas bundled with SpecForge */
function getBuiltinSchemaDir(): string {
  // Relative to compiled output: dist/core/artifact-graph/ → dist/core/artifact-graph/schemas/
  return join(import.meta.dirname, 'schemas');
}

/**
 * Resolve a workflow schema by name, following priority order:
 * 1. Project schemas (.specforge/schemas/<name>/schema.yaml)
 * 2. Built-in schemas (bundled with the package)
 */
export async function resolveSchema(
  schemaName: string,
  projectRoot?: string,
): Promise<WorkflowSchema> {
  // 1. Try project-level schema
  if (projectRoot) {
    const projectSchemaPath = resolveSpecforgePath(
      projectRoot,
      SCHEMAS_DIR,
      schemaName,
      'schema.yaml',
    );
    const content = await readTextFile(projectSchemaPath);
    if (content) {
      logger.debug(`Using project schema: ${projectSchemaPath}`);
      return parseAndValidateSchema(content, projectSchemaPath);
    }
  }

  // 2. Try built-in schema
  const builtinPath = join(getBuiltinSchemaDir(), `${schemaName}.yaml`);
  const content = await readTextFile(builtinPath);
  if (content) {
    logger.debug(`Using built-in schema: ${builtinPath}`);
    return parseAndValidateSchema(content, builtinPath);
  }

  throw new Error(
    `Schema "${schemaName}" not found. Looked in:\n` +
      (projectRoot
        ? `  - ${resolveSpecforgePath(projectRoot, SCHEMAS_DIR, schemaName, 'schema.yaml')}\n`
        : '') +
      `  - ${builtinPath}`,
  );
}

/** List available schema names */
export async function listAvailableSchemas(
  projectRoot?: string,
): Promise<string[]> {
  const names = new Set<string>();

  // Built-in schemas
  const builtinDir = getBuiltinSchemaDir();
  try {
    const fg = (await import('fast-glob')).default;
    const builtinFiles = await fg('*.yaml', { cwd: builtinDir, onlyFiles: true });
    for (const f of builtinFiles) {
      names.add(f.replace(/\.yaml$/, ''));
    }
  } catch {
    // No built-in dir yet
  }

  // Project schemas
  if (projectRoot) {
    const projectSchemasDir = resolveSpecforgePath(projectRoot, SCHEMAS_DIR);
    try {
      const fg = (await import('fast-glob')).default;
      const dirs = await fg('*/schema.yaml', {
        cwd: projectSchemasDir,
        onlyFiles: true,
      });
      for (const d of dirs) {
        names.add(d.split('/')[0]!);
      }
    } catch {
      // No project schemas dir
    }
  }

  return [...names].sort();
}

function parseAndValidateSchema(
  content: string,
  filePath: string,
): WorkflowSchema {
  let raw: unknown;
  try {
    raw = parseYaml(content);
  } catch (e) {
    throw new Error(
      `Invalid YAML in schema file ${filePath}: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  const result = safeParse(WorkflowSchemaSchema, raw);
  if (!result.success) {
    const errors = formatZodErrors(result.errors);
    throw new Error(
      `Invalid schema in ${filePath}:\n${errors.map((e) => `  - ${e}`).join('\n')}`,
    );
  }

  return result.data;
}
