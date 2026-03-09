import { Command } from 'commander';
import { initProject } from '../core/init.js';
import { input, select } from '@inquirer/prompts';

export const initCommand = new Command('init')
  .description('Initialize SpecForge in the current project (interactive by default)')
  .option('-s, --schema <name>', 'Workflow schema to use')
  .option('-c, --context <text>', 'Project context description')
  .option('-y, --yes', 'Skip interactive prompts and use defaults')
  .action(async (options: { schema?: string; context?: string; yes?: boolean }) => {
    try {
      let { schema, context } = options;

      if (!options.yes) {
        if (!schema) {
          schema = await select({
            message: 'Select a workflow schema:',
            choices: [
              { name: 'spec-driven (Default, Proposal -> Specs -> Design -> Tasks)', value: 'spec-driven' },
              { name: 'tdd (Test-Driven, Proposal -> Tests -> Impl -> Docs)', value: 'tdd' },
            ],
          });
        }
        if (!context) {
          context = await input({
            message: 'Provide a brief context of the project (e.g., Tech stack, conventions):',
          });
        }
      }

      await initProject(process.cwd(), {
        schema: schema || 'spec-driven',
        context: context,
      });
    } catch (error) {
      const { logger } = await import('../utils/logger.js');
      logger.error(
        error instanceof Error ? error.message : String(error),
      );
      process.exitCode = 1;
    }
  });
