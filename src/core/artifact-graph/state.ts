import fg from 'fast-glob';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { ArtifactGraph } from './graph.js';
import { ArtifactStatus } from './types.js';

/**
 * Scan the filesystem to detect artifact states using Eventual Consistency semantics.
 *
 * New statuses (Fluid DAG):
 * - `diverged`   — files exist for this artifact but ≥1 upstream dependency has no files.
 *                  The artifact was created out of order (free iteration is allowed).
 * - `needs-sync` — files exist AND all upstream dependencies have files, but at least one
 *                  dependency file is newer than this artifact's files (dep was updated later).
 */
export async function detectArtifactStates(
  graph: ArtifactGraph,
  changeDir: string,
): Promise<void> {
  // ─── Pass 1: collect matched files for every artifact ────────────────────
  const artifactFiles = new Map<string, string[]>(); // id → absolute file paths

  for (const id of graph.getIds()) {
    const node = graph.getNode(id);
    if (!node) continue;

    const pattern = node.definition.generates;
    const fullPattern = join(changeDir, pattern).replace(/\\/g, '/');

    const matchedFiles = await fg(fullPattern, {
      onlyFiles: true,
      absolute: true,
    });

    artifactFiles.set(id, matchedFiles);
  }

  // ─── Pass 2: compute statuses in topological order ───────────────────────
  // Processing in topological order ensures that when we examine an artifact's
  // dependencies, their statuses have already been computed in this pass.
  const order = graph.topologicalSort();

  for (const id of order) {
    const node = graph.getNode(id);
    if (!node) continue;

    const myFiles = artifactFiles.get(id) ?? [];
    const deps = graph.getDependencies(id);

    if (myFiles.length > 0) {
      // Artifact has files — determine whether completed, diverged, or needs-sync
      const allDepsHaveFiles = deps.every(
        (depId) => (artifactFiles.get(depId) ?? []).length > 0,
      );

      if (!allDepsHaveFiles && deps.length > 0) {
        // Created out of order: some dependencies have no files yet
        graph.updateNode(id, 'diverged', myFiles);
      } else {
        // All deps have files (or no deps). Check modification times.
        const myOldest = await getOldestMtime(myFiles);
        const depNewest = await getNewestMtimeForIds(deps, artifactFiles);

        if (depNewest !== null && myOldest !== null && depNewest > myOldest) {
          // A dependency was modified after this artifact was last written
          graph.updateNode(id, 'needs-sync', myFiles);
        } else {
          graph.updateNode(id, 'completed', myFiles);
        }
      }
    } else {
      // Artifact has no files — ready or pending
      const allDepsConsideredComplete = deps.every((depId) => {
        const depStatus = graph.getNode(depId)?.status;
        return (
          depStatus === 'completed' ||
          depStatus === 'needs-sync' ||
          depStatus === 'diverged'
        );
      });

      const status: ArtifactStatus = allDepsConsideredComplete ? 'ready' : 'pending';
      graph.updateNode(id, status, []);
    }
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Oldest mtime (ms) among a list of files, or null if the list is empty. */
async function getOldestMtime(files: string[]): Promise<number | null> {
  if (files.length === 0) return null;
  const mtimes = await Promise.all(
    files.map((f) =>
      stat(f)
        .then((s) => s.mtimeMs)
        .catch(() => Infinity),
    ),
  );
  return Math.min(...mtimes);
}

/** Newest mtime (ms) across all files belonging to the given artifact IDs, or null. */
async function getNewestMtimeForIds(
  ids: string[],
  artifactFiles: Map<string, string[]>,
): Promise<number | null> {
  if (ids.length === 0) return null;
  const allFiles = ids.flatMap((id) => artifactFiles.get(id) ?? []);
  if (allFiles.length === 0) return null;
  const mtimes = await Promise.all(
    allFiles.map((f) =>
      stat(f)
        .then((s) => s.mtimeMs)
        .catch(() => 0),
    ),
  );
  return Math.max(...mtimes);
}
