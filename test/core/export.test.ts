import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { initProject } from '../../src/core/init.js';
import { createChange } from '../../src/core/change.js';
import { generateReport, reportToJson, reportToHtml } from '../../src/core/export.js';

describe('export', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'specforge-export-'));
    await initProject(tempDir);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should generate a report with no changes', async () => {
    const report = await generateReport(tempDir);
    expect(report.schema).toBe('spec-driven');
    expect(report.changes).toEqual([]);
    expect(report.metrics.totalChanges).toBe(0);
  });

  it('should include change in report', async () => {
    await createChange(tempDir, 'my-feature');
    const report = await generateReport(tempDir);
    expect(report.changes.length).toBe(1);
    expect(report.changes[0]!.name).toBe('my-feature');
    expect(report.metrics.totalChanges).toBe(1);
    expect(report.metrics.activeChanges).toBe(1);
  });

  it('should export as JSON', async () => {
    await createChange(tempDir, 'test');
    const report = await generateReport(tempDir);
    const json = reportToJson(report);
    const parsed = JSON.parse(json);
    expect(parsed.schema).toBe('spec-driven');
    expect(parsed.changes).toHaveLength(1);
  });

  it('should export as HTML', async () => {
    await createChange(tempDir, 'test');
    const report = await generateReport(tempDir);
    const html = reportToHtml(report);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('SpecForge');
    expect(html).toContain('test');
  });
});
