import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { findProjectRoot, resolveSpecforgePath } from '../../src/utils/path-utils.js';
import { SPECFORGE_DIR } from '../../src/utils/constants.js';

describe('path-utils', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'specforge-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('findProjectRoot', () => {
    it('should find project root when .specforge exists in startDir', async () => {
      await mkdir(join(tempDir, SPECFORGE_DIR), { recursive: true });

      const root = await findProjectRoot(tempDir);
      expect(root).toBe(tempDir);
    });

    it('should find project root in a parent directory', async () => {
      await mkdir(join(tempDir, SPECFORGE_DIR), { recursive: true });
      const childDir = join(tempDir, 'src', 'deep', 'nested');
      await mkdir(childDir, { recursive: true });

      const root = await findProjectRoot(childDir);
      expect(root).toBe(tempDir);
    });

    it('should return null when no .specforge exists', async () => {
      const isolated = await mkdtemp(join(tmpdir(), 'specforge-noroot-'));
      try {
        const root = await findProjectRoot(isolated);
        expect(root).toBeNull();
      } finally {
        await rm(isolated, { recursive: true, force: true });
      }
    });
  });

  describe('resolveSpecforgePath', () => {
    it('should resolve path relative to .specforge directory', () => {
      const result = resolveSpecforgePath('/project', 'config.yaml');
      expect(result).toMatch(/\.specforge[/\\]config\.yaml$/);
    });

    it('should resolve nested paths', () => {
      const result = resolveSpecforgePath('/project', 'specs', 'auth', 'spec.md');
      expect(result).toMatch(/\.specforge[/\\]specs[/\\]auth[/\\]spec\.md$/);
    });
  });
});
