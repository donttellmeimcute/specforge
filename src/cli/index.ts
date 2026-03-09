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
import { contextCommand } from '../commands/context.js';
import { watchCommand } from '../commands/watch.js';
import { reviewCommand } from '../commands/review.js';
import { syncCommand } from '../commands/sync/index.js';
import { initTelemetry, trackCommand, trackError, closeTelemetry } from '../telemetry/index.js';

const require = createRequire(import.meta.url);
const pkg = require('../../package.json') as { version: string; description: string };

const program = new Command();

program
  .name('specforge')
  .description(pkg.description)
  .version(pkg.version, '-v, --version', 'Show the current version');

// Global preAction hook for Telemetry and unified setup
program.hook('preAction', async (_thisCommand, actionCommand) => {
  await initTelemetry();
  trackCommand(actionCommand.name(), { args: actionCommand.args });
});

program.hook('postAction', async () => {
  await closeTelemetry();
});

// Group commands for better scaling
const changeGroup = new Command('change').description('Manage changes (diff, merge, watch, status, archive)');
changeGroup.addCommand(newChangeCommand); // new is technically "new change" but left as global for UX, but let's link it
changeGroup.addCommand(statusCommand);
changeGroup.addCommand(archiveCommand);
changeGroup.addCommand(watchCommand);
changeGroup.addCommand(diffCommand);
changeGroup.addCommand(mergeCommand);
changeGroup.addCommand(conflictsCommand);
program.addCommand(changeGroup);

// Keep root commands for backwards compatibility and ease of use, but now they are tracked
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
program.addCommand(contextCommand);
program.addCommand(syncCommand);

// Add global error handler for telemetry
program.exitOverride();

try {
  program.parse(process.argv);
} catch (err) {
  if (err instanceof Error) {
    if ((err as any).code !== 'commander.helpDisplayed' && (err as any).code !== 'commander.version') {
      trackError(program.args[0] || 'unknown', err);
    }
  }
  closeTelemetry().then(() => {
    process.exit(1);
  });
}
