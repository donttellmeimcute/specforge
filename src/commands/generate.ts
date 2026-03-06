import { Command } from 'commander';
import { findProjectRoot, resolveSpecforgePath } from '../utils/path-utils.js';
import { logger } from '../utils/logger.js';
import { loadProjectConfig } from '../core/project-config.js';
import { loadGlobalConfig } from '../core/global-config.js';
import { resolveSchema } from '../core/artifact-graph/resolver.js';
import { ArtifactGraph } from '../core/artifact-graph/graph.js';
import { detectArtifactStates } from '../core/artifact-graph/state.js';
import { loadInstructions } from '../core/artifact-graph/instruction-loader.js';
import { loadChangeMetadata } from '../core/change.js';
import { createAIProvider } from '../core/ai-provider.js';
import { writeTextFile } from '../utils/file-system.js';
import { CHANGES_DIR } from '../utils/constants.js';
import { join } from 'node:path';

export const generateCommand = new Command('generate')
  .description('Generate an artifact using AI')
  .argument('<change>', 'Name of the change')
  .argument('[artifact]', 'Artifact to generate (auto-detects next if omitted)')
  .option('--provider <name>', 'AI provider (openai, anthropic, ollama)')
  .option('--model <name>', 'AI model to use')
  .option('--dry-run', 'Show the prompt without calling the AI')
  .option('--output <path>', 'Write output to a specific file instead of default')
  .action(
    async (
      changeName: string,
      artifactId: string | undefined,
      options: {
        provider?: string;
        model?: string;
        dryRun?: boolean;
        output?: string;
      },
    ) => {
      try {
        const projectRoot = await findProjectRoot();
        if (!projectRoot) {
          logger.error('Not inside a SpecForge project. Run `specforge init` first.');
          process.exitCode = 1;
          return;
        }

        const changeDir = resolveSpecforgePath(projectRoot, CHANGES_DIR, changeName);
        const metadata = await loadChangeMetadata(changeDir);
        if (!metadata) {
          logger.error(`Change "${changeName}" not found.`);
          process.exitCode = 1;
          return;
        }

        const config = await loadProjectConfig(projectRoot);
        const globalConfig = await loadGlobalConfig();
        const schemaName = metadata.schema ?? config.schema;
        const schema = await resolveSchema(schemaName, projectRoot);

        const graph = new ArtifactGraph(schema);
        await detectArtifactStates(graph, changeDir);

        // Auto-detect artifact
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

        // Generate instructions (prompt)
        const prompt = await loadInstructions(
          graph,
          targetId,
          changeDir,
          projectRoot,
          config.context,
          config.rules,
        );

        if (options.dryRun) {
          logger.out(prompt);
          return;
        }

        // Resolve AI config
        const providerName =
          (options.provider as 'openai' | 'anthropic' | 'ollama') ??
          globalConfig.ai?.provider;

        if (!providerName) {
          logger.error(
            'No AI provider configured. Use --provider flag or set in global config:\n' +
              '  specforge config set ai.provider openai',
          );
          process.exitCode = 1;
          return;
        }

        const provider = await createAIProvider({
          provider: providerName,
          model: options.model ?? globalConfig.ai?.model,
          apiKey: globalConfig.ai?.apiKey,
          baseUrl: globalConfig.ai?.baseUrl,
        });

        logger.info(`Generating "${targetId}" with ${provider.name}...`);

        const content = await provider.generate(prompt);

        // Write output
        const node = graph.getNode(targetId)!;
        const outputPath =
          options.output ?? join(changeDir, node.definition.generates);

        await writeTextFile(outputPath, content);
        logger.success(`Generated: ${outputPath}`);
      } catch (error) {
        logger.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
      }
    },
  );
