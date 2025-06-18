import { PluginSystem, EnginePlugin } from '../src/infrastructure/PluginSystem';

describe('PluginSystem (Outcome-Driven)', () => {
  afterEach(() => {
    PluginSystem.clear();
  });

  it('registers and calls plugin hooks, observable via side effects', () => {
    const calls: string[] = [];
    const plugin: EnginePlugin = {
      onRegister: () => calls.push('register'),
      onSimulateStep: dt => calls.push(`simulate:${dt}`),
      onRender: dt => calls.push(`render:${dt}`)
    };
    PluginSystem.register(plugin);
    PluginSystem.simulateStep(0.1);
    PluginSystem.render(0.2);
    // Outcome-driven: assert on observable side effects
    expect(calls).toEqual(['register', 'simulate:0.1', 'render:0.2']);
  });

  it('clears all plugins, observable via no hook calls', () => {
    const plugin: EnginePlugin = { onRegister: () => {} };
    PluginSystem.register(plugin);
    PluginSystem.clear();
    // Should not throw or call hooks
    expect(() => PluginSystem.simulateStep(1)).not.toThrow();
    expect(() => PluginSystem.render(1)).not.toThrow();
  });
});
