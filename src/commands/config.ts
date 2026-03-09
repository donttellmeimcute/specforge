import { Command } from 'commander';
import chalk from 'chalk';
import { findProjectRoot } from '../utils/path-utils.js';
import { logger } from '../utils/logger.js';
import { loadProjectConfig, saveProjectConfig } from '../core/project-config.js';

export const configCommand = new Command('config').description(
  'View or update project configuration',
);

configCommand
  .command('show')
  .description('Show current project configuration')
  .option('--json', 'Output as JSON')
  .action(async (options: { json?: boolean }) => {
    try {
      const projectRoot = await findProjectRoot();
      if (!projectRoot) {
        logger.error('Not inside a SpecForge project. Run `specforge init` first.');
        process.exitCode = 1;
        return;
      }

      const config = await loadProjectConfig(projectRoot);

      if (options.json) {
        logger.out(JSON.stringify(config, null, 2));
        return;
      }

      console.error('');
      console.error(chalk.bold('  Project Configuration:'));
      console.error(`  Schema: ${chalk.cyan(config.schema)}`);
      if (config.context) {
        console.error(`  Context: ${chalk.dim(config.context)}`);
      }
      if (config.rules) {
        console.error(chalk.bold('  Rules:'));
        for (const [artifact, rules] of Object.entries(config.rules)) {
          console.error(`    ${chalk.bold(artifact)}:`);
          for (const rule of rules) {
            console.error(`      - ${rule}`);
          }
        }
      }
      if (config.plugins && config.plugins.length > 0) {
        console.error(chalk.bold('  Plugins:'));
        for (const plugin of config.plugins) {
          console.error(`    - ${plugin.name}`);
        }
      }
      console.error('');
    } catch (error) {
      logger.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  });

configCommand
  .command('set <key> <value>')
  .description('Set a configuration value (schema, context)')
  .action(async (key: string, value: string) => {
    try {
      const projectRoot = await findProjectRoot();
      if (!projectRoot) {
        logger.error('Not inside a SpecForge project. Run `specforge init` first.');
        process.exitCode = 1;
        return;
      }

      const config = await loadProjectConfig(projectRoot);

      switch (key) {
        case 'schema':
          config.schema = value;
          break;
        case 'context':
          config.context = value;
          break;
        default:
          logger.error(`Unknown config key: "${key}". Valid keys: schema, context`);
          process.exitCode = 1;
          return;
      }

      await saveProjectConfig(projectRoot, config);
      logger.success(`Set ${key} = ${value}`);
    } catch (error) {
      logger.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  });
