import { Command } from 'commander';
import { findProjectRoot, resolveSpecforgePath } from '../../utils/path-utils.js';
import { logger } from '../../utils/logger.js';
import { loadChangeMetadata } from '../../core/change.js';
import { fetchAsanaTask } from '../../core/integrations/asana.js';
import { CHANGES_DIR } from '../../utils/constants.js';
import { writeTextFile, readTextFile } from '../../utils/file-system.js';
import { join } from 'node:path';
import * as dotenv from 'dotenv';
import ora from 'ora';

dotenv.config();

export const syncCommand = new Command('sync')
  .description('Sync external systems (Asana, GitHub)')
  
syncCommand.command('asana')
  .description('Sync a change with its linked Asana task')
  .argument('<change>', 'Name of the change to sync')
  .action(async (changeName: string) => {
    let spinner;
    try {
      const projectRoot = await findProjectRoot();
      if (!projectRoot) {
        logger.error('Not inside a SpecForge project.');
        process.exitCode = 1;
        return;
      }

      const changeDir = resolveSpecforgePath(projectRoot, CHANGES_DIR, changeName);
      const metadata = await loadChangeMetadata(changeDir);
      
      if (!metadata) {
        logger.error(`Change "${changeName}" not found.`);
        process.exitCode = 1;
        return;
      }

      const asanaTag = metadata.tags?.find(tag => tag.startsWith('asana-'));
      if (!asanaTag) {
        logger.error(`Change "${changeName}" is not linked to an Asana task. No "asana-X" tag found in metadata.`);
        process.exitCode = 1;
        return;
      }

      const taskId = asanaTag.replace('asana-', '');
      const token = process.env.ASANA_ACCESS_TOKEN;
      if (!token) {
        throw new Error('ASANA_ACCESS_TOKEN is not set in environment variables');
      }

      spinner = ora(`Fetching updates from Asana task ${taskId}...`).start();
      const task = await fetchAsanaTask(taskId, token);
      
      const assigneeInfo = task.assignee ? `Asignado a: ${task.assignee.name}` : 'Sin asignar';
      const proposalContent = `# Proposal: ${task.name}
    
## Context
Asana Ticket: [${task.id}](${task.permalink_url})
${assigneeInfo}

## Value Proposition
${task.notes || 'TODO: Justify the business value.'}

## Target Architecture
TODO: Describe high-level approach.
`;

      const proposalPath = join(changeDir, 'proposal.md');
      
      // Let's check if the user already modified the proposal heavily. 
      // For now, we will do a basic merge by appending or just overwriting the context.
      const currentProposal = await readTextFile(proposalPath);
      
      // If it exists, we replace the Context section
      if (currentProposal) {
        const updatedProposal = currentProposal.replace(
          /## Context[\s\S]*?(?=## Value Proposition|$)/m, 
          `## Context\nAsana Ticket: [${task.id}](${task.permalink_url})\n${assigneeInfo}\n\n`
        );
        await writeTextFile(proposalPath, updatedProposal);
      } else {
        await writeTextFile(proposalPath, proposalContent);
      }

      spinner.succeed(`Successfully synced with Asana task: ${task.name}`);
      logger.info(`Updated context in ${proposalPath}`);

    } catch (error) {
      if (spinner) spinner.fail('Sync failed');
      logger.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  });

syncCommand.command('github')
  .description('Export current status to a GitHub issue or PR')
  .argument('<change>', 'Name of the change')
  .action(async (changeName: string) => {
    // To be implemented. Example: post a comment with the current completion percentage
    logger.info(`GitHub sync for ${changeName} will post status updates to the PR...`);
  });
