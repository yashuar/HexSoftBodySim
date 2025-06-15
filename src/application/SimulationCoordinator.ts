// SimulationCoordinator: Orchestrates initialization, worker setup, and mask-change events.
// Entry point for simulation setup and runtime coordination.

import { HexSoftBody } from '../domain/HexSoftBody';
import { PhysicsWorld2D } from '../domain/PhysicsWorld2D';
import { MaskParser, MaskRegion } from './MaskParser';
import { RegionPropertiesProvider } from './RegionPropertiesProvider';

export class SimulationCoordinator {
  world: PhysicsWorld2D;
  body: HexSoftBody;

  constructor(world: PhysicsWorld2D, body: HexSoftBody) {
    this.world = world;
    this.body = body;
    this.world.addBody(this.body);
  }

  // Handle mask changes and update simulation parameters
  onMaskChange(maskRegions: MaskRegion[], defaultParams: { mass: number; stiffness: number; damping: number }, smoothingFrames: number = 5) {
    // Update cell parameters using MaskParser and smooth with RegionPropertiesProvider
    for (const cell of this.body.cells) {
      // Find blended parameters for this cell
      let totalWeight = 0;
      let blended = { mass: 0, stiffness: 0, damping: 0 };
      for (const region of maskRegions) {
        if (MaskParser.cellInPolygon(cell, region.polygon)) {
          const w = region.weight ?? 1;
          if (region.params.mass !== undefined) blended.mass += region.params.mass * w;
          if (region.params.stiffness !== undefined) blended.stiffness += region.params.stiffness * w;
          if (region.params.damping !== undefined) blended.damping += region.params.damping * w;
          totalWeight += w;
        }
      }
      let targetParams;
      if (totalWeight > 0) {
        targetParams = {
          mass: blended.mass / totalWeight,
          stiffness: blended.stiffness / totalWeight,
          damping: blended.damping / totalWeight
        };
      } else {
        targetParams = defaultParams;
      }
      RegionPropertiesProvider.smoothUpdate(cell, targetParams, smoothingFrames);
    }
  }

  // Set a global parameter (stiffness or damping) for all cells
  setGlobalParameter(param: 'stiffness' | 'damping', value: number) {
    for (const cell of this.body.cells) {
      cell[param] = value;
    }
  }

  // Advance the simulation by one step
  step(dt: number): void {
    this.world.simulateStep(dt);
  }
}
