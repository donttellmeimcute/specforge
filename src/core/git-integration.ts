/**
 * Git integration for SpecForge.
 * Provides auto-commit, auto-branch, and conventional commit support.
 * Uses simple-git when available, gracefully degrades otherwise.
 */

import { join } from 'node:path';
import { pathExists } from '../utils/file-system.js';

export interface GitIntegration {
  /** Check if we're inside a git repository */
  isRepo(): Promise<boolean>;
  /** Get current branch name */
  currentBranch(): Promise<string>;
  /** Create and switch to a new branch */
  createBranch(name: string): Promise<void>;
  /** Stage files and commit */
  commit(message: string, files?: string[]): Promise<void>;
  /** Get list of changed files */
  status(): Promise<GitFileStatus[]>;
}

export interface GitFileStatus {
  path: string;
  status: 'new' | 'modified' | 'deleted' | 'renamed';
}

/**
 * Create a git integration instance.
 * Dynamically imports simple-git if available.
 */
export async function createGitIntegration(
  cwd: string,
): Promise<GitIntegration | null> {
  // Check if .git exists
  const gitDir = join(cwd, '.git');
  if (!(await pathExists(gitDir))) {
    return null;
  }

  try {
    const { simpleGit } = await import('simple-git');
    const git = simpleGit(cwd);

    return {
      async isRepo(): Promise<boolean> {
        return git.checkIsRepo();
      },

      async currentBranch(): Promise<string> {
        const branch = await git.branchLocal();
        return branch.current;
      },

      async createBranch(name: string): Promise<void> {
        await git.checkoutLocalBranch(name);
      },

      async commit(message: string, files?: string[]): Promise<void> {
        if (files && files.length > 0) {
          await git.add(files);
        } else {
          await git.add('.');
        }
        await git.commit(message);
      },

      async status(): Promise<GitFileStatus[]> {
        const result = await git.status();
        const statuses: GitFileStatus[] = [];

        for (const f of result.not_added) {
          statuses.push({ path: f, status: 'new' });
        }
        for (const f of result.modified) {
          statuses.push({ path: f, status: 'modified' });
        }
        for (const f of result.deleted) {
          statuses.push({ path: f, status: 'deleted' });
        }
        for (const f of result.renamed) {
          statuses.push({ path: f.to, status: 'renamed' });
        }
        for (const f of result.created) {
          statuses.push({ path: f, status: 'new' });
        }

        return statuses;
      },
    };
  } catch {
    // simple-git not installed
    return null;
  }
}

/**
 * Generate a conventional commit message for a SpecForge operation.
 */
export function conventionalCommit(
  type: 'feat' | 'chore' | 'docs' | 'fix',
  scope: string,
  description: string,
): string {
  return `${type}(${scope}): ${description}`;
}

/**
 * Generate a branch name for a change.
 */
export function changeBranchName(changeName: string): string {
  return `specforge/${changeName}`;
}
