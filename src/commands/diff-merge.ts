import { Command } from 'commander';
import chalk from 'chalk';
import { findProjectRoot } from '../utils/path-utils.js';
import { logger } from '../utils/logger.js';
import { diffSpecs, mergeSpecs } from '../core/diff-merge.js';

export const diffCommand = new Command('diff')
  .description('Show diff between change specs and main specs')
  .argument('<change>', 'Name of the change')
  .option('--json', 'Output as JSON')
  .action(async (changeName: string, options: { json?: boolean }) => {
    try {
      const projectRoot = await findProjectRoot();
      if (!projectRoot) {
        logger.error('Not inside a SpecForge project.');
        process.exitCode = 1;
        return;
      }

      const diffs = await diffSpecs(projectRoot, changeName);

      if (options.json) {
        logger.out(JSON.stringify(diffs, null, 2));
        return;
      }

      const changes = diffs.filter((d) => d.type !== 'unchanged');
      if (changes.length === 0) {
        logger.info('No spec differences found.');
        return;
      }

      console.error('');
      console.error(chalk.bold(`  Spec diff for change: ${changeName}`));
      console.error('');

      for (const diff of changes) {
        const icon = diff.type === 'added' ? chalk.green('+') : chalk.yellow('~');
        const label = diff.type === 'added' ? chalk.green('added') : chalk.yellow('modified');
        console.error(`  ${icon} ${diff.file} [${label}]`);
      }
      console.error('');
    } catch (error) {
      logger.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  });

export const mergeCommand = new Command('merge')
  .description('Merge change specs into main specs')
  .argument('<change>', 'Name of the change')
  .action(async (changeName: string) => {
    try {
      const projectRoot = await findProjectRoot();
      if (!projectRoot) {
        logger.error('Not inside a SpecForge project.');
        process.exitCode = 1;
        return;
      }

      const result = await mergeSpecs(projectRoot, changeName);

      if (result.merged.length === 0) {
        logger.info('Nothing to merge.');
        return;
      }

      for (const file of result.merged) {
        logger.success(`Merged: ${file}`);
      }

      if (result.conflicts.length > 0) {
        for (const file of result.conflicts) {
          logger.warn(`Conflict: ${file}`);
        }
      }
    } catch (error) {
      logger.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  });
