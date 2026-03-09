import { describe, it, expect, vi } from 'vitest';
import { PluginManager, SpecForgePlugin, HookContext } from '../../src/core/plugins.js';

describe('PluginManager', () => {
  it('should register and list plugins', () => {
    const pm = new PluginManager();
    const plugin: SpecForgePlugin = { name: 'test-plugin' };
    pm.register(plugin);
    expect(pm.getPluginNames()).toEqual(['test-plugin']);
  });

  it('should execute hooks in registration order', async () => {
    const pm = new PluginManager();
    const order: string[] = [];

    pm.register({
      name: 'first',
      hooks: {
        afterInit: async () => {
          order.push('first');
        },
      },
    });
    pm.register({
      name: 'second',
      hooks: {
        afterInit: async () => {
          order.push('second');
        },
      },
    });

    await pm.executeHook('afterInit', { projectRoot: '/test' });
    expect(order).toEqual(['first', 'second']);
  });

  it('should skip plugins without the hook', async () => {
    const pm = new PluginManager();
    const fn = vi.fn();

    pm.register({ name: 'no-hooks' });
    pm.register({ name: 'with-hook', hooks: { afterInit: fn } });

    await pm.executeHook('afterInit', { projectRoot: '/test' });
    expect(fn).toHaveBeenCalledOnce();
  });

  it('should pass context to hooks', async () => {
    const pm = new PluginManager();
    let receivedCtx: HookContext | null = null;

    pm.register({
      name: 'ctx-checker',
      hooks: {
        beforeCreateChange: async (ctx) => {
          receivedCtx = ctx;
        },
      },
    });

    await pm.executeHook('beforeCreateChange', {
      projectRoot: '/project',
      changeName: 'my-change',
    });

    expect(receivedCtx).not.toBeNull();
    expect(receivedCtx!.changeName).toBe('my-change');
  });

  it('should clear all plugins', () => {
    const pm = new PluginManager();
    pm.register({ name: 'test' });
    pm.clear();
    expect(pm.getPluginNames()).toEqual([]);
  });
});
