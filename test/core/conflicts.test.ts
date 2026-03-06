import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { initProject } from '../../src/core/init.js';
import { createChange } from '../../src/core/change.js';
import { detectConflicts } from '../../src/core/conflicts.js';

describe('conflicts', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'specforge-conflicts-'));
    await initProject(tempDir);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should return no conflicts for single change', async () => {
    await createChange(tempDir, 'change-a');
    const conflicts = await detectConflicts(tempDir);
    expect(conflicts).toEqual([]);
  });

  it('should detect conflicts when two changes modify the same file', async () => {
    await createChange(tempDir, 'change-a');
    await createChange(tempDir, 'change-b');

    // Both changes modify the same spec file
    const specsA = join(tempDir, '.specforge', 'changes', 'change-a', 'specs');
    const specsB = join(tempDir, '.specforge', 'changes', 'change-b', 'specs');
    await mkdir(specsA, { recursive: true });
    await mkdir(specsB, { recursive: true });

    await writeFile(join(specsA, 'proposal.md'), '# Proposal A');
    await writeFile(join(specsB, 'proposal.md'), '# Proposal B');

    const conflicts = await detectConflicts(tempDir);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]!.file).toBe('proposal.md');
    expect(conflicts[0]!.changes).toContain('change-a');
    expect(conflicts[0]!.changes).toContain('change-b');
  });

  it('should not flag non-overlapping changes', async () => {
    await createChange(tempDir, 'change-a');
    await createChange(tempDir, 'change-b');

    const specsA = join(tempDir, '.specforge', 'changes', 'change-a', 'specs');
    const specsB = join(tempDir, '.specforge', 'changes', 'change-b', 'specs');
    await mkdir(specsA, { recursive: true });
    await mkdir(specsB, { recursive: true });

    await writeFile(join(specsA, 'proposal.md'), '# Proposal A');
    await writeFile(join(specsB, 'design.md'), '# Design B');

    const conflicts = await detectConflicts(tempDir);
    expect(conflicts).toHaveLength(0);
  });
});
