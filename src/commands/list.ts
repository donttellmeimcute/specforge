import { Command } from 'commander';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import chalk from 'chalk';
import { findProjectRoot, resolveSpecforgePath } from '../utils/path-utils.js';
import { logger } from '../utils/logger.js';
import { CHANGES_DIR, SPECS_DIR, ARCHIVE_DIR } from '../utils/constants.js';
import { loadChangeMetadata } from '../core/change.js';
import { pathExists } from '../utils/file-system.js';

export const listCommand = new Command('list')
  .description('List changes or specs')
  .argument('[what]', 'What to list: changes (default) or specs', 'changes')
  .option('--all', 'Include archived changes')
  .option('--json', 'Output as JSON')
  .action(async (what: string, options: { all?: boolean; json?: boolean }) => {
    try {
      const projectRoot = await findProjectRoot();
      if (!projectRoot) {
        logger.error(
          'Not inside a SpecForge project. Run `specforge init` first.',
        );
        process.exitCode = 1;
        return;
      }

      if (what === 'changes') {
        await listChanges(projectRoot, options);
      } else if (what === 'specs') {
        await listSpecs(projectRoot, options);
      } else {
        logger.error(`Unknown list target: "${what}". Use "changes" or "specs".`);
        process.exitCode = 1;
      }
    } catch (error) {
      logger.error(
        error instanceof Error ? error.message : String(error),
      );
      process.exitCode = 1;
    }
  });

async function listChanges(
  projectRoot: string,
  options: { all?: boolean; json?: boolean },
): Promise<void> {
  const changesDir = resolveSpecforgePath(projectRoot, CHANGES_DIR);

  if (!(await pathExists(changesDir))) {
    logger.info('No changes directory found.');
    return;
  }

  const entries = await readdir(changesDir, { withFileTypes: true });
  const changes: Array<{
    name: string;
    status: string;
    createdAt: string;
    archived: boolean;
  }> = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name === ARCHIVE_DIR) {
      if (options.all) {
        // List archived changes
        const archiveDir = join(changesDir, ARCHIVE_DIR);
        const archiveEntries = await readdir(archiveDir, {
          withFileTypes: true,
        });
        for (const ae of archiveEntries) {
          if (!ae.isDirectory()) continue;
          const metadata = await loadChangeMetadata(
            join(archiveDir, ae.name),
          );
          changes.push({
            name: ae.name,
            status: metadata?.status ?? 'unknown',
            createdAt: metadata?.createdAt ?? '',
            archived: true,
          });
        }
      }
      continue;
    }

    const metadata = await loadChangeMetadata(join(changesDir, entry.name));
    changes.push({
      name: entry.name,
      status: metadata?.status ?? 'unknown',
      createdAt: metadata?.createdAt ?? '',
      archived: false,
    });
  }

  if (options.json) {
    logger.out(JSON.stringify(changes, null, 2));
    return;
  }

  if (changes.length === 0) {
    logger.info('No changes found. Run `specforge new change <name>` to create one.');
    return;
  }

  console.error('');
  console.error(chalk.bold('  Changes:'));
  console.error('');
  for (const change of changes) {
    const archived = change.archived ? chalk.dim(' [archived]') : '';
    const status = chalk.cyan(change.status);
    console.error(`  • ${chalk.bold(change.name)} — ${status}${archived}`);
  }
  console.error('');
}

async function listSpecs(
  projectRoot: string,
  options: { json?: boolean },
): Promise<void> {
  const specsDir = resolveSpecforgePath(projectRoot, SPECS_DIR);

  if (!(await pathExists(specsDir))) {
    logger.info('No specs directory found.');
    return;
  }

  const fg = (await import('fast-glob')).default;
  const specFiles = await fg('**/*.md', {
    cwd: specsDir,
    onlyFiles: true,
  });

  if (options.json) {
    logger.out(JSON.stringify(specFiles, null, 2));
    return;
  }

  if (specFiles.length === 0) {
    logger.info('No specs found.');
    return;
  }

  console.error('');
  console.error(chalk.bold('  Specs:'));
  console.error('');
  for (const file of specFiles.sort()) {
    console.error(`  • ${file}`);
  }
  console.error('');
}
