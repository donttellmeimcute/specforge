import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { initProject } from '../../src/core/init.js';
import { createChange } from '../../src/core/change.js';
import {
  generateReport,
  reportToJson,
  reportToHtml,
  reportToMarkdown,
} from '../../src/core/export.js';

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

  it('should export as Markdown with project skills', async () => {
    const report = await generateReport(tempDir);
    const md = reportToMarkdown(report);
    expect(md).toContain('# SpecForge Project Skills');
    expect(md).toContain('spec-driven');
    expect(md).toContain('## Metrics');
  });

  it('should include changes in Markdown export', async () => {
    await createChange(tempDir, 'my-feature');
    const report = await generateReport(tempDir);
    const md = reportToMarkdown(report);
    expect(md).toContain('my-feature');
    expect(md).toContain('## Changes');
    expect(md).toContain('active');
  });

  it('should include context in Markdown export when provided', async () => {
    const tempDirWithContext = await mkdtemp(join(tmpdir(), 'specforge-export-ctx-'));
    try {
      await initProject(tempDirWithContext, { context: 'React + TypeScript app' });
      const report = await generateReport(tempDirWithContext);
      const md = reportToMarkdown(report);
      expect(md).toContain('React + TypeScript app');
    } finally {
      await rm(tempDirWithContext, { recursive: true, force: true });
    }
  });
});
