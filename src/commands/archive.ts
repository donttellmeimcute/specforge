import { Command } from 'commander';
import { join } from 'node:path';
import { rename } from 'node:fs/promises';
import { findProjectRoot, resolveSpecforgePath } from '../utils/path-utils.js';
import { logger } from '../utils/logger.js';
import { loadProjectConfig } from '../core/project-config.js';
import { resolveSchema } from '../core/artifact-graph/resolver.js';
import { ArtifactGraph } from '../core/artifact-graph/graph.js';
import { detectArtifactStates } from '../core/artifact-graph/state.js';
import { loadChangeMetadata, updateChangeMetadata } from '../core/change.js';
import { CHANGES_DIR, ARCHIVE_DIR } from '../utils/constants.js';
import { pathExists, ensureDir } from '../utils/file-system.js';

export const archiveCommand = new Command('archive')
  .description('Archive a completed change')
  .argument('<change>', 'Name of the change to archive')
  .option('--force', 'Archive even if not all artifacts are completed')
  .action(async (changeName: string, options: { force?: boolean }) => {
    try {
      const projectRoot = await findProjectRoot();
      if (!projectRoot) {
        logger.error(
          'Not inside a SpecForge project. Run `specforge init` first.',
        );
        process.exitCode = 1;
        return;
      }

      const changesDir = resolveSpecforgePath(projectRoot, CHANGES_DIR);
      const changeDir = join(changesDir, changeName);

      if (!(await pathExists(changeDir))) {
        logger.error(`Change "${changeName}" not found.`);
        process.exitCode = 1;
        return;
      }

      const metadata = await loadChangeMetadata(changeDir);
      if (!metadata) {
        logger.error(`Invalid change: missing metadata.`);
        process.exitCode = 1;
        return;
      }

      // Check if all artifacts are completed
      if (!options.force) {
        const config = await loadProjectConfig(projectRoot);
        const schemaName = metadata.schema ?? config.schema;
        const schema = await resolveSchema(schemaName, projectRoot);
        const graph = new ArtifactGraph(schema);
        await detectArtifactStates(graph, changeDir);

        if (!graph.isComplete()) {
          const summary = graph.getSummary();
          const incomplete = [
            ...summary.pending,
            ...summary.ready,
            ...summary['in-progress'],
          ];
          logger.error(
            `Change "${changeName}" has incomplete artifacts: ${incomplete.join(', ')}.\n` +
              `Use --force to archive anyway.`,
          );
          process.exitCode = 1;
          return;
        }
      }

      // Update metadata
      await updateChangeMetadata(changeDir, { status: 'archived' });

      // Move to archive
      const archiveDir = join(changesDir, ARCHIVE_DIR);
      await ensureDir(archiveDir);
      const targetDir = join(archiveDir, changeName);

      if (await pathExists(targetDir)) {
        logger.error(
          `Archive target already exists: ${targetDir}. Remove it first.`,
        );
        process.exitCode = 1;
        return;
      }

      await rename(changeDir, targetDir);
      logger.success(`Change "${changeName}" archived.`);
    } catch (error) {
      logger.error(
        error instanceof Error ? error.message : String(error),
      );
      process.exitCode = 1;
    }
  });
