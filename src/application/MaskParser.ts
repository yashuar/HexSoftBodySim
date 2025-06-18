// MaskParser: Samples mask per hex cell (averaging algorithm), resolves overlaps.
// Converts image/polygon mask data into per-cell parameter values.

import { HexCell } from '../domain/HexCell';
import { CellParameters } from '../domain/CellParameters';
import { CellParameterUtils } from '../domain/CellParameterUtils';

export interface MaskRegion {
  polygon: { x: number; y: number }[];
  params: Partial<CellParameters>;
  weight?: number;
}

export class MaskParser {
  // For each cell, sample all mask regions and blend parameters
  static applyMaskToCells(maskRegions: MaskRegion[], cells: HexCell[], defaultParams: CellParameters) {
    for (const cell of cells) {
      // Collect all regions that include this cell
      const blends = maskRegions
        .filter(region => MaskParser.cellInPolygon(cell, region.polygon))
        .map(region => ({ params: region.params, weight: region.weight ?? 1 }));
      const blended = CellParameterUtils.blend(blends, defaultParams);
      cell.updateParameters(blended);
    }
  }

  // Point-in-polygon test for cell centroid
  static cellInPolygon(cell: HexCell, polygon: { x: number; y: number }[]): boolean {
    const pt = cell.getCentroid();
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x, yi = polygon[i].y;
      const xj = polygon[j].x, yj = polygon[j].y;
      const intersect = ((yi > pt.y) !== (yj > pt.y)) &&
        (pt.x < (xj - xi) * (pt.y - yi) / (yj - yi + 1e-8) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }
}
