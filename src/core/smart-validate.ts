import { ArtifactGraph } from './artifact-graph/graph.js';
import { readTextFile } from '../utils/file-system.js';
import { join } from 'node:path';

export interface ValidationResult {
  score: number; // 0-100
  issues: ValidationIssue[];
  /** Actionable instructions for an AI agent to self-heal the project (present when score < 90). */
  selfHealingInstructions?: string[];
}

export interface ValidationIssue {
  level: 'error' | 'warning' | 'info';
  artifact: string;
  message: string;
  suggestion?: string;
}

/**
 * Perform deep validation on a change's artifacts:
 * - Completeness: Check that completed artifacts have non-trivial content
 * - Consistency: Cross-reference dependencies for keyword alignment
 * - Ordering: Warn about out-of-order work (diverged / needs-sync)
 */
export async function deepValidate(
  graph: ArtifactGraph,
  changeDir: string,
): Promise<ValidationResult> {
  const issues: ValidationIssue[] = [];
  const nodes = graph.getAllNodes();
  const sorted = graph.topologicalSort();

  let completedCount = 0;

  for (const id of sorted) {
    const node = graph.getNode(id);
    if (!node) continue;

    // Check completeness of completed (and needs-sync) artifacts
    if (node.status === 'completed' || node.status === 'needs-sync') {
      completedCount++;

      for (const file of node.matchedFiles) {
        const content = await readTextFile(join(changeDir, file));
        if (!content || content.trim().length < 50) {
          issues.push({
            level: 'warning',
            artifact: id,
            message: `File "${file}" appears to be a stub (less than 50 characters)`,
            suggestion: 'Ensure the artifact has meaningful content before proceeding.',
          });
        }
      }

      // Check that dependencies were completed before this artifact
      const deps = graph.getDependencies(id);
      for (const depId of deps) {
        const depNode = graph.getNode(depId);
        if (depNode && depNode.status !== 'completed' && depNode.status !== 'needs-sync') {
          issues.push({
            level: 'error',
            artifact: id,
            message: `Marked as completed but dependency "${depId}" is not completed`,
            suggestion: `Complete "${depId}" first, or verify that files match the expected pattern.`,
          });
        }
      }
    }

    // Warn about diverged artifacts (out-of-order editing)
    if (node.status === 'diverged') {
      const incompleteDeps = graph
        .getDependencies(id)
        .filter((depId) => {
          const s = graph.getNode(depId)?.status;
          return s !== 'completed' && s !== 'needs-sync' && s !== 'diverged';
        });
      issues.push({
        level: 'warning',
        artifact: id,
        message: `Edited out of order — dependency artifact(s) not yet completed: ${incompleteDeps.join(', ')}`,
        suggestion: `Complete ${incompleteDeps.map((d) => `"${d}"`).join(', ')} to restore consistency.`,
      });
      // Count diverged files toward partial score
      completedCount += 0.5;
    }

    // Warn about needs-sync artifacts (dependency was updated after this artifact)
    if (node.status === 'needs-sync') {
      issues.push({
        level: 'warning',
        artifact: id,
        message: `Content may be out of date — one or more dependency artifacts were modified more recently`,
        suggestion: `Review and update "${id}" to reflect changes in its dependencies.`,
      });
    }

    // Warn about ready artifacts that have files but aren't fully matching
    if (node.status === 'ready' && node.matchedFiles.length > 0) {
      issues.push({
        level: 'info',
        artifact: id,
        message: `Has ${node.matchedFiles.length} file(s) but still marked as "ready" — may be in progress`,
      });
    }
  }

  // Check for orphaned spec files not matching any artifact pattern
  // (covered by the existing validate command)

  // Compute score
  const totalArtifacts = nodes.length;
  const baseScore = totalArtifacts > 0 ? (completedCount / totalArtifacts) * 100 : 0;
  const errorPenalty = issues.filter((i) => i.level === 'error').length * 15;
  const warningPenalty = issues.filter((i) => i.level === 'warning').length * 5;
  const score = Math.max(0, Math.min(100, Math.round(baseScore - errorPenalty - warningPenalty)));

  const result: ValidationResult = { score, issues };

  // Generate self-healing instructions when score is below the 90-point threshold
  if (score < 90) {
    result.selfHealingInstructions = generateSelfHealingInstructions(score, issues, graph);
  }

  return result;
}

/**
 * Cross-reference content between dependent artifacts to check keyword consistency.
 */
export async function checkConsistency(
  graph: ArtifactGraph,
  changeDir: string,
): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];
  const sorted = graph.topologicalSort();

  for (const id of sorted) {
    const node = graph.getNode(id);
    if (!node || node.status !== 'completed') continue;

    const deps = graph.getDependencies(id);
    if (deps.length === 0) continue;

    // collect keywords from dependencies
    const depKeywords = new Set<string>();
    for (const depId of deps) {
      const depNode = graph.getNode(depId);
      if (!depNode) continue;
      for (const file of depNode.matchedFiles) {
        const content = await readTextFile(join(changeDir, file));
        if (content) {
          extractKeywords(content).forEach((kw) => depKeywords.add(kw));
        }
      }
    }

    if (depKeywords.size === 0) continue;

    // Check this artifact references at least some of its dependency keywords
    const artifactKeywords = new Set<string>();
    for (const file of node.matchedFiles) {
      const content = await readTextFile(join(changeDir, file));
      if (content) {
        extractKeywords(content).forEach((kw) => artifactKeywords.add(kw));
      }
    }

    const overlap = [...depKeywords].filter((kw) => artifactKeywords.has(kw));
    const overlapRatio = depKeywords.size > 0 ? overlap.length / depKeywords.size : 1;

    if (overlapRatio < 0.1 && depKeywords.size > 3) {
      issues.push({
        level: 'warning',
        artifact: id,
        message: `Low keyword overlap with dependencies (${Math.round(overlapRatio * 100)}%)`,
        suggestion:
          'The artifact may not be referencing concepts from its dependencies. Verify alignment.',
      });
    }
  }

  return issues;
}

/**
 * Extract notable keywords from markdown content.
 * Returns lowercase words that appear to be domain terms (3+ chars, not stop words).
 */
function extractKeywords(content: string): string[] {
  const stopWords = new Set([
    'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had',
    'her', 'was', 'one', 'our', 'out', 'has', 'have', 'from', 'they',
    'been', 'said', 'each', 'which', 'their', 'will', 'other', 'about',
    'many', 'then', 'them', 'these', 'some', 'would', 'make', 'like',
    'into', 'could', 'time', 'very', 'when', 'come', 'that', 'with',
    'this', 'what', 'also', 'more', 'should', 'must', 'shall', 'todo',
  ]);

  const words = content
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !stopWords.has(w));

  // Deduplicate and return
  return [...new Set(words)];
}

/**
 * Generate actionable self-healing instructions for an AI agent based on validation results.
 * These are optimised for consumption by an LLM: plain language, no ANSI decoration.
 */
export function generateSelfHealingInstructions(
  score: number,
  issues: ValidationIssue[],
  graph: ArtifactGraph,
): string[] {
  const instructions: string[] = [];

  instructions.push(
    `Current score is ${score}/100 (threshold: 90). Apply the following fixes and re-run ` +
      '`specforge validate --deep --json` until the score reaches 90 or above.',
  );

  // 1. Errors first (highest impact)
  const errors = issues.filter((i) => i.level === 'error');
  if (errors.length > 0) {
    instructions.push('--- Errors to fix (each costs 15 points) ---');
    for (const err of errors) {
      const base = `[${err.artifact}] ${err.message}`;
      instructions.push(err.suggestion ? `${base} → ${err.suggestion}` : base);
    }
  }

  // 2. Warnings (medium impact)
  const warnings = issues.filter((i) => i.level === 'warning');
  if (warnings.length > 0) {
    instructions.push('--- Warnings to address (each costs 5 points) ---');
    for (const warn of warnings) {
      const base = `[${warn.artifact}] ${warn.message}`;
      instructions.push(warn.suggestion ? `${base} → ${warn.suggestion}` : base);
    }
  }

  // 3. Incomplete artifacts (score boost)
  const incomplete = graph
    .getAllNodes()
    .filter((n) => n.status === 'pending' || n.status === 'ready');
  if (incomplete.length > 0) {
    instructions.push('--- Artifacts not yet started (completing them raises the score) ---');
    for (const node of incomplete) {
      instructions.push(
        `[${node.definition.id}] Status: ${node.status}. ` +
          `Run \`specforge instructions <change> ${node.definition.id}\` to get the AI prompt.`,
      );
    }
  }

  // 4. Diverged / needs-sync artifacts
  const driftedNodes = graph
    .getAllNodes()
    .filter((n) => n.status === 'diverged' || n.status === 'needs-sync');
  if (driftedNodes.length > 0) {
    instructions.push('--- Consistency drift to resolve ---');
    for (const node of driftedNodes) {
      if (node.status === 'diverged') {
        const missingDeps = graph
          .getDependencies(node.definition.id)
          .filter((depId) => {
            const s = graph.getNode(depId)?.status;
            return s !== 'completed' && s !== 'needs-sync' && s !== 'diverged';
          });
        instructions.push(
          `[${node.definition.id}] Diverged — create/complete: ${missingDeps.join(', ')}`,
        );
      } else {
        instructions.push(
          `[${node.definition.id}] Needs sync — review and update to reflect changes in dependencies.`,
        );
      }
    }
  }

  return instructions;
}
