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

  // Set a global parameter for all cells - updated for frequency-based approach
  setGlobalParameter(param: 'springFrequency' | 'dampingRatio' | 'stiffness' | 'damping', value: number) {
    const springs = this.body.springs;
    
    // Handle both new frequency-based and legacy parameters
    if (param === 'springFrequency') {
      for (let i = 0; i < springs.length; i++) {
        springs[i].springFrequency = value;
      }
    } else if (param === 'dampingRatio') {
      for (let i = 0; i < springs.length; i++) {
        springs[i].dampingRatio = value;
      }
    } else if (param === 'stiffness') {
      // Legacy support: convert stiffness to frequency
      for (let i = 0; i < springs.length; i++) {
        springs[i].stiffness = value; // Uses the legacy compatibility setter
      }
    } else if (param === 'damping') {
      // Legacy support: convert damping to ratio
      for (let i = 0; i < springs.length; i++) {
        springs[i].damping = value; // Uses the legacy compatibility setter
      }
    }
  }

  // New frequency-based parameter setters (recommended approach)
  setGlobalSpringFrequency(frequency: number) {
    this.setGlobalParameter('springFrequency', frequency);
  }

  setGlobalDampingRatio(ratio: number) {
    this.setGlobalParameter('dampingRatio', ratio);
  }

  // Advance the simulation by one step, including plugins
  step(dt: number, uiController?: { applyInteractionForces: () => { extraVolumeConstraints?: any[] } }): void {
    try {
      this.world.simulateStep(dt, uiController);
      this.pluginSystem.simulateStep(dt);
      this.pluginSystem.render(dt);
    } catch (err) {
      this.eventBus.emit('pluginError', err);
    }
  }
}
