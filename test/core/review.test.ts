import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { initProject } from '../../src/core/init.js';
import { createChange } from '../../src/core/change.js';
import {
  loadReviewState,
  requestReview,
  addComment,
  approveChange,
  requestChanges,
} from '../../src/core/review.js';
import { resolveSpecforgePath } from '../../src/utils/path-utils.js';
import { CHANGES_DIR } from '../../src/utils/constants.js';

describe('review', () => {
  let tempDir: string;
  let changeDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'specforge-review-'));
    await initProject(tempDir);
    await createChange(tempDir, 'feature-x');
    changeDir = resolveSpecforgePath(tempDir, CHANGES_DIR, 'feature-x');
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should return default draft state when no review exists', async () => {
    const state = await loadReviewState(changeDir);
    expect(state.status).toBe('draft');
    expect(state.reviewers).toEqual([]);
    expect(state.comments).toEqual([]);
  });

  it('should request a review', async () => {
    const state = await requestReview(changeDir, ['alice', 'bob']);
    expect(state.status).toBe('in-review');
    expect(state.reviewers).toContain('alice');
    expect(state.reviewers).toContain('bob');
    expect(state.requestedAt).toBeDefined();
  });

  it('should add a comment', async () => {
    const comment = await addComment(changeDir, 'alice', 'proposal', 'Looks good!');
    expect(comment.author).toBe('alice');
    expect(comment.artifact).toBe('proposal');
    expect(comment.message).toBe('Looks good!');
    expect(comment.resolved).toBe(false);

    const state = await loadReviewState(changeDir);
    expect(state.comments).toHaveLength(1);
  });

  it('should approve and auto-complete when all reviewers approve', async () => {
    await requestReview(changeDir, ['alice', 'bob']);
    await approveChange(changeDir, 'alice');
    let state = await loadReviewState(changeDir);
    expect(state.status).toBe('in-review');

    state = await approveChange(changeDir, 'bob');
    expect(state.status).toBe('approved');
    expect(state.approvedAt).toBeDefined();
  });

  it('should handle request-changes', async () => {
    await requestReview(changeDir, ['alice']);
    await approveChange(changeDir, 'alice');
    const state = await requestChanges(changeDir, 'alice', 'Needs more detail');
    expect(state.status).toBe('changes-requested');
    expect(state.approvedBy).not.toContain('alice');
    expect(state.comments.some((c) => c.message === 'Needs more detail')).toBe(true);
  });
});
