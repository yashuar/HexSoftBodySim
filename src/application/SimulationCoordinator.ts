// SimulationCoordinator: Orchestrates initialization, worker setup, and mask-change events.
// Entry point for simulation setup and runtime coordination.

import { HexSoftBody } from '../domain/HexSoftBody';
import { PhysicsWorld2D } from '../domain/PhysicsWorld2D';
import { MaskParser, MaskRegion } from './MaskParser';
import { RegionPropertiesProvider } from './RegionPropertiesProvider';
import { CellParameters } from '../domain/CellParameters';
import { CellParameterUtils } from '../domain/CellParameterUtils';
import { MaskBlender } from './MaskBlender';
import { PluginSystem } from '../infrastructure/PluginSystem';
import { EventBus } from '../infrastructure/EventBus';

export class SimulationCoordinator {
  world: PhysicsWorld2D;
  body: HexSoftBody;
  pluginSystem: PluginSystem;
  private eventBus: EventBus;

  constructor(world: PhysicsWorld2D, body: HexSoftBody, pluginSystem: PluginSystem, eventBus?: EventBus) {
    this.world = world;
    this.body = body;
    this.pluginSystem = pluginSystem;
    this.eventBus = eventBus ?? new EventBus();
    this.world.addBody(this.body);
  }

  // Handle mask changes and update simulation parameters
  onMaskChange(maskRegions: MaskRegion[], defaultParams: CellParameters, smoothingFrames: number = 5) {
    for (const cell of this.body.cells) {
      const blended = MaskBlender.blendForCell(cell, maskRegions, defaultParams);
      CellParameterUtils.smoothUpdate(cell, blended, smoothingFrames);
    }
  }

  // Set a global parameter (stiffness or damping) for all cells
  setGlobalParameter(param: 'stiffness' | 'damping', value: number) {
    for (const cell of this.body.cells) {
      cell[param] = value;
    }
    // Also update all springs
    for (const spring of this.body.springs) {
      spring[param] = value;
    }
  }

  // Advance the simulation by one step, including plugins
  step(dt: number): void {
    try {
      this.world.simulateStep(dt);
      this.pluginSystem.simulateStep(dt);
      this.pluginSystem.render(dt);
    } catch (err) {
      this.eventBus.emit('pluginError', err);
    }
  }
}
