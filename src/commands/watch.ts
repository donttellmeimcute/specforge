import { Command } from 'commander';
import { findProjectRoot } from '../utils/path-utils.js';
import { logger } from '../utils/logger.js';
import { watchChangeCli } from '../core/watch.js';

export const watchCommand = new Command('watch')
  .description('Watch a change for file updates and auto-refresh artifact status')
  .argument('<change>', 'Name of the change to watch')
  .option('--auto-fix', 'Use AI to continuously validate and auto-fix code against specs')
  .action(async (changeName: string, options: { autoFix?: boolean }) => {
    try {
      const projectRoot = await findProjectRoot();
      if (!projectRoot) {
        logger.error('Not inside a SpecForge project.');
        process.exitCode = 1;
        return;
      }

      logger.info(`Watching change "${changeName}"... (press Ctrl+C to stop)`);
      if (options.autoFix) {
        logger.warn('Auto-fix is enabled. AI will analyze and potentially modify files automatically.');
      }
      const controller = await watchChangeCli(projectRoot, changeName, { autoFix: options.autoFix });

      // Handle clean shutdown
      process.on('SIGINT', () => {
        controller.abort();
        logger.info('\nWatch stopped.');
        process.exit(0);
      });

      // Keep the process alive
      await new Promise(() => {});
    } catch (error) {
      logger.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  });
