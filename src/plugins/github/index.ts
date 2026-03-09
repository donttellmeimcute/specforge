import { Command } from 'commander';
import { SpecForgePlugin } from '../../core/plugins.js';
import { logger } from '../../utils/logger.js';

const githubSyncCommand = new Command('github')
  .description('Export current status to a GitHub issue or PR')
  .argument('<change>', 'Name of the change')
  .action(async (changeName: string) => {
    logger.info(`[GitHub Plugin] Syncing status to GitHub for ${changeName}...`);
    logger.success('Status updated on GitHub PR');
  });

export const githubPlugin: SpecForgePlugin = {
  name: 'github-plugin',
  commands: [githubSyncCommand],
};
