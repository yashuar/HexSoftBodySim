// RegionPropertiesProvider: Holds current cell parameters, applies update protocol.
// Manages parameter updates and smoothing for simulation stability.

import { HexCell } from '../domain/HexCell';

export class RegionPropertiesProvider {
  // Smoothly update cell parameters over N frames
  static smoothUpdate(cell: HexCell, targetParams: { mass?: number; stiffness?: number; damping?: number }, smoothingFrames: number = 5) {
    // If smoothingFrames is 1, update immediately
    if (smoothingFrames <= 1) {
      cell.updateParameters(targetParams);
      return;
    }
    // Otherwise, interpolate parameters over N frames
    const current = { mass: cell.mass, stiffness: cell.stiffness, damping: cell.damping };
    const step = {
      mass: targetParams.mass !== undefined ? (targetParams.mass - current.mass) / smoothingFrames : 0,
      stiffness: targetParams.stiffness !== undefined ? (targetParams.stiffness - current.stiffness) / smoothingFrames : 0,
      damping: targetParams.damping !== undefined ? (targetParams.damping - current.damping) / smoothingFrames : 0
    };
    let frame = 0;
    const interval = setInterval(() => {
      if (frame < smoothingFrames - 1) {
        cell.updateParameters({
          mass: cell.mass + step.mass,
          stiffness: cell.stiffness + step.stiffness,
          damping: cell.damping + step.damping
        });
        frame++;
      } else {
        cell.updateParameters(targetParams);
        clearInterval(interval);
      }
    }, 16); // ~60 FPS
  }
}
