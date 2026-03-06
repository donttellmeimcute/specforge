import { Command } from 'commander';
import { createRequire } from 'node:module';
import { initCommand } from '../commands/init.js';
import { newChangeCommand } from '../commands/new-change.js';
import { statusCommand } from '../commands/status.js';
import { instructionsCommand } from '../commands/instructions.js';
import { listCommand } from '../commands/list.js';
import { validateCommand } from '../commands/validate.js';
import { archiveCommand } from '../commands/archive.js';
import { schemaCommand } from '../commands/schema.js';
import { configCommand } from '../commands/config.js';
import { generateCommand } from '../commands/generate.js';
import { diffCommand, mergeCommand } from '../commands/diff-merge.js';
import { conflictsCommand } from '../commands/conflicts.js';
import { exportCommand } from '../commands/export.js';
import { watchCommand } from '../commands/watch.js';
import { reviewCommand } from '../commands/review.js';

const require = createRequire(import.meta.url);
const pkg = require('../../package.json') as { version: string; description: string };

const program = new Command();

program
  .name('specforge')
  .description(pkg.description)
  .version(pkg.version, '-v, --version', 'Show the current version');

program.addCommand(initCommand);
program.addCommand(newChangeCommand);
program.addCommand(statusCommand);
program.addCommand(instructionsCommand);
program.addCommand(listCommand);
program.addCommand(validateCommand);
program.addCommand(archiveCommand);
program.addCommand(schemaCommand);
program.addCommand(configCommand);
program.addCommand(generateCommand);
program.addCommand(diffCommand);
program.addCommand(mergeCommand);
program.addCommand(conflictsCommand);
program.addCommand(exportCommand);
program.addCommand(watchCommand);
program.addCommand(reviewCommand);

program.parse(process.argv);
