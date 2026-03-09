import { Command } from 'commander';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import chalk from 'chalk';
import { findProjectRoot, resolveSpecforgePath } from '../utils/path-utils.js';
import { logger } from '../utils/logger.js';
import { loadProjectConfig } from '../core/project-config.js';
import { resolveSchema } from '../core/artifact-graph/resolver.js';
import { ArtifactGraph } from '../core/artifact-graph/graph.js';
import { detectArtifactStates } from '../core/artifact-graph/state.js';
import { loadChangeMetadata } from '../core/change.js';
import { CHANGES_DIR, ARCHIVE_DIR, CONFIG_FILE, METADATA_FILE } from '../utils/constants.js';
import { pathExists, readTextFile } from '../utils/file-system.js';
import { parse as parseYaml } from 'yaml';
import { deepValidate, checkConsistency, ValidationResult } from '../core/smart-validate.js';

export const validateCommand = new Command('validate')
  .description('Validate specs, changes, and configuration')
  .argument('[change]', 'Specific change to validate (validates all if omitted)')
  .option('--json', 'Output as JSON')
  .option('--deep', 'Run deep validation with completeness scoring')
  .action(async (changeName: string | undefined, options: { json?: boolean; deep?: boolean }) => {
    try {
      const projectRoot = await findProjectRoot();
      if (!projectRoot) {
        logger.error(
          'Not inside a SpecForge project. Run `specforge init` first.',
        );
        process.exitCode = 1;
        return;
      }

      const issues: Array<{ level: 'error' | 'warning'; target: string; message: string }> = [];
      const deepResults = new Map<string, ValidationResult>();

      // Validate config
      const configPath = resolveSpecforgePath(projectRoot, CONFIG_FILE);
      const configContent = await readTextFile(configPath);
      if (!configContent) {
        issues.push({
          level: 'warning',
          target: 'config.yaml',
          message: 'Config file not found, using defaults',
        });
      } else {
        try {
          parseYaml(configContent);
        } catch {
          issues.push({
            level: 'error',
            target: 'config.yaml',
            message: 'Invalid YAML syntax',
          });
        }
      }

      // Validate schema resolution
      const config = await loadProjectConfig(projectRoot);
      try {
        await resolveSchema(config.schema, projectRoot);
      } catch {
        issues.push({
          level: 'error',
          target: 'config.yaml',
          message: `Schema "${config.schema}" could not be resolved`,
        });
      }

      // Validate changes
      const changesDir = resolveSpecforgePath(projectRoot, CHANGES_DIR);
      if (await pathExists(changesDir)) {
        const changesToValidate: string[] = [];

        if (changeName) {
          changesToValidate.push(changeName);
        } else {
          const entries = await readdir(changesDir, { withFileTypes: true });
          for (const entry of entries) {
            if (entry.isDirectory() && entry.name !== ARCHIVE_DIR) {
              changesToValidate.push(entry.name);
            }
          }
        }

        for (const name of changesToValidate) {
          const changeDir = join(changesDir, name);

          if (!(await pathExists(changeDir))) {
            issues.push({
              level: 'error',
              target: name,
              message: `Change directory not found`,
            });
            continue;
          }

          // Validate metadata
          const metadataPath = join(changeDir, METADATA_FILE);
          if (!(await pathExists(metadataPath))) {
            issues.push({
              level: 'error',
              target: name,
              message: `Missing ${METADATA_FILE}`,
            });
            continue;
          }

          const metadata = await loadChangeMetadata(changeDir);
          if (!metadata) {
            issues.push({
              level: 'error',
              target: name,
              message: `Invalid ${METADATA_FILE}`,
            });
            continue;
          }

          // Validate schema for this change
          const schemaName = metadata.schema ?? config.schema;
          try {
            const schema = await resolveSchema(schemaName, projectRoot);
            const graph = new ArtifactGraph(schema);
            await detectArtifactStates(graph, changeDir);

            // Check for inconsistencies
            const summary = graph.getSummary();
            if (summary.completed.length === 0) {
              issues.push({
                level: 'warning',
                target: name,
                message: 'No artifacts completed yet',
              });
            }

            // Deep validation
            if (options.deep) {
              const ora = (await import('ora')).default;
              const spinner = ora(`Running deep validation for ${name}...`).start();
              const deepResult = await deepValidate(projectRoot, name);
              spinner.stop();
              // Attach deep result so it is accessible for JSON output
              deepResults.set(name, deepResult);

              for (const issue of deepResult.issues) {
                issues.push({
                  level: issue.level === 'info' ? 'warning' : issue.level,
                  target: `${name}/${issue.artifact}`,
                  message: issue.message,
                });
              }

              const consistencyIssues = await checkConsistency(graph, changeDir);
              for (const issue of consistencyIssues) {
                issues.push({
                  level: issue.level === 'info' ? 'warning' : issue.level,
                  target: `${name}/${issue.artifact}`,
                  message: issue.message,
                });
              }
            }
          } catch (e) {
            issues.push({
              level: 'error',
              target: name,
              message: `Schema error: ${e instanceof Error ? e.message : String(e)}`,
            });
          }
        }
      }

      // Output
      if (options.json) {
        const valid = issues.filter((i) => i.level === 'error').length === 0;

        if (options.deep && deepResults.size > 0) {
          // Aggregate scores across all validated changes
          const scores = [...deepResults.values()].map((r) => r.score);
          const aggregateScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
          const allSelfHealing = [...deepResults.entries()].flatMap(([name, r]) =>
            (r.selfHealingInstructions ?? []).map((inst) => `[${name}] ${inst}`),
          );
          logger.out(
            JSON.stringify(
              {
                valid,
                score: aggregateScore,
                issues,
                ...(allSelfHealing.length > 0
                  ? { selfHealingInstructions: allSelfHealing }
                  : {}),
              },
              null,
              2,
            ),
          );
        } else {
          logger.out(JSON.stringify({ valid, issues }, null, 2));
        }
        return;
      }

      const errors = issues.filter((i) => i.level === 'error');
      const warnings = issues.filter((i) => i.level === 'warning');

      console.error('');
      if (errors.length > 0) {
        console.error(chalk.red.bold('  Errors:'));
        for (const issue of errors) {
          console.error(chalk.red(`  ✖ [${issue.target}] ${issue.message}`));
        }
        console.error('');
      }

      if (warnings.length > 0) {
        console.error(chalk.yellow.bold('  Warnings:'));
        for (const issue of warnings) {
          console.error(chalk.yellow(`  ⚠ [${issue.target}] ${issue.message}`));
        }
        console.error('');
      }

      // Show deep score in human-readable output
      if (options.deep && deepResults.size > 0) {
        const scores = [...deepResults.values()].map((r) => r.score);
        const aggregateScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
        const scoreColor = aggregateScore >= 90 ? chalk.green : aggregateScore >= 60 ? chalk.yellow : chalk.red;
        console.error(scoreColor(`  Score: ${aggregateScore}/100`));
        if (aggregateScore < 90) {
          console.error(chalk.dim('  Run with --json to get self-healing instructions for the agent.'));
        }
        console.error('');
      }

      if (errors.length === 0 && warnings.length === 0) {
        logger.success('All validations passed!');
      } else if (errors.length === 0) {
        logger.success(`Valid with ${warnings.length} warning(s).`);
      } else {
        logger.error(`${errors.length} error(s), ${warnings.length} warning(s).`);
        process.exitCode = 1;
      }
    } catch (error) {
      logger.error(
        error instanceof Error ? error.message : String(error),
      );
      process.exitCode = 1;
    }
  });
