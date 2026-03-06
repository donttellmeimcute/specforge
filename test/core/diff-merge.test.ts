import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { initProject } from '../../src/core/init.js';
import { createChange } from '../../src/core/change.js';
import { diffSpecs, mergeSpecs } from '../../src/core/diff-merge.js';
import { ensureDir, writeTextFile, readTextFile } from '../../src/utils/file-system.js';

describe('diff-merge', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'specforge-diffmerge-'));
    await initProject(tempDir);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should detect added spec files', async () => {
    await createChange(tempDir, 'my-change');

    // Create a spec file in the change only
    const changeSpecsDir = join(tempDir, '.specforge', 'changes', 'my-change', 'specs');
    await mkdir(changeSpecsDir, { recursive: true });
    await writeFile(join(changeSpecsDir, 'proposal.md'), '# New Proposal');

    const diffs = await diffSpecs(tempDir, 'my-change');
    const added = diffs.filter((d) => d.type === 'added');
    expect(added.length).toBe(1);
    expect(added[0]!.file).toBe('proposal.md');
  });

  it('should detect modified spec files', async () => {
    await createChange(tempDir, 'my-change');

    // Create the same file in main and change specs
    const mainSpecsDir = join(tempDir, '.specforge', 'specs');
    const changeSpecsDir = join(tempDir, '.specforge', 'changes', 'my-change', 'specs');
    await mkdir(mainSpecsDir, { recursive: true });
    await mkdir(changeSpecsDir, { recursive: true });

    await writeFile(join(mainSpecsDir, 'proposal.md'), '# Original');
    await writeFile(join(changeSpecsDir, 'proposal.md'), '# Modified');

    const diffs = await diffSpecs(tempDir, 'my-change');
    const modified = diffs.filter((d) => d.type === 'modified');
    expect(modified.length).toBe(1);
  });

  it('should merge spec files from change to main', async () => {
    await createChange(tempDir, 'my-change');

    const changeSpecsDir = join(tempDir, '.specforge', 'changes', 'my-change', 'specs');
    await mkdir(changeSpecsDir, { recursive: true });
    await writeFile(join(changeSpecsDir, 'proposal.md'), '# Merged Proposal');

    const result = await mergeSpecs(tempDir, 'my-change');
    expect(result.merged).toContain('proposal.md');

    const mainContent = await readTextFile(
      join(tempDir, '.specforge', 'specs', 'proposal.md'),
    );
    expect(mainContent).toBe('# Merged Proposal');
  });
});
