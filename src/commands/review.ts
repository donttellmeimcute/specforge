import { Command } from 'commander';
import chalk from 'chalk';
import { findProjectRoot, resolveSpecforgePath } from '../utils/path-utils.js';
import { logger } from '../utils/logger.js';
import { CHANGES_DIR } from '../utils/constants.js';
import {
  loadReviewState,
  requestReview,
  addComment,
  approveChange,
  requestChanges,
} from '../core/review.js';

export const reviewCommand = new Command('review')
  .description('Manage change reviews')
  .argument('<change>', 'Name of the change');

reviewCommand
  .command('status')
  .description('Show review status')
  .action(async (_opts, cmd) => {
    try {
      const changeName = cmd.parent!.args[0]!;
      const projectRoot = await findProjectRoot();
      if (!projectRoot) {
        logger.error('Not inside a SpecForge project.');
        process.exitCode = 1;
        return;
      }

      const changeDir = resolveSpecforgePath(projectRoot, CHANGES_DIR, changeName);
      const state = await loadReviewState(changeDir);

      console.error('');
      console.error(chalk.bold(`  Review: ${changeName}`));
      console.error(`  Status: ${formatReviewStatus(state.status)}`);
      console.error(`  Reviewers: ${state.reviewers.join(', ') || 'none'}`);
      console.error(`  Approvals: ${state.approvedBy.length}/${state.reviewers.length}`);

      if (state.comments.length > 0) {
        console.error('');
        console.error(chalk.bold('  Comments:'));
        for (const c of state.comments) {
          const resolved = c.resolved ? chalk.green(' [resolved]') : '';
          console.error(
            `  ${chalk.dim(c.timestamp.split('T')[0])} ${chalk.cyan(c.author)}${resolved}: ${c.message}`,
          );
        }
      }
      console.error('');
    } catch (error) {
      logger.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  });

reviewCommand
  .command('request')
  .description('Request a review from one or more reviewers')
  .requiredOption('-r, --reviewers <names...>', 'Reviewer names')
  .action(async (opts: { reviewers: string[] }, cmd) => {
    try {
      const changeName = cmd.parent!.parent!.args[0]!;
      const projectRoot = await findProjectRoot();
      if (!projectRoot) {
        logger.error('Not inside a SpecForge project.');
        process.exitCode = 1;
        return;
      }

      const changeDir = resolveSpecforgePath(projectRoot, CHANGES_DIR, changeName);
      await requestReview(changeDir, opts.reviewers);
      logger.success(`Review requested from: ${opts.reviewers.join(', ')}`);
    } catch (error) {
      logger.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  });

reviewCommand
  .command('comment')
  .description('Add a review comment')
  .requiredOption('-a, --author <name>', 'Comment author')
  .requiredOption('-m, --message <text>', 'Comment message')
  .option('--artifact <id>', 'Artifact the comment relates to', '*')
  .action(
    async (opts: { author: string; message: string; artifact: string }, cmd) => {
      try {
        const changeName = cmd.parent!.parent!.args[0]!;
        const projectRoot = await findProjectRoot();
        if (!projectRoot) {
          logger.error('Not inside a SpecForge project.');
          process.exitCode = 1;
          return;
        }

        const changeDir = resolveSpecforgePath(
          projectRoot,
          CHANGES_DIR,
          changeName,
        );
        await addComment(changeDir, opts.author, opts.artifact, opts.message);
        logger.success('Comment added.');
      } catch (error) {
        logger.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
      }
    },
  );

reviewCommand
  .command('approve')
  .description('Approve a change')
  .requiredOption('-a, --approver <name>', 'Approver name')
  .action(async (opts: { approver: string }, cmd) => {
    try {
      const changeName = cmd.parent!.parent!.args[0]!;
      const projectRoot = await findProjectRoot();
      if (!projectRoot) {
        logger.error('Not inside a SpecForge project.');
        process.exitCode = 1;
        return;
      }

      const changeDir = resolveSpecforgePath(projectRoot, CHANGES_DIR, changeName);
      const state = await approveChange(changeDir, opts.approver);
      logger.success(
        state.status === 'approved'
          ? 'Change approved by all reviewers!'
          : `Approval recorded. ${state.approvedBy.length}/${state.reviewers.length} approvals.`,
      );
    } catch (error) {
      logger.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  });

reviewCommand
  .command('request-changes')
  .description('Request changes on a review')
  .requiredOption('-r, --reviewer <name>', 'Reviewer requesting changes')
  .requiredOption('-m, --message <text>', 'Reason for requesting changes')
  .action(async (opts: { reviewer: string; message: string }, cmd) => {
    try {
      const changeName = cmd.parent!.parent!.args[0]!;
      const projectRoot = await findProjectRoot();
      if (!projectRoot) {
        logger.error('Not inside a SpecForge project.');
        process.exitCode = 1;
        return;
      }

      const changeDir = resolveSpecforgePath(projectRoot, CHANGES_DIR, changeName);
      await requestChanges(changeDir, opts.reviewer, opts.message);
      logger.success('Changes requested.');
    } catch (error) {
      logger.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  });

function formatReviewStatus(status: string): string {
  switch (status) {
    case 'draft':
      return chalk.dim('Draft');
    case 'in-review':
      return chalk.blue('In Review');
    case 'approved':
      return chalk.green('Approved');
    case 'changes-requested':
      return chalk.yellow('Changes Requested');
    default:
      return status;
  }
}
