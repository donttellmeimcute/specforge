import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { initProject } from '../../src/core/init.js';
import {
  createChange,
  loadChangeMetadata,
  updateChangeMetadata,
} from '../../src/core/change.js';
import { pathExists, readTextFile } from '../../src/utils/file-system.js';
import { SPECFORGE_DIR, CHANGES_DIR, METADATA_FILE } from '../../src/utils/constants.js';

describe('change', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'specforge-change-'));
    await initProject(tempDir);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('createChange', () => {
    it('should create a change directory with metadata', async () => {
      const changeDir = await createChange(tempDir, 'add-auth');

      expect(await pathExists(changeDir)).toBe(true);
      expect(await pathExists(join(changeDir, METADATA_FILE))).toBe(true);
    });

    it('should create specs subdirectory', async () => {
      const changeDir = await createChange(tempDir, 'add-auth');
      expect(await pathExists(join(changeDir, 'specs'))).toBe(true);
    });

    it('should write valid metadata', async () => {
      await createChange(tempDir, 'add-auth');
      const changeDir = join(tempDir, SPECFORGE_DIR, CHANGES_DIR, 'add-auth');

      const metadata = await loadChangeMetadata(changeDir);
      expect(metadata).not.toBeNull();
      expect(metadata!.status).toBe('active');
      expect(metadata!.createdAt).toBeTruthy();
    });

    it('should reject invalid names', async () => {
      await expect(createChange(tempDir, 'Invalid Name')).rejects.toThrow(
        'Invalid change name',
      );
    });

    it('should reject duplicate names', async () => {
      await createChange(tempDir, 'add-auth');
      await expect(createChange(tempDir, 'add-auth')).rejects.toThrow('already exists');
    });

    it('should accept tags and author', async () => {
      await createChange(tempDir, 'add-auth', {
        tags: ['security', 'backend'],
        author: 'dev@test.com',
      });

      const changeDir = join(tempDir, SPECFORGE_DIR, CHANGES_DIR, 'add-auth');
      const metadata = await loadChangeMetadata(changeDir);
      expect(metadata!.tags).toEqual(['security', 'backend']);
      expect(metadata!.author).toBe('dev@test.com');
    });
  });

  describe('updateChangeMetadata', () => {
    it('should update metadata fields', async () => {
      const changeDir = await createChange(tempDir, 'my-change');

      await updateChangeMetadata(changeDir, { status: 'completed' });

      const metadata = await loadChangeMetadata(changeDir);
      expect(metadata!.status).toBe('completed');
    });

    it('should update the updatedAt timestamp', async () => {
      const changeDir = await createChange(tempDir, 'my-change');
      const original = await loadChangeMetadata(changeDir);

      // Small delay to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 10));
      await updateChangeMetadata(changeDir, { status: 'completed' });

      const updated = await loadChangeMetadata(changeDir);
      expect(updated!.updatedAt).not.toBe(original!.updatedAt);
    });
  });
});
