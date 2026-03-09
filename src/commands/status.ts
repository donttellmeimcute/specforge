import { Command } from 'commander';
import chalk from 'chalk';
import { findProjectRoot, resolveSpecforgePath } from '../utils/path-utils.js';
import { logger } from '../utils/logger.js';
import { loadProjectConfig } from '../core/project-config.js';
import { resolveSchema } from '../core/artifact-graph/resolver.js';
import { ArtifactGraph } from '../core/artifact-graph/graph.js';
import { detectArtifactStates } from '../core/artifact-graph/state.js';
import { loadChangeMetadata } from '../core/change.js';
import { CHANGES_DIR } from '../utils/constants.js';

const STATUS_ICONS: Record<string, string> = {
  pending: '⬜',
  ready: '🔵',
  'in-progress': '🔄',
  completed: '✅',
};

export const statusCommand = new Command('status')
  .description('Show the status of artifacts for a change')
  .argument('<change>', 'Name of the change')
  .option('--json', 'Output as JSON')
  .action(async (changeName: string, options: { json?: boolean }) => {
    try {
      const projectRoot = await findProjectRoot();
      if (!projectRoot) {
        logger.error('Not inside a SpecForge project. Run `specforge init` first.');
        process.exitCode = 1;
        return;
      }

      const changeDir = resolveSpecforgePath(projectRoot, CHANGES_DIR, changeName);

      // Load metadata to check for schema override
      const metadata = await loadChangeMetadata(changeDir);
      if (!metadata) {
        logger.error(`Change "${changeName}" not found.`);
        process.exitCode = 1;
        return;
      }

      // Resolve schema
      const config = await loadProjectConfig(projectRoot);
      const schemaName = metadata.schema ?? config.schema;
      const schema = await resolveSchema(schemaName, projectRoot);

      // Build graph and detect states
      const graph = new ArtifactGraph(schema);
      await detectArtifactStates(graph, changeDir);

      if (options.json) {
        const data = graph.getAllNodes().map((node) => ({
          id: node.definition.id,
          status: node.status,
          generates: node.definition.generates,
          files: node.matchedFiles,
          requires: node.definition.requires,
        }));
        logger.out(JSON.stringify(data, null, 2));
        return;
      }

      // Pretty output
      console.error('');
      console.error(chalk.bold(`  Change: ${changeName}`));
      console.error(chalk.dim(`  Schema: ${schemaName}`));
      console.error(chalk.dim(`  Status: ${metadata.status}`));
      console.error('');

      const sorted = graph.topologicalSort();
      for (const id of sorted) {
        const node = graph.getNode(id)!;
        const icon = STATUS_ICONS[node.status] ?? '?';
        const name = chalk.bold(id);
        const desc = chalk.dim(node.definition.description);
        const files =
          node.matchedFiles.length > 0
            ? chalk.green(` (${node.matchedFiles.length} file(s))`)
            : '';
        console.error(`  ${icon} ${name} — ${desc}${files}`);
      }

      console.error('');
      const summary = graph.getSummary();
      const total = sorted.length;
      const done = summary.completed.length;
      const bar = `[${'█'.repeat(done)}${'░'.repeat(total - done)}]`;
      console.error(`  Progress: ${bar} ${done}/${total}`);

      if (graph.isComplete()) {
        console.error(
          chalk.green(
            '\n  All artifacts complete! Run `specforge archive` to archive this change.',
          ),
        );
      } else {
        const next = graph.getNextArtifacts();
        if (next.length > 0) {
          const nextIds = next.map((n) => n.definition.id).join(', ');
          console.error(chalk.blue(`\n  Next: ${nextIds}`));
        }
      }
      console.error('');
    } catch (error) {
      logger.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  });
