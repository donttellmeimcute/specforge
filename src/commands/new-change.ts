import { Command } from 'commander';
import { createChange } from '../core/change.js';
import { findProjectRoot } from '../utils/path-utils.js';
import { logger } from '../utils/logger.js';

export const newChangeCommand = new Command('new')
  .description('Create a new change or artifact')
  .command('change <name>')
  .description('Create a new change')
  .option('-s, --schema <name>', 'Override workflow schema for this change')
  .option('-t, --tags <tags...>', 'Tags for categorization')
  .option('-a, --author <name>', 'Author identifier')
  .action(
    async (
      name: string,
      options: { schema?: string; tags?: string[]; author?: string },
    ) => {
      try {
        const projectRoot = await findProjectRoot();
        if (!projectRoot) {
          logger.error(
            'Not inside a SpecForge project. Run `specforge init` first.',
          );
          process.exitCode = 1;
          return;
        }

        await createChange(projectRoot, name, options);
      } catch (error) {
        logger.error(
          error instanceof Error ? error.message : String(error),
        );
        process.exitCode = 1;
      }
    },
  );
