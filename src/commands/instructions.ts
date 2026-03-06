import { Command } from 'commander';
import { findProjectRoot, resolveSpecforgePath } from '../utils/path-utils.js';
import { logger } from '../utils/logger.js';
import { loadProjectConfig } from '../core/project-config.js';
import { resolveSchema } from '../core/artifact-graph/resolver.js';
import { ArtifactGraph } from '../core/artifact-graph/graph.js';
import { detectArtifactStates } from '../core/artifact-graph/state.js';
import { loadInstructions } from '../core/artifact-graph/instruction-loader.js';
import { loadChangeMetadata } from '../core/change.js';
import { CHANGES_DIR } from '../utils/constants.js';

export const instructionsCommand = new Command('instructions')
  .description('Generate enriched instructions for an AI assistant')
  .argument('<change>', 'Name of the change')
  .argument('[artifact]', 'Specific artifact (auto-detects next if omitted)')
  .option('--json', 'Output as JSON')
  .action(
    async (
      changeName: string,
      artifactId: string | undefined,
      options: { json?: boolean },
    ) => {
      try {
        const projectRoot = await findProjectRoot();
        if (!projectRoot) {
          logger.error(
            'Not inside a SpecForge project. Run `specforge init` first.',
          );
          process.exitCode = 1;
          return;
        }

        const changeDir = resolveSpecforgePath(
          projectRoot,
          CHANGES_DIR,
          changeName,
        );

        const metadata = await loadChangeMetadata(changeDir);
        if (!metadata) {
          logger.error(`Change "${changeName}" not found.`);
          process.exitCode = 1;
          return;
        }

        const config = await loadProjectConfig(projectRoot);
        const schemaName = metadata.schema ?? config.schema;
        const schema = await resolveSchema(schemaName, projectRoot);

        const graph = new ArtifactGraph(schema);
        await detectArtifactStates(graph, changeDir);

        // Auto-detect artifact if not specified
        let targetId = artifactId;
        if (!targetId) {
          const next = graph.getNextArtifacts();
          if (next.length === 0) {
            logger.error('All artifacts are already completed.');
            process.exitCode = 1;
            return;
          }
          targetId = next[0]!.definition.id;
          logger.info(`Auto-selected artifact: ${targetId}`);
        }

        const instructions = await loadInstructions(
          graph,
          targetId,
          changeDir,
          projectRoot,
          config.context,
          config.rules,
        );

        if (options.json) {
          logger.out(
            JSON.stringify({ change: changeName, artifact: targetId, instructions }, null, 2),
          );
        } else {
          logger.out(instructions);
        }
      } catch (error) {
        logger.error(
          error instanceof Error ? error.message : String(error),
        );
        process.exitCode = 1;
      }
    },
  );
