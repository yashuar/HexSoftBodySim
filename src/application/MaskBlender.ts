// MaskBlender.ts
// Responsible for blending mask regions and producing per-cell parameters

import { MaskRegion } from './MaskParser';
import { CellParameters } from '../domain/CellParameters';
import { CellParameterUtils } from '../domain/CellParameterUtils';
import { HexCell } from '../domain/HexCell';

export class MaskBlender {
  static blendForCell(cell: HexCell, maskRegions: MaskRegion[], defaultParams: CellParameters): CellParameters {
    const blends = maskRegions
      .filter(region => MaskBlender.cellInPolygon(cell, region.polygon))
      .map(region => ({ params: region.params, weight: region.weight ?? 1 }));
    return CellParameterUtils.blend(blends, defaultParams);
  }

  // Point-in-polygon test (delegated for now)
  static cellInPolygon(cell: HexCell, polygon: { x: number; y: number }[]): boolean {
    // This can delegate to MaskParser or be implemented here for decoupling
    // For now, import from MaskParser
    // (In future, move the logic here for full modularity)
    // @ts-ignore
    return require('./MaskParser').MaskParser.cellInPolygon(cell, polygon);
  }
}
