import { Command } from 'commander';
import { SpecForgePlugin, HookContext } from '../../core/plugins.js';
import { fetchAsanaTask } from './api.js';
import { logger } from '../../utils/logger.js';
import { resolveSpecforgePath } from '../../utils/path-utils.js';
import { loadChangeMetadata } from '../../core/change.js';
import { readTextFile, writeTextFile } from '../../utils/file-system.js';
import { CHANGES_DIR } from '../../utils/constants.js';
import { join } from 'node:path';
import { spinner as clackSpinner } from '@clack/prompts';
import * as dotenv from 'dotenv';

dotenv.config();

import { createGitIntegration } from '../../core/git-integration.js';
import { updateChangeMetadata } from '../../core/change.js';

const asanaSyncCommand = new Command('asana')
  .description('Sync a change with its linked Asana task')
  .argument('<change>', 'Name of the change to sync')
  .action(async (changeName: string) => {
    const s = clackSpinner();
    try {
      const projectRoot = process.cwd(); // Assume cwd is project root for this basic plugin command
      const changeDir = resolveSpecforgePath(projectRoot, CHANGES_DIR, changeName);
      const metadata = await loadChangeMetadata(changeDir);

      if (!metadata) {
        logger.error(`Change "${changeName}" not found.`);
        process.exitCode = 1;
        return;
      }

      const asanaTag = metadata.tags?.find((tag) => tag.startsWith('asana-'));
      if (!asanaTag) {
        logger.error(
          `Change "${changeName}" is not linked to an Asana task. No "asana-X" tag found in metadata.`,
        );
        process.exitCode = 1;
        return;
      }

      const taskId = asanaTag.replace('asana-', '');
      const token = process.env.ASANA_ACCESS_TOKEN;
      if (!token) {
        throw new Error('ASANA_ACCESS_TOKEN is not set in environment variables');
      }

      s.start(`Fetching updates from Asana task ${taskId}...`);
      const task = await fetchAsanaTask(taskId, token);

      const assigneeInfo = task.assignee
        ? `Asignado a: ${task.assignee.name}`
        : 'Sin asignar';
      const proposalContent = `# Proposal: ${task.name}\n    \n## Context\nAsana Ticket: [${task.id}](${task.permalink_url})\n${assigneeInfo}\n\n## Value Proposition\n${task.notes || 'TODO: Justify the business value.'}\n\n## Target Architecture\nTODO: Describe high-level approach.\n`;

      const proposalPath = join(changeDir, 'proposal.md');

      const currentProposal = await readTextFile(proposalPath);

      if (currentProposal) {
        const updatedProposal = currentProposal.replace(
          /## Context[\s\S]*?(?=## Value Proposition|$)/m,
          `## Context\nAsana Ticket: [${task.id}](${task.permalink_url})\n${assigneeInfo}\n\n`,
        );
        await writeTextFile(proposalPath, updatedProposal);
      } else {
        await writeTextFile(proposalPath, proposalContent);
      }

      s.stop(`Successfully synced with Asana task: ${task.name}`);
      logger.info(`Updated context in ${proposalPath}`);
    } catch (error) {
      s.stop('Sync failed');
      logger.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  });

export const asanaPlugin: SpecForgePlugin = {
  name: 'asana-plugin',
  commands: [asanaSyncCommand],
  hooks: {
    afterCreateChange: async (ctx: HookContext) => {
      const changeDir = ctx.changeDir;
      const changeName = ctx.changeName;
      if (ctx.options?.asana && changeName && changeDir) {
        const token = process.env.ASANA_ACCESS_TOKEN;
        if (!token) {
          logger.warn(
            'ASANA_ACCESS_TOKEN is not set in environment variables. Could not auto-fetch Asana task.',
          );
          return;
        }

        const taskId = ctx.options.asana;
        logger.info(`Fetching Asana task ${taskId}...`);
        try {
          const task = await fetchAsanaTask(taskId, token);
          logger.success(`Fetched Asana task: ${task.name}`);

          // Auto-tag with asana task ID
          const currentMetadata = await loadChangeMetadata(changeDir);
          const newTags = currentMetadata?.tags || [];
          newTags.push(`asana-${taskId}`);
          await updateChangeMetadata(changeDir, { tags: newTags });

          // Generate proposal.md
          const assigneeInfo = task.assignee
            ? `Asignado a: ${task.assignee.name}`
            : 'Sin asignar';
          const proposalContent = `# Proposal: ${task.name}\n    \n## Context\nAsana Ticket: [${task.id}](${task.permalink_url})\n${assigneeInfo}\n\n## Value Proposition\n${task.notes || 'TODO: Justify the business value.'}\n\n## Target Architecture\nTODO: Describe high-level approach.\n`;
          await writeTextFile(join(changeDir, 'proposal.md'), proposalContent);
          logger.success('Generated proposal.md from Asana task');

          // Auto-create branch
          const git = await createGitIntegration(ctx.projectRoot);
          if (git) {
            const branchName = `feat/asana-${taskId}-${changeName}`;
            logger.info(`Creating git branch: ${branchName}`);
            await git.createBranch(branchName);
            logger.success(`Switched to new branch: ${branchName}`);
          }
        } catch (error) {
          logger.warn(
            `Failed to fetch Asana task: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    },
  },
};
