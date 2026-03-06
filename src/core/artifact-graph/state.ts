import fg from 'fast-glob';
import { join } from 'node:path';
import { ArtifactGraph } from './graph.js';
import { ArtifactStatus } from './types.js';

/**
 * Scan the filesystem to detect artifact states (stateless).
 * Updates all nodes in the graph based on which files exist.
 */
export async function detectArtifactStates(
  graph: ArtifactGraph,
  changeDir: string,
): Promise<void> {
  for (const id of graph.getIds()) {
    const node = graph.getNode(id);
    if (!node) continue;

    const pattern = node.definition.generates;
    const fullPattern = join(changeDir, pattern).replace(/\\/g, '/');

    const matchedFiles = await fg(fullPattern, {
      onlyFiles: true,
      absolute: true,
    });

    let status: ArtifactStatus;
    if (matchedFiles.length > 0) {
      status = 'completed';
    } else {
      // Check if dependencies are all completed
      const deps = graph.getDependencies(id);
      const allDepsCompleted = deps.every((depId) => {
        const depNode = graph.getNode(depId);
        return depNode?.status === 'completed';
      });
      status = allDepsCompleted ? 'ready' : 'pending';
    }

    graph.updateNode(id, status, matchedFiles);
  }
}
