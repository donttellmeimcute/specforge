import { join } from 'node:path';
import { stringify as stringifyYaml } from 'yaml';
import { ensureDir, writeTextFile, pathExists, readTextFile } from '../utils/file-system.js';
import { resolveSpecforgePath } from '../utils/path-utils.js';
import { CHANGES_DIR, METADATA_FILE } from '../utils/constants.js';
import { ChangeMetadata } from './artifact-graph/types.js';
import { resolveSchema } from './artifact-graph/resolver.js';
import { logger } from '../utils/logger.js';
import { fetchAsanaTask } from './integrations/asana.js';
import { createGitIntegration } from './git-integration.js';
import * as dotenv from 'dotenv';

dotenv.config();

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

  const changeDir = resolveSpecforgePath(
    projectRoot,
    CHANGES_DIR,
    changeName,
  );

  if (await pathExists(changeDir)) {
    throw new Error(
      `Change "${changeName}" already exists at ${changeDir}`,
    );
  }

  let asanaTask = null;
  if (options.asana) {
    const token = process.env.ASANA_ACCESS_TOKEN;
    if (!token) {
      throw new Error('ASANA_ACCESS_TOKEN is not set in environment variables');
    }
    logger.info(`Fetching Asana task ${options.asana}...`);
    try {
      asanaTask = await fetchAsanaTask(options.asana, token);
      logger.success(`Fetched Asana task: ${asanaTask.name}`);
      
      // Auto-tag with asana task ID
      options.tags = options.tags || [];
      options.tags.push(`asana-${options.asana}`);
    } catch (error) {
      logger.error(`Failed to fetch Asana task: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
    
    // Auto-create branch
    try {
      const git = await createGitIntegration(projectRoot);
      if (git) {
        const branchName = `feat/asana-${options.asana}-${changeName}`;
        logger.info(`Creating git branch: ${branchName}`);
        await git.createBranch(branchName);
        logger.success(`Switched to new branch: ${branchName}`);
      }
    } catch (gitError) {
      logger.warn(`Could not create git branch: ${gitError instanceof Error ? gitError.message : String(gitError)}`);
    }
  }

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
    tags: options.tags,
    author: options.author,
  };

  await writeTextFile(
    join(changeDir, METADATA_FILE),
    stringifyYaml(metadata, { lineWidth: 100 }),
  );

  // Create specs subdirectory
  await ensureDir(join(changeDir, 'specs'));
  
  if (asanaTask) {
    const assigneeInfo = asanaTask.assignee ? `Asignado a: ${asanaTask.assignee.name}` : 'Sin asignar';
    const proposalContent = `# Proposal: ${asanaTask.name}
    
## Context
Asana Ticket: [${asanaTask.id}](${asanaTask.permalink_url})
${assigneeInfo}

## Value Proposition
${asanaTask.notes || 'TODO: Justify the business value.'}

## Target Architecture
TODO: Describe high-level approach.
`;
    await writeTextFile(join(changeDir, 'proposal.md'), proposalContent);
    logger.success('Generated proposal.md from Asana task');
  }

  logger.success(`Change "${changeName}" created`);
  logger.info(`Path: ${changeDir}`);

  return changeDir;
}

/** Load metadata for a change */
export async function loadChangeMetadata(
  changeDir: string,
): Promise<ChangeMetadata | null> {
  const { parse: parseYaml } = await import('yaml');
  const { ChangeMetadataSchema, safeParse } = await import(
    './artifact-graph/types.js'
  );

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
