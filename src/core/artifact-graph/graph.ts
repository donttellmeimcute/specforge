import { ArtifactDefinition, WorkflowSchema, ArtifactStatus } from './types.js';

export interface ArtifactNode {
  definition: ArtifactDefinition;
  status: ArtifactStatus;
  matchedFiles: string[];
}

/**
 * Directed Acyclic Graph of artifacts within a workflow schema.
 * Provides topological ordering (Kahn's algorithm) and
 * dependency-aware queries like getNextArtifacts().
 */
export class ArtifactGraph {
  private readonly nodes: Map<string, ArtifactNode> = new Map();
  private readonly edges: Map<string, Set<string>> = new Map(); // id → set of dependency ids
  private readonly reverseEdges: Map<string, Set<string>> = new Map(); // id → set of dependents

  constructor(schema: WorkflowSchema) {
    for (const artifact of schema.artifacts) {
      this.nodes.set(artifact.id, {
        definition: artifact,
        status: 'pending',
        matchedFiles: [],
      });
      this.edges.set(artifact.id, new Set(artifact.requires));
    }

    // Build reverse edges
    for (const artifact of schema.artifacts) {
      if (!this.reverseEdges.has(artifact.id)) {
        this.reverseEdges.set(artifact.id, new Set());
      }
      for (const dep of artifact.requires) {
        if (!this.reverseEdges.has(dep)) {
          this.reverseEdges.set(dep, new Set());
        }
        this.reverseEdges.get(dep)!.add(artifact.id);
      }
    }
  }

  /** Get all artifact IDs */
  getIds(): string[] {
    return [...this.nodes.keys()];
  }

  /** Get a single node by ID */
  getNode(id: string): ArtifactNode | undefined {
    return this.nodes.get(id);
  }

  /** Get all nodes */
  getAllNodes(): ArtifactNode[] {
    return [...this.nodes.values()];
  }

  /** Get dependency IDs for a given artifact */
  getDependencies(id: string): string[] {
    return [...(this.edges.get(id) ?? [])];
  }

  /** Get IDs of artifacts that depend on the given artifact */
  getDependents(id: string): string[] {
    return [...(this.reverseEdges.get(id) ?? [])];
  }

  /** Update the status and matched files for an artifact */
  updateNode(id: string, status: ArtifactStatus, matchedFiles: string[]): void {
    const node = this.nodes.get(id);
    if (!node) {
      throw new Error(`Artifact "${id}" not found in graph`);
    }
    node.status = status;
    node.matchedFiles = matchedFiles;
  }

  /**
   * Topological sort using Kahn's algorithm.
   * Returns artifact IDs in dependency order.
   * Throws if the graph contains a cycle.
   */
  topologicalSort(): string[] {
    // Compute in-degree for each node
    const inDegree = new Map<string, number>();
    for (const id of this.nodes.keys()) {
      inDegree.set(id, 0);
    }
    for (const [id, deps] of this.edges) {
      inDegree.set(id, deps.size);
    }

    // Start with nodes that have no dependencies
    const queue: string[] = [];
    for (const [id, degree] of inDegree) {
      if (degree === 0) {
        queue.push(id);
      }
    }

    const sorted: string[] = [];

    while (queue.length > 0) {
      const current = queue.shift()!;
      sorted.push(current);

      // For each dependent of current, reduce in-degree
      for (const dependent of this.reverseEdges.get(current) ?? []) {
        const newDegree = (inDegree.get(dependent) ?? 1) - 1;
        inDegree.set(dependent, newDegree);
        if (newDegree === 0) {
          queue.push(dependent);
        }
      }
    }

    if (sorted.length !== this.nodes.size) {
      const remaining = [...this.nodes.keys()].filter(
        (id) => !sorted.includes(id),
      );
      throw new Error(
        `Cycle detected in artifact graph. Involved artifacts: ${remaining.join(', ')}`,
      );
    }

    return sorted;
  }

  /**
   * Get artifacts that are actionable — either "ready" (dependencies completed,
   * no files yet) or "diverged" (files exist but dependencies are incomplete).
   * "needs-sync" artifacts are also returned so the agent knows they require attention.
   */
  getNextArtifacts(): ArtifactNode[] {
    const result: ArtifactNode[] = [];

    for (const [id, node] of this.nodes) {
      if (node.status === 'completed') continue;

      // diverged and needs-sync artifacts are always actionable
      if (node.status === 'diverged' || node.status === 'needs-sync') {
        result.push(node);
        continue;
      }

      const deps = this.edges.get(id) ?? new Set();
      const allDepsCompleted = [...deps].every((depId) => {
        const depNode = this.nodes.get(depId);
        return depNode?.status === 'completed' || depNode?.status === 'needs-sync';
      });

      if (allDepsCompleted) {
        result.push(node);
      }
    }

    return result;
  }

  /**
   * Check if all artifacts in the graph are completed.
   */
  isComplete(): boolean {
    return [...this.nodes.values()].every((n) => n.status === 'completed');
  }

  /**
   * Get a summary of artifact statuses.
   */
  getSummary(): Record<ArtifactStatus, string[]> {
    const summary: Record<ArtifactStatus, string[]> = {
      pending: [],
      ready: [],
      'in-progress': [],
      completed: [],
      diverged: [],
      'needs-sync': [],
    };

    for (const [id, node] of this.nodes) {
      summary[node.status].push(id);
    }

    // Override: mark pending nodes whose deps are complete as "ready"
    const readyNodes = this.getNextArtifacts();
    for (const readyNode of readyNodes) {
      if (readyNode.status === 'pending') {
        const idx = summary.pending.indexOf(readyNode.definition.id);
        if (idx !== -1) {
          summary.pending.splice(idx, 1);
          summary.ready.push(readyNode.definition.id);
        }
      }
    }

    return summary;
  }
}
