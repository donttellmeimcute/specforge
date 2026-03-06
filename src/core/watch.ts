/**
 * Watch mode — monitors the change directory for file changes
 * and automatically updates artifact states.
 */

import { watch } from 'node:fs';
import { logger } from '../utils/logger.js';
import { resolveSchema } from './artifact-graph/resolver.js';
import { ArtifactGraph } from './artifact-graph/graph.js';
import { detectArtifactStates } from './artifact-graph/state.js';
import { loadProjectConfig } from './project-config.js';
import { loadChangeMetadata } from './change.js';
import { resolveSpecforgePath } from '../utils/path-utils.js';
import { CHANGES_DIR } from '../utils/constants.js';

export interface WatchOptions {
  onChange?: (graph: ArtifactGraph) => void;
  debounceMs?: number;
}

/**
 * Start watching a change directory for file modifications.
 * Returns an AbortController to stop watching.
 */
export async function watchChange(
  projectRoot: string,
  changeName: string,
  options: WatchOptions = {},
): Promise<AbortController> {
  const changeDir = resolveSpecforgePath(projectRoot, CHANGES_DIR, changeName);
  const metadata = await loadChangeMetadata(changeDir);
  if (!metadata) {
    throw new Error(`Change "${changeName}" not found.`);
  }

  const config = await loadProjectConfig(projectRoot);
  const schemaName = metadata.schema ?? config.schema;
  const schema = await resolveSchema(schemaName, projectRoot);

  const debounceMs = options.debounceMs ?? 500;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const controller = new AbortController();

  const refresh = async () => {
    try {
      const graph = new ArtifactGraph(schema);
      await detectArtifactStates(graph, changeDir);
      options.onChange?.(graph);

      const summary = graph.getSummary();
      logger.info(
        `[watch] ${summary.completed.length}/${graph.getAllNodes().length} artifacts completed`,
      );

      if (graph.isComplete()) {
        logger.success('[watch] All artifacts completed!');
      }
    } catch (error) {
      logger.warn(
        `[watch] Error refreshing state: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  // Initial state
  await refresh();

  // Watch for changes
  const watcher = watch(
    changeDir,
    { recursive: true, signal: controller.signal },
    (_eventType, filename) => {
      if (!filename) return;
      // Skip metadata and hidden files
      if (filename.startsWith('.') || filename === '.metadata.yaml') return;

      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        logger.info(`[watch] File changed: ${filename}`);
        refresh().catch(() => {});
      }, debounceMs);
    },
  );

  watcher.on('error', (error) => {
    if ((error as NodeJS.ErrnoException).code === 'ABORT_ERR') return;
    logger.warn(`[watch] Watcher error: ${error.message}`);
  });

  return controller;
}

/**
 * CLI-oriented watch that prints status updates to the console.
 */
export async function watchChangeCli(
  projectRoot: string,
  changeName: string,
): Promise<AbortController> {
  return watchChange(projectRoot, changeName, {
    onChange: (graph) => {
      const nodes = graph.getAllNodes();
      for (const node of nodes) {
        const icon =
          node.status === 'completed'
            ? '✅'
            : node.status === 'ready'
              ? '🔵'
              : node.status === 'in-progress'
                ? '🟡'
                : '⚪';
        logger.info(`  ${icon} ${node.definition.id}: ${node.status}`);
      }
    },
  });
}
