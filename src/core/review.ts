/**
 * Collaborative features — review workflow, comments, and approval states.
 */

import { join } from 'node:path';
import { stringify as stringifyYaml, parse as parseYaml } from 'yaml';
import { readTextFile, writeTextFile } from '../utils/file-system.js';

export type ReviewStatus = 'draft' | 'in-review' | 'approved' | 'changes-requested';

export interface ReviewComment {
  author: string;
  artifact: string;
  timestamp: string;
  message: string;
  resolved: boolean;
}

export interface ReviewState {
  status: ReviewStatus;
  reviewers: string[];
  comments: ReviewComment[];
  approvedBy: string[];
  requestedAt?: string;
  approvedAt?: string;
}

const REVIEW_FILE = '.review.yaml';

/**
 * Load review state for a change. Returns defaults if none exists.
 */
export async function loadReviewState(changeDir: string): Promise<ReviewState> {
  const filePath = join(changeDir, REVIEW_FILE);
  const content = await readTextFile(filePath);
  if (!content) {
    return {
      status: 'draft',
      reviewers: [],
      comments: [],
      approvedBy: [],
    };
  }

  try {
    return parseYaml(content) as ReviewState;
  } catch {
    return {
      status: 'draft',
      reviewers: [],
      comments: [],
      approvedBy: [],
    };
  }
}

/**
 * Save review state for a change.
 */
export async function saveReviewState(
  changeDir: string,
  state: ReviewState,
): Promise<void> {
  const filePath = join(changeDir, REVIEW_FILE);
  await writeTextFile(filePath, stringifyYaml(state, { lineWidth: 100 }));
}

/**
 * Request a review for a change.
 */
export async function requestReview(
  changeDir: string,
  reviewers: string[],
): Promise<ReviewState> {
  const state = await loadReviewState(changeDir);
  state.status = 'in-review';
  state.reviewers = [...new Set([...state.reviewers, ...reviewers])];
  state.requestedAt = new Date().toISOString();
  await saveReviewState(changeDir, state);
  return state;
}

/**
 * Add a comment to a change's review.
 */
export async function addComment(
  changeDir: string,
  author: string,
  artifact: string,
  message: string,
): Promise<ReviewComment> {
  const state = await loadReviewState(changeDir);
  const comment: ReviewComment = {
    author,
    artifact,
    timestamp: new Date().toISOString(),
    message,
    resolved: false,
  };
  state.comments.push(comment);
  await saveReviewState(changeDir, state);
  return comment;
}

/**
 * Approve a change.
 */
export async function approveChange(
  changeDir: string,
  approver: string,
): Promise<ReviewState> {
  const state = await loadReviewState(changeDir);
  if (!state.approvedBy.includes(approver)) {
    state.approvedBy.push(approver);
  }

  // Auto-approve if all reviewers approved
  const allApproved = state.reviewers.every((r) =>
    state.approvedBy.includes(r),
  );
  if (allApproved && state.reviewers.length > 0) {
    state.status = 'approved';
    state.approvedAt = new Date().toISOString();
  }

  await saveReviewState(changeDir, state);
  return state;
}

/**
 * Request changes on a review.
 */
export async function requestChanges(
  changeDir: string,
  reviewer: string,
  message: string,
): Promise<ReviewState> {
  const state = await loadReviewState(changeDir);
  state.status = 'changes-requested';

  // Remove from approved list if previously approved
  state.approvedBy = state.approvedBy.filter((a) => a !== reviewer);

  // Add comment
  state.comments.push({
    author: reviewer,
    artifact: '*',
    timestamp: new Date().toISOString(),
    message,
    resolved: false,
  });

  await saveReviewState(changeDir, state);
  return state;
}
