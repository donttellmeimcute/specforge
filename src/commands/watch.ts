import { Command } from 'commander';
import { findProjectRoot } from '../utils/path-utils.js';
import { logger } from '../utils/logger.js';
import { watchChangeCli } from '../core/watch.js';

export const watchCommand = new Command('watch')
  .description('Watch a change for file updates and auto-refresh artifact status')
  .argument('<change>', 'Name of the change to watch')
  .action(async (changeName: string) => {
    try {
      const projectRoot = await findProjectRoot();
      if (!projectRoot) {
        logger.error('Not inside a SpecForge project.');
        process.exitCode = 1;
        return;
      }

      logger.info(`Watching change "${changeName}"... (press Ctrl+C to stop)`);
      const controller = await watchChangeCli(projectRoot, changeName);

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
