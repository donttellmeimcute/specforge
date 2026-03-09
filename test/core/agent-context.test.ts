import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateAgentContext } from '../../src/core/agent-context.js';
import { initProject } from '../../src/core/init.js';
import { readTextFile } from '../../src/utils/file-system.js';

describe('generateAgentContext', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'specforge-ctx-'));
    await initProject(tempDir, { schema: 'spec-driven', context: 'Test project' });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should generate content containing slash commands', async () => {
    const result = await generateAgentContext(tempDir, { formats: [] });

    expect(result.content).toContain('/forge:propose');
    expect(result.content).toContain('/forge:apply');
    expect(result.content).toContain('/forge:validate');
    expect(result.content).toContain('/forge:status');
    expect(result.content).toContain('/forge:archive');
  });

  it('should include self-healing workflow instructions', async () => {
    const result = await generateAgentContext(tempDir, { formats: [] });

    expect(result.content).toContain('score < 90');
    expect(result.content).toContain('selfHealingInstructions');
    expect(result.content).toContain('specforge validate --deep --json');
  });

  it('should document fluid DAG statuses', async () => {
    const result = await generateAgentContext(tempDir, { formats: [] });

    expect(result.content).toContain('diverged');
    expect(result.content).toContain('needs-sync');
  });

  it('should include the project context when provided', async () => {
    const result = await generateAgentContext(tempDir, { formats: [] });

    expect(result.content).toContain('Test project');
  });

  it('should write .cursorrules when format is cursorrules', async () => {
    const result = await generateAgentContext(tempDir, { formats: ['cursorrules'] });

    expect(result.filesWritten).toHaveLength(1);
    expect(result.filesWritten[0]).toMatch(/\.cursorrules$/);

    const fileContent = await readTextFile(join(tempDir, '.cursorrules'));
    expect(fileContent).toContain('/forge:propose');
  });

  it('should write .clinerules when format is clinerules', async () => {
    const result = await generateAgentContext(tempDir, { formats: ['clinerules'] });

    expect(result.filesWritten).toHaveLength(1);
    expect(result.filesWritten[0]).toMatch(/\.clinerules$/);
  });

  it('should write both files when both formats requested', async () => {
    const result = await generateAgentContext(tempDir, {
      formats: ['cursorrules', 'clinerules'],
    });

    expect(result.filesWritten).toHaveLength(2);
  });

  it('should not write any files when formats is empty', async () => {
    const result = await generateAgentContext(tempDir, { formats: [] });

    expect(result.filesWritten).toHaveLength(0);
  });

  it('should include schema name in the output', async () => {
    const result = await generateAgentContext(tempDir, { formats: [] });

    expect(result.content).toContain('spec-driven');
  });
});
