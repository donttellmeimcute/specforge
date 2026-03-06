import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { initProject } from '../../src/core/init.js';
import { pathExists, readTextFile } from '../../src/utils/file-system.js';
import { SPECFORGE_DIR, CONFIG_FILE, SPECS_DIR, CHANGES_DIR, SCHEMAS_DIR, ARCHIVE_DIR } from '../../src/utils/constants.js';

describe('initProject', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'specforge-init-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should create the .specforge directory structure', async () => {
    await initProject(tempDir);

    expect(await pathExists(join(tempDir, SPECFORGE_DIR))).toBe(true);
    expect(await pathExists(join(tempDir, SPECFORGE_DIR, SPECS_DIR))).toBe(true);
    expect(await pathExists(join(tempDir, SPECFORGE_DIR, CHANGES_DIR))).toBe(true);
    expect(await pathExists(join(tempDir, SPECFORGE_DIR, CHANGES_DIR, ARCHIVE_DIR))).toBe(true);
    expect(await pathExists(join(tempDir, SPECFORGE_DIR, SCHEMAS_DIR))).toBe(true);
  });

  it('should create config.yaml with default schema', async () => {
    await initProject(tempDir);

    const configPath = join(tempDir, SPECFORGE_DIR, CONFIG_FILE);
    const content = await readTextFile(configPath);
    expect(content).not.toBeNull();
    expect(content).toContain('spec-driven');
  });

  it('should accept custom schema option', async () => {
    await initProject(tempDir, { schema: 'tdd' });

    const content = await readTextFile(join(tempDir, SPECFORGE_DIR, CONFIG_FILE));
    expect(content).toContain('tdd');
  });

  it('should accept context option', async () => {
    await initProject(tempDir, { context: 'TypeScript + React' });

    const content = await readTextFile(join(tempDir, SPECFORGE_DIR, CONFIG_FILE));
    expect(content).toContain('TypeScript + React');
  });

  it('should throw if already initialized', async () => {
    await initProject(tempDir);
    await expect(initProject(tempDir)).rejects.toThrow('already initialized');
  });

  it('should create .gitkeep files', async () => {
    await initProject(tempDir);

    expect(await pathExists(join(tempDir, SPECFORGE_DIR, SPECS_DIR, '.gitkeep'))).toBe(true);
    expect(await pathExists(join(tempDir, SPECFORGE_DIR, SCHEMAS_DIR, '.gitkeep'))).toBe(true);
  });
});
