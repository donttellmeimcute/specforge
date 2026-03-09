import { Command } from 'commander';
import chalk from 'chalk';
import { findProjectRoot } from '../utils/path-utils.js';
import { logger } from '../utils/logger.js';
import { generateAgentContext } from '../core/agent-context.js';

export const contextCommand = new Command('context')
  .description(
    'Generate agent-context rules files (.cursorrules / .clinerules) for IDE AI agents',
  )
  .option('-c, --change <name>', 'Include status snapshot for a specific change')
  .option(
    '--format <format>',
    'Output format: cursorrules, clinerules, or all (default: all)',
    'all',
  )
  .option('--print', 'Print generated content to stdout instead of writing files')
  .action(
    async (options: { change?: string; format: string; print?: boolean }) => {
      try {
        const projectRoot = await findProjectRoot();
        if (!projectRoot) {
          logger.error(
            'Not inside a SpecForge project. Run `specforge init` first.',
          );
          process.exitCode = 1;
          return;
        }

        type FormatType = 'cursorrules' | 'clinerules';
        let formats: FormatType[];
        if (options.format === 'cursorrules') {
          formats = ['cursorrules'];
        } else if (options.format === 'clinerules') {
          formats = ['clinerules'];
        } else {
          formats = ['cursorrules', 'clinerules'];
        }

        const result = await generateAgentContext(projectRoot, {
          changeName: options.change,
          formats: options.print ? [] : formats,
        });

        if (options.print) {
          logger.out(result.content);
          return;
        }

        for (const file of result.filesWritten) {
          console.error(chalk.green(`  ✔ Written: ${file}`));
        }
        console.error('');
        console.error(
          chalk.dim(
            '  IDE agents (Cursor, Cline, Copilot) will now understand /forge:* commands.',
          ),
        );
        console.error(
          chalk.dim('  Re-run `specforge context` to refresh the rules after changes.'),
        );
      } catch (error) {
        logger.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
      }
    },
  );
