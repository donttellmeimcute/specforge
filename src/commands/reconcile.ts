import { Command } from 'commander';
import { findProjectRoot, resolveSpecforgePath } from '../utils/path-utils.js';
import { logger } from '../utils/logger.js';
import { loadChangeMetadata } from '../core/change.js';
import { select, confirm, intro, outro, spinner as clackSpinner } from '@clack/prompts';
import { CHANGES_DIR } from '../utils/constants.js';

export const reconcileCommand = new Command('reconcile')
  .description('Resolve conflicts between specifications and implementation')
  .argument('<change>', 'Name of the change to reconcile')
  .action(async (changeName: string) => {
    const s = clackSpinner();
    try {
      intro(`SpecForge Smart Sync - Reconciling ${changeName}`);
      const projectRoot = await findProjectRoot();
      if (!projectRoot) {
        logger.error('Not inside a SpecForge project.');
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

      s.start('Detecting divergences between specifications and code...');
      // Simulated detection of divergence
      await new Promise((r) => setTimeout(r, 1000));
      s.stop('Divergence detected.');

      // Mock conflict for demonstration since core engine doesn't return list of divergences yet
      const conflicts = [{ file: 'src/auth/login.ts', spec: 'specs/auth/login.md' }];

      for (const conflict of conflicts) {
        logger.warn(`\nConflict in ${conflict.file} vs ${conflict.spec}`);

        const action = await select({
          message: '¿Qué deseas hacer?',
          options: [
            {
              value: 'ai-overwrite',
              label:
                'Sobrescribir el código con IA para que coincida con la especificación',
            },
            {
              value: 'spec-update',
              label: 'Actualizar la especificación usando el código manual como fuente',
            },
            { value: 'skip', label: 'Ignorar por ahora' },
          ],
        });

        if (action === 'skip' || typeof action === 'symbol') {
          continue;
        }

        const isSure = await confirm({
          message: `¿Estás seguro de que deseas aplicar: ${action}?`,
          initialValue: true,
        });

        if (!isSure || typeof isSure === 'symbol') {
          continue;
        }

        s.start(`Applying ${action}...`);
        await new Promise((r) => setTimeout(r, 1500)); // Simulate AI/File operation
        s.stop(`Successfully applied ${action}`);
      }

      outro('Reconciliation complete!');
    } catch (error) {
      s.stop('Reconciliation failed');
      logger.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  });
