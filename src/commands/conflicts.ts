import { Command } from 'commander';
import chalk from 'chalk';
import { findProjectRoot } from '../utils/path-utils.js';
import { logger } from '../utils/logger.js';
import { detectConflicts } from '../core/conflicts.js';

export const conflictsCommand = new Command('conflicts')
  .description('Detect conflicts between concurrent changes')
  .option('--json', 'Output as JSON')
  .action(async (options: { json?: boolean }) => {
    try {
      const projectRoot = await findProjectRoot();
      if (!projectRoot) {
        logger.error('Not inside a SpecForge project.');
        process.exitCode = 1;
        return;
      }

      const conflicts = await detectConflicts(projectRoot);

      if (options.json) {
        logger.out(JSON.stringify(conflicts, null, 2));
        return;
      }

      if (conflicts.length === 0) {
        logger.success('No conflicts detected between changes.');
        return;
      }

      console.error('');
      console.error(chalk.red.bold(`  ${conflicts.length} conflict(s) detected:`));
      console.error('');

      for (const conflict of conflicts) {
        console.error(chalk.red(`  ✖ ${conflict.file}`));
        console.error(
          chalk.dim(`    Modified by: ${conflict.changes.join(', ')}`),
        );
      }
      console.error('');
    } catch (error) {
      logger.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  });
