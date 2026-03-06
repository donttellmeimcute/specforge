import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadProjectConfig, saveProjectConfig } from '../../src/core/project-config.js';
import { writeTextFile } from '../../src/utils/file-system.js';
import { SPECFORGE_DIR, CONFIG_FILE } from '../../src/utils/constants.js';

describe('project-config', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'specforge-config-'));
    await mkdir(join(tempDir, SPECFORGE_DIR), { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('loadProjectConfig', () => {
    it('should return defaults when no config.yaml exists', async () => {
      const config = await loadProjectConfig(tempDir);
      expect(config.schema).toBe('spec-driven');
    });

    it('should load a valid config.yaml', async () => {
      await writeTextFile(
        join(tempDir, SPECFORGE_DIR, CONFIG_FILE),
        `schema: tdd
context: "We use Rust"
rules:
  proposal:
    - Include rollback plan
`,
      );

      const config = await loadProjectConfig(tempDir);
      expect(config.schema).toBe('tdd');
      expect(config.context).toBe('We use Rust');
      expect(config.rules?.proposal).toEqual(['Include rollback plan']);
    });

    it('should handle invalid YAML gracefully', async () => {
      await writeTextFile(
        join(tempDir, SPECFORGE_DIR, CONFIG_FILE),
        `{invalid: yaml: [broken`,
      );

      const config = await loadProjectConfig(tempDir);
      expect(config.schema).toBe('spec-driven');
    });
  });

  describe('saveProjectConfig', () => {
    it('should save and reload config', async () => {
      const config = {
        schema: 'tdd' as const,
        context: 'Test context',
        rules: { proposal: ['Rule 1'] },
        plugins: undefined,
      };

      await saveProjectConfig(tempDir, config);
      const loaded = await loadProjectConfig(tempDir);

      expect(loaded.schema).toBe('tdd');
      expect(loaded.context).toBe('Test context');
    });
  });
});
