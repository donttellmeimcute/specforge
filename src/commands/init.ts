import { Command } from 'commander';
import { initProject } from '../core/init.js';

export const initCommand = new Command('init')
  .description('Initialize SpecForge in the current project')
  .option('-s, --schema <name>', 'Workflow schema to use', 'spec-driven')
  .option('-c, --context <text>', 'Project context description')
  .action(async (options: { schema: string; context?: string }) => {
    try {
      await initProject(process.cwd(), {
        schema: options.schema,
        context: options.context,
      });
    } catch (error) {
      const { logger } = await import('../utils/logger.js');
      logger.error(
        error instanceof Error ? error.message : String(error),
      );
      process.exitCode = 1;
    }
  });
