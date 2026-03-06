import { describe, it, expect } from 'vitest';
import { conventionalCommit, changeBranchName } from '../../src/core/git-integration.js';

describe('git-integration', () => {
  it('should generate conventional commit messages', () => {
    const msg = conventionalCommit('feat', 'auth', 'add login flow');
    expect(msg).toBe('feat(auth): add login flow');
  });

  it('should generate branch names from change names', () => {
    expect(changeBranchName('add-auth')).toBe('specforge/add-auth');
    expect(changeBranchName('fix-bug')).toBe('specforge/fix-bug');
  });
});
