import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  pathExists,
  readTextFile,
  writeTextFile,
  ensureDir,
} from '../../src/utils/file-system.js';

describe('file-system', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'specforge-fs-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('pathExists', () => {
    it('should return true for existing directory', async () => {
      expect(await pathExists(tempDir)).toBe(true);
    });

    it('should return false for non-existing path', async () => {
      expect(await pathExists(join(tempDir, 'nope'))).toBe(false);
    });
  });

  describe('readTextFile', () => {
    it('should read an existing file', async () => {
      const filePath = join(tempDir, 'test.txt');
      await writeTextFile(filePath, 'hello world');

      const content = await readTextFile(filePath);
      expect(content).toBe('hello world');
    });

    it('should return null for non-existing file', async () => {
      const content = await readTextFile(join(tempDir, 'missing.txt'));
      expect(content).toBeNull();
    });
  });

  describe('writeTextFile', () => {
    it('should create parent directories', async () => {
      const filePath = join(tempDir, 'a', 'b', 'c', 'file.txt');
      await writeTextFile(filePath, 'deep content');

      const content = await readFile(filePath, 'utf-8');
      expect(content).toBe('deep content');
    });
  });

  describe('ensureDir', () => {
    it('should create nested directory', async () => {
      const dir = join(tempDir, 'x', 'y', 'z');
      await ensureDir(dir);
      expect(await pathExists(dir)).toBe(true);
    });

    it('should not throw if directory already exists', async () => {
      await ensureDir(tempDir);
      expect(await pathExists(tempDir)).toBe(true);
    });
  });
});
