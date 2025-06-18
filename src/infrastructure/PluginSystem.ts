// PluginSystem.ts
// Simple plugin/extension system for simulation and rendering

export interface EnginePlugin {
  /** Called once on registration. */
  onRegister?(): void;
  /** Called on each simulation step. */
  onSimulateStep?(dt: number): void;
  /** Called before/after rendering. */
  onRender?(dt: number): void;
}

export class PluginSystem {
  private plugins: EnginePlugin[] = [];

  register(plugin: EnginePlugin) {
    this.plugins.push(plugin);
    plugin.onRegister?.();
  }

  simulateStep(dt: number) {
    for (const p of this.plugins) p.onSimulateStep?.(dt);
  }

  render(dt: number) {
    for (const p of this.plugins) p.onRender?.(dt);
  }

  clear() {
    this.plugins = [];
  }
}
