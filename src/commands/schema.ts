import { Command } from 'commander';
import { join } from 'node:path';
import chalk from 'chalk';
import { findProjectRoot, resolveSpecforgePath } from '../utils/path-utils.js';
import { logger } from '../utils/logger.js';
import { resolveSchema, listAvailableSchemas } from '../core/artifact-graph/resolver.js';
import { SCHEMAS_DIR } from '../utils/constants.js';
import { ensureDir, writeTextFile, pathExists } from '../utils/file-system.js';
import { stringify as stringifyYaml } from 'yaml';

export const schemaCommand = new Command('schema').description('Manage workflow schemas');

schemaCommand
  .command('list')
  .description('List available schemas')
  .option('--json', 'Output as JSON')
  .action(async (options: { json?: boolean }) => {
    try {
      const projectRoot = (await findProjectRoot()) ?? undefined;
      const schemas = await listAvailableSchemas(projectRoot);

      if (options.json) {
        logger.out(JSON.stringify(schemas, null, 2));
        return;
      }

      console.error('');
      console.error(chalk.bold('  Available schemas:'));
      for (const name of schemas) {
        try {
          const schema = await resolveSchema(name, projectRoot);
          console.error(`  • ${chalk.bold(name)} — ${schema.description}`);
        } catch {
          console.error(`  • ${chalk.bold(name)}`);
        }
      }
      console.error('');
    } catch (error) {
      logger.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  });

schemaCommand
  .command('show <name>')
  .description('Show details of a schema')
  .option('--json', 'Output as JSON')
  .action(async (name: string, options: { json?: boolean }) => {
    try {
      const projectRoot = (await findProjectRoot()) ?? undefined;
      const schema = await resolveSchema(name, projectRoot);

      if (options.json) {
        logger.out(JSON.stringify(schema, null, 2));
        return;
      }

      console.error('');
      console.error(chalk.bold(`  Schema: ${schema.name}`));
      console.error(chalk.dim(`  Version: ${schema.version}`));
      console.error(chalk.dim(`  ${schema.description}`));
      console.error('');
      console.error(chalk.bold('  Artifacts:'));
      for (const artifact of schema.artifacts) {
        const deps =
          artifact.requires.length > 0
            ? chalk.dim(` ← [${artifact.requires.join(', ')}]`)
            : '';
        console.error(`  • ${chalk.bold(artifact.id)} → ${artifact.generates}${deps}`);
        console.error(chalk.dim(`    ${artifact.description}`));
      }
      console.error('');
    } catch (error) {
      logger.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  });

schemaCommand
  .command('fork <source> <name>')
  .description('Fork a schema into the project for customization')
  .action(async (source: string, name: string) => {
    try {
      const projectRoot = await findProjectRoot();
      if (!projectRoot) {
        logger.error('Not inside a SpecForge project. Run `specforge init` first.');
        process.exitCode = 1;
        return;
      }

      const schema = await resolveSchema(source, projectRoot);

      // Write to project schemas dir
      const targetDir = resolveSpecforgePath(projectRoot, SCHEMAS_DIR, name);
      if (await pathExists(targetDir)) {
        logger.error(`Schema "${name}" already exists in project.`);
        process.exitCode = 1;
        return;
      }

      await ensureDir(targetDir);
      const forkedSchema = { ...schema, name };
      await writeTextFile(
        join(targetDir, 'schema.yaml'),
        stringifyYaml(forkedSchema, { lineWidth: 100 }),
      );

      logger.success(`Schema "${source}" forked as "${name}" in project.`);
    } catch (error) {
      logger.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  });

schemaCommand
  .command('validate <name>')
  .description('Validate a schema')
  .action(async (name: string) => {
    try {
      const projectRoot = (await findProjectRoot()) ?? undefined;
      const schema = await resolveSchema(name, projectRoot);

      // Check for cycles by attempting topological sort
      const { ArtifactGraph } = await import('../core/artifact-graph/graph.js');
      const graph = new ArtifactGraph(schema);
      graph.topologicalSort();

      logger.success(`Schema "${name}" is valid.`);
    } catch (error) {
      logger.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  });

schemaCommand
  .command('which')
  .description('Show which schema the current project is using')
  .action(async () => {
    try {
      const projectRoot = await findProjectRoot();
      if (!projectRoot) {
        logger.error('Not inside a SpecForge project.');
        process.exitCode = 1;
        return;
      }

      const { loadProjectConfig } = await import('../core/project-config.js');
      const config = await loadProjectConfig(projectRoot);
      logger.out(config.schema);
    } catch (error) {
      logger.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  });
