/**
 * SpecForge — Spec-Driven Development Framework
 * Public API exports
 */
export { SPECFORGE_DIR, CONFIG_FILE } from './utils/constants.js';
export { logger } from './utils/logger.js';
export { findProjectRoot, resolveSpecforgePath } from './utils/path-utils.js';
export { ArtifactGraph } from './core/artifact-graph/graph.js';
export { resolveSchema } from './core/artifact-graph/resolver.js';
export { detectArtifactStates } from './core/artifact-graph/state.js';
export { loadInstructions } from './core/artifact-graph/instruction-loader.js';
export { initProject } from './core/init.js';
export { createChange, loadChangeMetadata, updateChangeMetadata } from './core/change.js';
export { loadProjectConfig, saveProjectConfig } from './core/project-config.js';
export { loadGlobalConfig, saveGlobalConfig } from './core/global-config.js';
export { PluginManager } from './core/plugins.js';
export { createAIProvider } from './core/ai-provider.js';
export { diffSpecs, mergeSpecs } from './core/diff-merge.js';
export { detectConflicts } from './core/conflicts.js';
export {
  generateReport,
  reportToJson,
  reportToHtml,
  reportToMarkdown,
} from './core/export.js';
export {
  deepValidate,
  checkConsistency,
  generateSelfHealingInstructions,
} from './core/smart-validate.js';
export { generateAgentContext } from './core/agent-context.js';
export {
  createGitIntegration,
  conventionalCommit,
  changeBranchName,
} from './core/git-integration.js';
export { watchChange } from './core/watch.js';
export {
  loadReviewState,
  requestReview,
  addComment,
  approveChange,
  requestChanges,
} from './core/review.js';
