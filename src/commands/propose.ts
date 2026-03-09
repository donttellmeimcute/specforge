import { Command } from 'commander';
import { join } from 'node:path';
import { findProjectRoot, resolveSpecforgePath } from '../utils/path-utils.js';
import { logger } from '../utils/logger.js';
import { writeTextFile, pathExists, readTextFile } from '../utils/file-system.js';
import { CHANGES_DIR } from '../utils/constants.js';
import { loadChangeMetadata } from '../core/change.js';
import { text, intro, outro } from '@clack/prompts';

export const proposeCommand = new Command('propose')
  .description('Write or update the proposal for a change directly from the CLI')
  .argument('<change>', 'Name of the change')
  .option('-m, --message <text>', 'The proposal content/message')
  .action(async (changeName: string, options: { message?: string }) => {
    try {
      const projectRoot = await findProjectRoot();
      if (!projectRoot) {
        logger.error('Not inside a SpecForge project. Run `specforge init` first.');
        process.exitCode = 1;
        return;
      }

      const changeDir = resolveSpecforgePath(projectRoot, CHANGES_DIR, changeName);
      
      if (!(await pathExists(changeDir))) {
        logger.error(`Change "${changeName}" does not exist. Run \`specforge new change ${changeName}\` first.`);
        process.exitCode = 1;
        return;
      }

      const metadata = await loadChangeMetadata(changeDir);
      if (!metadata) {
        logger.error(`Invalid change: missing metadata in ${changeDir}.`);
        process.exitCode = 1;
        return;
      }

      let proposalText = options.message;

      if (!proposalText) {
        intro(`SpecForge - Writing proposal for ${changeName}`);
        const inputMsg = await text({
          message: 'What do you want to build? (Describe your proposal):',
          validate: (value) => (value && value.trim().length > 0) ? undefined : 'Proposal cannot be empty'
        });
        
        if (typeof inputMsg === 'symbol') {
          return; // User cancelled
        }
        proposalText = inputMsg as string;
      }

      const proposalPath = join(changeDir, 'proposal.md');
      
      // Format nicely as markdown
      let finalContent = `# Proposal: ${changeName}\n\n`;
      
      const existingContent = await readTextFile(proposalPath);
      if (existingContent && existingContent.trim().length > 0) {
        // Append to existing proposal
        finalContent = existingContent + `\n\n## Update\n${proposalText}\n`;
      } else {
        // Fresh proposal
        finalContent += proposalText + '\n';
      }

      await writeTextFile(proposalPath, finalContent);
      
      if (!options.message) {
        outro(`Proposal saved to ${proposalPath}`);
      } else {
        logger.success(`Proposal saved to ${proposalPath}`);
      }

    } catch (error) {
      logger.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  });