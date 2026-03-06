import { Command } from 'commander';
import { join } from 'node:path';
import { findProjectRoot } from '../utils/path-utils.js';
import { logger } from '../utils/logger.js';
import { generateReport, reportToJson, reportToHtml } from '../core/export.js';
import { writeTextFile } from '../utils/file-system.js';

export const exportCommand = new Command('export')
  .description('Export project report')
  .option('--format <format>', 'Output format: json, html', 'json')
  .option('-o, --output <path>', 'Output file path')
  .action(async (options: { format: string; output?: string }) => {
    try {
      const projectRoot = await findProjectRoot();
      if (!projectRoot) {
        logger.error('Not inside a SpecForge project.');
        process.exitCode = 1;
        return;
      }

      const report = await generateReport(projectRoot);

      let content: string;
      let defaultExt: string;
      switch (options.format) {
        case 'html':
          content = reportToHtml(report);
          defaultExt = 'html';
          break;
        case 'json':
        default:
          content = reportToJson(report);
          defaultExt = 'json';
          break;
      }

      if (options.output) {
        await writeTextFile(options.output, content);
        logger.success(`Report exported to ${options.output}`);
      } else {
        const outputPath = join(projectRoot, `specforge-report.${defaultExt}`);
        await writeTextFile(outputPath, content);
        logger.success(`Report exported to ${outputPath}`);
      }
    } catch (error) {
      logger.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  });
