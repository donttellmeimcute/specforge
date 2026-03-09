import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ArtifactGraph } from '../../src/core/artifact-graph/graph.js';
import { detectArtifactStates } from '../../src/core/artifact-graph/state.js';
import { writeTextFile } from '../../src/utils/file-system.js';
import { WorkflowSchema } from '../../src/core/artifact-graph/types.js';

const schema: WorkflowSchema = {
  name: 'spec-driven',
  version: 1,
  description: 'Test schema',
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

describe('detectArtifactStates', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'specforge-state-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should mark all as pending/ready when no files exist', async () => {
    const graph = new ArtifactGraph(schema);
    await detectArtifactStates(graph, tempDir);

    expect(graph.getNode('proposal')!.status).toBe('ready');
    expect(graph.getNode('specs')!.status).toBe('pending');
    expect(graph.getNode('design')!.status).toBe('pending');
    expect(graph.getNode('tasks')!.status).toBe('pending');
  });

  it('should mark proposal as completed when file exists', async () => {
    await writeTextFile(join(tempDir, 'proposal.md'), '# Proposal');

    const graph = new ArtifactGraph(schema);
    await detectArtifactStates(graph, tempDir);

    expect(graph.getNode('proposal')!.status).toBe('completed');
    expect(graph.getNode('proposal')!.matchedFiles).toHaveLength(1);
  });

  it('should detect glob pattern matches for specs', async () => {
    await writeTextFile(join(tempDir, 'proposal.md'), '# Proposal');
    await mkdir(join(tempDir, 'specs', 'auth'), { recursive: true });
    await writeTextFile(join(tempDir, 'specs', 'auth', 'login.md'), '# Login spec');

    const graph = new ArtifactGraph(schema);
    await detectArtifactStates(graph, tempDir);

    expect(graph.getNode('specs')!.status).toBe('completed');
    expect(graph.getNode('specs')!.matchedFiles).toHaveLength(1);
  });

  it('should mark children as ready when parent is completed', async () => {
    await writeTextFile(join(tempDir, 'proposal.md'), '# Proposal');

    const graph = new ArtifactGraph(schema);
    await detectArtifactStates(graph, tempDir);

    expect(graph.getNode('specs')!.status).toBe('ready');
    expect(graph.getNode('design')!.status).toBe('ready');
    expect(graph.getNode('tasks')!.status).toBe('pending');
  });

  it('should mark all as completed when all files exist', async () => {
    await writeTextFile(join(tempDir, 'proposal.md'), '# Proposal');
    await mkdir(join(tempDir, 'specs', 'auth'), { recursive: true });
    await writeTextFile(join(tempDir, 'specs', 'auth', 'spec.md'), '# Spec');
    await writeTextFile(join(tempDir, 'design.md'), '# Design');
    await writeTextFile(join(tempDir, 'tasks.md'), '# Tasks');

    const graph = new ArtifactGraph(schema);
    await detectArtifactStates(graph, tempDir);

    for (const id of ['proposal', 'specs', 'design', 'tasks']) {
      expect(graph.getNode(id)!.status).toBe('completed');
    }
    expect(graph.isComplete()).toBe(true);
  });

  it('should mark artifact as diverged when created before its dependency', async () => {
    // design.md exists, but proposal.md does NOT exist yet (out-of-order)
    await writeTextFile(join(tempDir, 'design.md'), '# Design (written before proposal)');

    const graph = new ArtifactGraph(schema);
    await detectArtifactStates(graph, tempDir);

    expect(graph.getNode('design')!.status).toBe('diverged');
    // proposal has no files — should be ready (no deps)
    expect(graph.getNode('proposal')!.status).toBe('ready');
  });

  it('should mark artifact as needs-sync when a dependency was updated after it', async () => {
    const proposalPath = join(tempDir, 'proposal.md');
    const designPath = join(tempDir, 'design.md');

    await writeTextFile(designPath, '# Design');
    await writeTextFile(proposalPath, '# Proposal');

    // Make design older than proposal by setting its mtime to the past
    const past = new Date(Date.now() - 10_000);
    await utimes(designPath, past, past);

    const graph = new ArtifactGraph(schema);
    await detectArtifactStates(graph, tempDir);

    // proposal was modified after design → design needs-sync
    expect(graph.getNode('design')!.status).toBe('needs-sync');
    expect(graph.getNode('proposal')!.status).toBe('completed');
  });
});
