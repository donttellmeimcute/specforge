import { Command } from 'commander';
import { createChange } from '../core/change.js';
import { findProjectRoot } from '../utils/path-utils.js';
import { logger } from '../utils/logger.js';
import { text, confirm } from '@clack/prompts';

export const newChangeCommand = new Command('new')
  .description('Create a new change or artifact')
  .command('change [name]')
  .description('Create a new change (interactive if name omitted)')
  .option('-s, --schema <name>', 'Override workflow schema for this change')
  .option('-t, --tags <tags...>', 'Tags for categorization')
  .option('-a, --author <name>', 'Author identifier')
  .option('--asana <taskId>', 'Asana task ID to link and pull details from')
  .action(
    async (
      name: string | undefined,
      options: { schema?: string; tags?: string[]; author?: string; asana?: string },
    ) => {
      try {
        const projectRoot = await findProjectRoot();
        if (!projectRoot) {
          logger.error('Not inside a SpecForge project. Run `specforge init` first.');
          process.exitCode = 1;
          return;
        }

        let changeName: string;
        if (name) {
          changeName = name;
        } else {
          const inputName = await text({
            message: 'Enter a name for the new change (kebab-case):',
            validate: (value) =>
              value && /^[a-z0-9][a-z0-9-]*$/.test(value)
                ? undefined
                : 'Name must be lowercase alphanumeric with hyphens',
          });
          if (typeof inputName === 'symbol' || !inputName) return;
          changeName = inputName as string;

          const wantAsana = await confirm({
            message: 'Do you want to link an Asana task?',
            initialValue: false,
          });
          if (wantAsana === true) {
            const asanaId = await text({ message: 'Enter Asana Task ID:' });
            if (typeof asanaId === 'string') options.asana = asanaId;
          }
        }

        if (!changeName) {
          logger.error('Change name is required.');
          process.exitCode = 1;
          return;
        }

        await createChange(projectRoot, changeName, options);
      } catch (error) {
        logger.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
      }
    },
  );
