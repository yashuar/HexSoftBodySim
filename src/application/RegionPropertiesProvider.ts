// RegionPropertiesProvider: Holds current cell parameters, applies update protocol.
// Manages parameter updates and smoothing for simulation stability.

import { HexCell } from '../domain/HexCell';
import { CellParameters } from '../domain/CellParameters';
import { CellParameterUtils } from '../domain/CellParameterUtils';

export class RegionPropertiesProvider {
  // Smoothly update cell parameters over N frames
  static smoothUpdate(cell: HexCell, targetParams: CellParameters, smoothingFrames: number = 5) {
    CellParameterUtils.smoothUpdate(cell, targetParams, smoothingFrames);
  }
}
