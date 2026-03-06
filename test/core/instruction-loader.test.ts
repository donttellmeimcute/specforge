import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { initProject } from '../../src/core/init.js';
import { createChange } from '../../src/core/change.js';
import { writeTextFile } from '../../src/utils/file-system.js';
import { ArtifactGraph } from '../../src/core/artifact-graph/graph.js';
import { detectArtifactStates } from '../../src/core/artifact-graph/state.js';
import { resolveSchema } from '../../src/core/artifact-graph/resolver.js';
import { loadInstructions } from '../../src/core/artifact-graph/instruction-loader.js';
import { SPECFORGE_DIR, CHANGES_DIR } from '../../src/utils/constants.js';

describe('instruction-loader', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'specforge-instructions-'));
    await initProject(tempDir, { context: 'TypeScript + React project' });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should generate instructions for an artifact', async () => {
    const changeDir = await createChange(tempDir, 'add-auth');
    const schema = await resolveSchema('spec-driven');
    const graph = new ArtifactGraph(schema);
    await detectArtifactStates(graph, changeDir);

    const instructions = await loadInstructions(
      graph,
      'proposal',
      changeDir,
      tempDir,
      'TypeScript + React project',
    );

    expect(instructions).toContain('proposal');
    expect(instructions).toContain('TypeScript + React project');
    expect(instructions).toContain('proposal.md');
  });

  it('should include dependency content when available', async () => {
    const changeDir = await createChange(tempDir, 'add-auth');

    // Write proposal
    await writeTextFile(
      join(changeDir, 'proposal.md'),
      '# Auth Proposal\nAdd OAuth2 login',
    );

    const schema = await resolveSchema('spec-driven');
    const graph = new ArtifactGraph(schema);
    await detectArtifactStates(graph, changeDir);

    const instructions = await loadInstructions(
      graph,
      'specs',
      changeDir,
      tempDir,
      'TypeScript + React project',
    );

    expect(instructions).toContain('Completed Dependencies');
    expect(instructions).toContain('Auth Proposal');
    expect(instructions).toContain('OAuth2');
  });

  it('should include artifact rules when provided', async () => {
    const changeDir = await createChange(tempDir, 'add-auth');
    const schema = await resolveSchema('spec-driven');
    const graph = new ArtifactGraph(schema);
    await detectArtifactStates(graph, changeDir);

    const rules = { proposal: ['Include rollback plan', 'Identify affected teams'] };

    const instructions = await loadInstructions(
      graph,
      'proposal',
      changeDir,
      tempDir,
      undefined,
      rules,
    );

    expect(instructions).toContain('Include rollback plan');
    expect(instructions).toContain('Identify affected teams');
  });

  it('should throw for non-existent artifact', async () => {
    const changeDir = await createChange(tempDir, 'add-auth');
    const schema = await resolveSchema('spec-driven');
    const graph = new ArtifactGraph(schema);

    await expect(
      loadInstructions(graph, 'nonexistent', changeDir, tempDir),
    ).rejects.toThrow('not found');
  });
});
