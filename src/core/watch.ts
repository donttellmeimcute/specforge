/**
 * Watch mode — monitors the change directory for file changes
 * and automatically updates artifact states.
 */

import { watch } from 'node:fs';
import { logger } from '../utils/logger.js';
import { resolveSchema } from './artifact-graph/resolver.js';
import { ArtifactGraph } from './artifact-graph/graph.js';
import { detectArtifactStates } from './artifact-graph/state.js';
import { loadProjectConfig } from './project-config.js';
import { loadGlobalConfig } from './global-config.js';
import { createAIProvider } from './ai-provider.js';
import { loadChangeMetadata } from './change.js';
import { resolveSpecforgePath } from '../utils/path-utils.js';
import { CHANGES_DIR } from '../utils/constants.js';
import { deepValidate } from './smart-validate.js';

export interface WatchOptions {
  onChange?: (graph: ArtifactGraph) => void;
  debounceMs?: number;
  autoFix?: boolean;
}

/**
 * Start watching a change directory for file modifications.
 * Returns an AbortController to stop watching.
 */
export async function watchChange(
  projectRoot: string,
  changeName: string,
  options: WatchOptions = {},
): Promise<AbortController> {
  const changeDir = resolveSpecforgePath(projectRoot, CHANGES_DIR, changeName);
  const metadata = await loadChangeMetadata(changeDir);
  if (!metadata) {
    throw new Error(`Change "${changeName}" not found.`);
  }

  const config = await loadProjectConfig(projectRoot);
  const schemaName = metadata.schema ?? config.schema;
  const schema = await resolveSchema(schemaName, projectRoot);

  const debounceMs = options.debounceMs ?? 500;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let isProcessingAutoFix = false;

  const controller = new AbortController();

  const refresh = async () => {
    try {
      const graph = new ArtifactGraph(schema);
      await detectArtifactStates(graph, changeDir);
      options.onChange?.(graph);

      const summary = graph.getSummary();
      logger.info(
        `[watch] ${summary.completed.length}/${graph.getAllNodes().length} artifacts completed`,
      );

      if (options.autoFix && !isProcessingAutoFix) {
        isProcessingAutoFix = true;
        try {
          logger.info('[watch] Running deep validation...');
          const validationResult = await deepValidate(projectRoot, changeName);
          
          if (validationResult.issues.length > 0) {
            const warningsAndErrors = validationResult.issues.filter(i => i.level === 'error' || i.level === 'warning');
            
            if (warningsAndErrors.length > 0) {
              logger.warn(`[watch] Found ${warningsAndErrors.length} issues. Triggering auto-fix...`);
              
              const globalConfig = await loadGlobalConfig();
              if (globalConfig.ai) {
                const aiProvider = await createAIProvider({
                  provider: globalConfig.ai.provider || 'openai',
                  model: globalConfig.ai.model,
                  apiKey: globalConfig.ai.apiKey,
                  baseUrl: globalConfig.ai.baseUrl
                });
                
                // Construct a prompt with the issues and ask AI to fix them
                const prompt = `You are an expert AI resolving specification issues for a SpecForge project.
The following issues were found in the current state of the artifacts:

${warningsAndErrors.map(i => `- [${i.level.toUpperCase()}] ${i.artifact || 'general'}: ${i.message}`).join('\n')}

Based on the rules of SpecForge, suggest the precise Markdown content to fix the most critical artifact. 
Output ONLY a JSON block like:
{
  "artifactToFix": "artifact_id",
  "reasoning": "short explanation",
  "newContent": "complete new markdown content"
}`;
                
                const response = await aiProvider.generate(prompt);
                // Attempt to parse the JSON and write it
                try {
                  const jsonStr = response.replace(/```json\n?|\n?```/g, '').trim();
                  const fixData = JSON.parse(jsonStr);
                  if (fixData.artifactToFix && fixData.newContent) {
                    const node = graph.getNode(fixData.artifactToFix);
                    if (node && node.matchedFiles && node.matchedFiles.length > 0) {
                      const fileToUpdate = node.matchedFiles[0];
                      if (fileToUpdate) {
                        const { join } = await import('node:path');
                        const { writeTextFile } = await import('../utils/file-system.js');
                        await writeTextFile(join(changeDir, fileToUpdate), fixData.newContent);
                        logger.success(`[watch] Auto-fix applied to ${fileToUpdate}: ${fixData.reasoning}`);
                      } else {
                        logger.info(`[watch] AI suggested fix for ${fixData.artifactToFix} but matchedFiles was empty.`);
                      }
                    } else {
                      logger.info(`[watch] AI suggested fix for ${fixData.artifactToFix} but no matched files found.`);
                    }
                  }
                } catch (parseErr) {
                  logger.warn('[watch] AI did not return a valid fix format.');
                }
              } else {
                logger.warn('[watch] Cannot auto-fix: AI is not configured in global config.');
              }
            }
          } else {
            logger.success('[watch] Deep validation passed. Code is compliant.');
          }
        } catch (autoFixErr) {
           logger.error(`[watch] Auto-fix error: ${autoFixErr instanceof Error ? autoFixErr.message : String(autoFixErr)}`);
        } finally {
           isProcessingAutoFix = false;
        }
      }

      if (graph.isComplete()) {
        logger.success('[watch] All artifacts completed!');
      }
    } catch (error) {
      logger.warn(
        `[watch] Error refreshing state: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  // Initial state
  await refresh();

  // Watch for changes
  const watcher = watch(
    changeDir,
    { recursive: true, signal: controller.signal },
    (_eventType, filename) => {
      if (!filename) return;
      // Skip metadata and hidden files
      if (filename.startsWith('.') || filename === '.metadata.yaml') return;

      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        logger.info(`[watch] File changed: ${filename}`);
        refresh().catch(() => {});
      }, debounceMs);
    },
  );

  watcher.on('error', (error) => {
    if ((error as NodeJS.ErrnoException).code === 'ABORT_ERR') return;
    logger.warn(`[watch] Watcher error: ${error.message}`);
  });

  return controller;
}

/**
 * CLI-oriented watch that prints status updates to the console.
 */
export async function watchChangeCli(
  projectRoot: string,
  changeName: string,
  options: WatchOptions = {},
): Promise<AbortController> {
  return watchChange(projectRoot, changeName, {
    autoFix: options.autoFix,
    onChange: (graph) => {
      const nodes = graph.getAllNodes();
      for (const node of nodes) {
        const icon =
          node.status === 'completed'
            ? '✅'
            : node.status === 'ready'
              ? '🔵'
              : node.status === 'in-progress'
                ? '🟡'
                : '⚪';
        logger.info(`  ${icon} ${node.definition.id}: ${node.status}`);
      }
    },
  });
}
