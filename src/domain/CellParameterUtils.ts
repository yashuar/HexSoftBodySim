// CellParameterUtils.ts
// Utilities for blending, smoothing, and updating CellParameters

import { CellParameters } from './CellParameters';
import { HexCell } from './HexCell';

export class CellParameterUtils {
  /**
   * Blend multiple parameter sets with weights.
   */
  static blend(blendList: Array<{ params: Partial<CellParameters>, weight: number }>, defaultParams: CellParameters): CellParameters {
    let totalWeight = 0;
    let blended: CellParameters = { ...defaultParams };
    for (const { params, weight } of blendList) {
      if (params.mass !== undefined) blended.mass += params.mass * weight;
      if (params.stiffness !== undefined) blended.stiffness += params.stiffness * weight;
      if (params.damping !== undefined) blended.damping += params.damping * weight;
      totalWeight += weight;
    }
    if (totalWeight > 0) {
      blended.mass /= totalWeight;
      blended.stiffness /= totalWeight;
      blended.damping /= totalWeight;
    }
    return blended;
  }

  /**
   * Smoothly update cell parameters over N frames using requestAnimationFrame.
   */
  static smoothUpdate(cell: HexCell, target: CellParameters, smoothingFrames = 5) {
    if (smoothingFrames <= 1) {
      cell.updateParameters(target);
      return;
    }
    const start: CellParameters = { mass: cell.mass, stiffness: cell.stiffness, damping: cell.damping };
    let frame = 0;
    function step() {
      frame++;
      const t = Math.min(frame / smoothingFrames, 1);
      cell.updateParameters({
        mass: start.mass + (target.mass - start.mass) * t,
        stiffness: start.stiffness + (target.stiffness - start.stiffness) * t,
        damping: start.damping + (target.damping - start.damping) * t,
      });
      if (frame < smoothingFrames) {
        requestAnimationFrame(step);
      }
    }
    requestAnimationFrame(step);
  }
}
