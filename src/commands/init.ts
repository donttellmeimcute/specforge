import { Command } from 'commander';
import { initProject } from '../core/init.js';
import { text, select, confirm, intro, outro } from '@clack/prompts';
import { loadGlobalConfig, saveGlobalConfig } from '../core/global-config.js';

export const initCommand = new Command('init')
  .description('Initialize SpecForge in the current project (interactive by default)')
  .option('-s, --schema <name>', 'Workflow schema to use')
  .option('-c, --context <text>', 'Project context description')
  .option('-y, --yes', 'Skip interactive prompts and use defaults')
  .action(async (options: { schema?: string; context?: string; yes?: boolean }) => {
    try {
      let { schema, context } = options;

      intro("Welcome to SpecForge! Let's set up your project.");

      if (!options.yes) {
        if (!schema) {
          const schemaSelection = await select({
            message: 'Select a workflow schema:',
            options: [
              {
                label: 'spec-driven (Default, Proposal -> Specs -> Design -> Tasks)',
                value: 'spec-driven',
              },
              {
                label: 'tdd (Test-Driven, Proposal -> Tests -> Impl -> Docs)',
                value: 'tdd',
              },
            ],
          });
          if (typeof schemaSelection === 'symbol') return;
          schema = schemaSelection as string;
        }
        if (!context) {
          const contextSelection = await text({
            message:
              'Provide a brief context of the project (e.g., Tech stack, conventions):',
          });
          if (typeof contextSelection === 'symbol') return;
          context = contextSelection;
        }

        const globalConfig = await loadGlobalConfig();
        if (globalConfig.telemetry === undefined) {
          const optIn = await confirm({
            message:
              'SpecForge can collect anonymous usage metrics to improve the tool. Do you want to opt-in?',
            initialValue: false,
          });
          if (typeof optIn !== 'symbol') {
            globalConfig.telemetry = optIn;
            await saveGlobalConfig(globalConfig);
          }
        }
      }

      await initProject(process.cwd(), {
        schema: schema || 'spec-driven',
        context: context,
      });

      outro('SpecForge initialized successfully!');
    } catch (error) {
      const { logger } = await import('../utils/logger.js');
      logger.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  });
