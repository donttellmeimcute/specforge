import { describe, it, expect } from 'vitest';
import { ArtifactGraph } from '../../src/core/artifact-graph/graph.js';
import { WorkflowSchema } from '../../src/core/artifact-graph/types.js';

const specDrivenSchema: WorkflowSchema = {
  name: 'spec-driven',
  version: 1,
  description: 'Spec-driven development workflow',
  artifacts: [
    { id: 'proposal', generates: 'proposal.md', description: 'Proposal', requires: [] },
    {
      id: 'specs',
      generates: 'specs/**/*.md',
      description: 'Specs',
      requires: ['proposal'],
    },
    {
      id: 'design',
      generates: 'design.md',
      description: 'Design',
      requires: ['proposal'],
    },
    {
      id: 'tasks',
      generates: 'tasks.md',
      description: 'Tasks',
      requires: ['specs', 'design'],
    },
  ],
};

describe('ArtifactGraph', () => {
  describe('construction', () => {
    it('should build from a valid workflow schema', () => {
      const graph = new ArtifactGraph(specDrivenSchema);
      expect(graph.getIds()).toEqual(['proposal', 'specs', 'design', 'tasks']);
    });

    it('should initialize all nodes as pending', () => {
      const graph = new ArtifactGraph(specDrivenSchema);
      for (const node of graph.getAllNodes()) {
        expect(node.status).toBe('pending');
        expect(node.matchedFiles).toEqual([]);
      }
    });
  });

  describe('getNode', () => {
    it('should return a node by ID', () => {
      const graph = new ArtifactGraph(specDrivenSchema);
      const node = graph.getNode('proposal');
      expect(node).toBeDefined();
      expect(node!.definition.id).toBe('proposal');
    });

    it('should return undefined for non-existent ID', () => {
      const graph = new ArtifactGraph(specDrivenSchema);
      expect(graph.getNode('nope')).toBeUndefined();
    });
  });

  describe('getDependencies / getDependents', () => {
    it('should return dependencies for an artifact', () => {
      const graph = new ArtifactGraph(specDrivenSchema);
      expect(graph.getDependencies('tasks')).toEqual(
        expect.arrayContaining(['specs', 'design']),
      );
      expect(graph.getDependencies('proposal')).toEqual([]);
    });

    it('should return dependents (reverse edges)', () => {
      const graph = new ArtifactGraph(specDrivenSchema);
      expect(graph.getDependents('proposal')).toEqual(
        expect.arrayContaining(['specs', 'design']),
      );
      expect(graph.getDependents('tasks')).toEqual([]);
    });
  });

  describe('topologicalSort', () => {
    it('should return valid topological order', () => {
      const graph = new ArtifactGraph(specDrivenSchema);
      const sorted = graph.topologicalSort();

      expect(sorted).toHaveLength(4);
      // proposal must come before specs, design
      expect(sorted.indexOf('proposal')).toBeLessThan(sorted.indexOf('specs'));
      expect(sorted.indexOf('proposal')).toBeLessThan(sorted.indexOf('design'));
      // specs and design must come before tasks
      expect(sorted.indexOf('specs')).toBeLessThan(sorted.indexOf('tasks'));
      expect(sorted.indexOf('design')).toBeLessThan(sorted.indexOf('tasks'));
    });

    it('should handle linear chains', () => {
      const linear: WorkflowSchema = {
        name: 'linear',
        version: 1,
        description: 'Linear chain',
        artifacts: [
          { id: 'a', generates: 'a.md', description: 'A', requires: [] },
          { id: 'b', generates: 'b.md', description: 'B', requires: ['a'] },
          { id: 'c', generates: 'c.md', description: 'C', requires: ['b'] },
        ],
      };
      const graph = new ArtifactGraph(linear);
      expect(graph.topologicalSort()).toEqual(['a', 'b', 'c']);
    });

    it('should handle single node', () => {
      const single: WorkflowSchema = {
        name: 'single',
        version: 1,
        description: 'Single artifact',
        artifacts: [
          { id: 'only', generates: 'only.md', description: 'Only', requires: [] },
        ],
      };
      const graph = new ArtifactGraph(single);
      expect(graph.topologicalSort()).toEqual(['only']);
    });

    it('should handle all independent nodes', () => {
      const parallel: WorkflowSchema = {
        name: 'parallel',
        version: 1,
        description: 'All parallel',
        artifacts: [
          { id: 'a', generates: 'a.md', description: 'A', requires: [] },
          { id: 'b', generates: 'b.md', description: 'B', requires: [] },
          { id: 'c', generates: 'c.md', description: 'C', requires: [] },
        ],
      };
      const graph = new ArtifactGraph(parallel);
      const sorted = graph.topologicalSort();
      expect(sorted).toHaveLength(3);
      expect(sorted).toEqual(expect.arrayContaining(['a', 'b', 'c']));
    });
  });

  describe('getNextArtifacts', () => {
    it('should return root nodes initially (no deps)', () => {
      const graph = new ArtifactGraph(specDrivenSchema);
      const next = graph.getNextArtifacts();
      expect(next).toHaveLength(1);
      expect(next[0]!.definition.id).toBe('proposal');
    });

    it('should return children when parent is completed', () => {
      const graph = new ArtifactGraph(specDrivenSchema);
      graph.updateNode('proposal', 'completed', ['proposal.md']);

      const next = graph.getNextArtifacts();
      const ids = next.map((n) => n.definition.id);
      expect(ids).toEqual(expect.arrayContaining(['specs', 'design']));
      expect(ids).not.toContain('tasks'); // still blocked
    });

    it('should return tasks when specs and design are completed', () => {
      const graph = new ArtifactGraph(specDrivenSchema);
      graph.updateNode('proposal', 'completed', ['proposal.md']);
      graph.updateNode('specs', 'completed', ['specs/auth/spec.md']);
      graph.updateNode('design', 'completed', ['design.md']);

      const next = graph.getNextArtifacts();
      expect(next).toHaveLength(1);
      expect(next[0]!.definition.id).toBe('tasks');
    });

    it('should return empty when all completed', () => {
      const graph = new ArtifactGraph(specDrivenSchema);
      graph.updateNode('proposal', 'completed', ['proposal.md']);
      graph.updateNode('specs', 'completed', ['specs/auth/spec.md']);
      graph.updateNode('design', 'completed', ['design.md']);
      graph.updateNode('tasks', 'completed', ['tasks.md']);

      expect(graph.getNextArtifacts()).toEqual([]);
    });

    it('should include diverged nodes as actionable', () => {
      const graph = new ArtifactGraph(specDrivenSchema);
      // specs is diverged (has files but proposal is not completed)
      graph.updateNode('specs', 'diverged', ['specs/spec.md']);

      const next = graph.getNextArtifacts();
      const ids = next.map((n) => n.definition.id);
      expect(ids).toContain('specs');
    });

    it('should include needs-sync nodes as actionable', () => {
      const graph = new ArtifactGraph(specDrivenSchema);
      graph.updateNode('proposal', 'completed', ['proposal.md']);
      graph.updateNode('specs', 'needs-sync', ['specs/spec.md']);

      const next = graph.getNextArtifacts();
      const ids = next.map((n) => n.definition.id);
      expect(ids).toContain('specs');
    });

    it('should treat needs-sync deps as satisfying readiness for children', () => {
      const graph = new ArtifactGraph(specDrivenSchema);
      graph.updateNode('proposal', 'needs-sync', ['proposal.md']);
      // specs/design should now be "ready" even though proposal is needs-sync
      const next = graph.getNextArtifacts();
      const ids = next.map((n) => n.definition.id);
      expect(ids).toEqual(expect.arrayContaining(['proposal', 'specs', 'design']));
    });
  });

  describe('updateNode', () => {
    it('should update status and matched files', () => {
      const graph = new ArtifactGraph(specDrivenSchema);
      graph.updateNode('proposal', 'completed', ['proposal.md']);

      const node = graph.getNode('proposal');
      expect(node!.status).toBe('completed');
      expect(node!.matchedFiles).toEqual(['proposal.md']);
    });

    it('should throw for non-existent artifact', () => {
      const graph = new ArtifactGraph(specDrivenSchema);
      expect(() => graph.updateNode('nope', 'completed', [])).toThrow(
        'Artifact "nope" not found',
      );
    });
  });

  describe('isComplete', () => {
    it('should return false initially', () => {
      const graph = new ArtifactGraph(specDrivenSchema);
      expect(graph.isComplete()).toBe(false);
    });

    it('should return true when all completed', () => {
      const graph = new ArtifactGraph(specDrivenSchema);
      graph.updateNode('proposal', 'completed', ['proposal.md']);
      graph.updateNode('specs', 'completed', ['specs/a.md']);
      graph.updateNode('design', 'completed', ['design.md']);
      graph.updateNode('tasks', 'completed', ['tasks.md']);
      expect(graph.isComplete()).toBe(true);
    });
  });

  describe('getSummary', () => {
    it('should categorize all artifacts by status', () => {
      const graph = new ArtifactGraph(specDrivenSchema);
      const summary = graph.getSummary();

      // proposal has no deps → ready, rest are pending
      expect(summary.ready).toContain('proposal');
      expect(summary.pending).toEqual(
        expect.arrayContaining(['specs', 'design', 'tasks']),
      );
      expect(summary.completed).toEqual([]);
    });

    it('should update after status changes', () => {
      const graph = new ArtifactGraph(specDrivenSchema);
      graph.updateNode('proposal', 'completed', ['proposal.md']);

      const summary = graph.getSummary();
      expect(summary.completed).toContain('proposal');
      expect(summary.ready).toEqual(expect.arrayContaining(['specs', 'design']));
      expect(summary.pending).toContain('tasks');
    });

    it('should include diverged and needs-sync in summary', () => {
      const graph = new ArtifactGraph(specDrivenSchema);
      graph.updateNode('specs', 'diverged', ['specs/spec.md']);
      graph.updateNode('design', 'needs-sync', ['design.md']);

      const summary = graph.getSummary();
      expect(summary.diverged).toContain('specs');
      expect(summary['needs-sync']).toContain('design');
    });
  });
});
