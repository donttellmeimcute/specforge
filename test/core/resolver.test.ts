import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  resolveSchema,
  listAvailableSchemas,
} from '../../src/core/artifact-graph/resolver.js';
import { writeTextFile } from '../../src/utils/file-system.js';
import { SPECFORGE_DIR, SCHEMAS_DIR } from '../../src/utils/constants.js';

describe('resolveSchema', () => {
  it('should resolve the built-in spec-driven schema', async () => {
    const schema = await resolveSchema('spec-driven');
    expect(schema.name).toBe('spec-driven');
    expect(schema.artifacts).toHaveLength(4);
    expect(schema.artifacts.map((a) => a.id)).toEqual([
      'proposal',
      'specs',
      'design',
      'tasks',
    ]);
  });

  it('should resolve the built-in tdd schema', async () => {
    const schema = await resolveSchema('tdd');
    expect(schema.name).toBe('tdd');
    expect(schema.artifacts.map((a) => a.id)).toEqual([
      'proposal',
      'tests',
      'implementation',
      'docs',
    ]);
  });

  it('should throw for non-existent schema', async () => {
    await expect(resolveSchema('nonexistent')).rejects.toThrow(
      'Schema "nonexistent" not found',
    );
  });

  describe('project-level schema', () => {
    let tempDir: string;

    beforeEach(async () => {
      tempDir = await mkdtemp(join(tmpdir(), 'specforge-resolver-'));
    });

    afterEach(async () => {
      await rm(tempDir, { recursive: true, force: true });
    });

    it('should prefer project schema over built-in', async () => {
      const schemaDir = join(tempDir, SPECFORGE_DIR, SCHEMAS_DIR, 'custom');
      await mkdir(schemaDir, { recursive: true });
      await writeTextFile(
        join(schemaDir, 'schema.yaml'),
        `name: custom
version: 1
description: "Custom project schema"
artifacts:
  - id: draft
    generates: draft.md
    description: "Draft document"
    requires: []
`,
      );

      const schema = await resolveSchema('custom', tempDir);
      expect(schema.name).toBe('custom');
      expect(schema.artifacts).toHaveLength(1);
      expect(schema.artifacts[0]!.id).toBe('draft');
    });

    it('should fall back to built-in when project schema not found', async () => {
      await mkdir(join(tempDir, SPECFORGE_DIR, SCHEMAS_DIR), { recursive: true });
      const schema = await resolveSchema('spec-driven', tempDir);
      expect(schema.name).toBe('spec-driven');
    });
  });
});

describe('listAvailableSchemas', () => {
  it('should list built-in schemas', async () => {
    const schemas = await listAvailableSchemas();
    expect(schemas).toContain('spec-driven');
    expect(schemas).toContain('tdd');
  });
});
