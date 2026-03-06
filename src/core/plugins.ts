/**
 * SpecForge Plugin System
 *
 * Plugins can hook into lifecycle events to extend SpecForge behavior.
 * Plugins are loaded from config.yaml and executed in order.
 */

export type HookName =
  | 'beforeInit'
  | 'afterInit'
  | 'beforeCreateChange'
  | 'afterCreateChange'
  | 'beforeArchive'
  | 'afterArchive'
  | 'beforeValidate'
  | 'afterValidate';

export interface HookContext {
  projectRoot: string;
  changeName?: string;
  changeDir?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface SpecForgePlugin {
  name: string;
  hooks?: Partial<Record<HookName, (ctx: HookContext) => Promise<void> | void>>;
}

export type PluginFactory = (config?: Record<string, unknown>) => SpecForgePlugin;

/**
 * Plugin manager that handles registration and execution of hooks.
 */
export class PluginManager {
  private plugins: SpecForgePlugin[] = [];

  /** Register a plugin */
  register(plugin: SpecForgePlugin): void {
    this.plugins.push(plugin);
  }

  /** Execute a hook across all registered plugins (in order) */
  async executeHook(hookName: HookName, context: HookContext): Promise<void> {
    for (const plugin of this.plugins) {
      const hook = plugin.hooks?.[hookName];
      if (hook) {
        await hook(context);
      }
    }
  }

  /** Get all registered plugin names */
  getPluginNames(): string[] {
    return this.plugins.map((p) => p.name);
  }

  /** Clear all plugins */
  clear(): void {
    this.plugins = [];
  }
}

/** Global singleton plugin manager */
export const pluginManager = new PluginManager();
