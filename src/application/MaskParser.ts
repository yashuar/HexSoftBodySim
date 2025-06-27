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
  // For each cell, sample all mask regions and blend parameters - optimized with bounding box pre-filtering
  static applyMaskToCells(maskRegions: MaskRegion[], cells: HexCell[], defaultParams: CellParameters) {
    // Pre-compute bounding boxes for all mask regions to avoid expensive polygon tests
    const regionBounds = maskRegions.map(region => {
      const xs = region.polygon.map(p => p.x);
      const ys = region.polygon.map(p => p.y);
      return {
        region,
        minX: Math.min(...xs),
        maxX: Math.max(...xs),
        minY: Math.min(...ys),
        maxY: Math.max(...ys)
      };
    });

    for (const cell of cells) {
      const centroid = cell.getCentroid(); // Compute once per cell
      
      // Collect all regions that include this cell - optimized with bounding box filtering
      const blends = regionBounds
        .filter(({ minX, maxX, minY, maxY }) => 
          centroid.x >= minX && centroid.x <= maxX && 
          centroid.y >= minY && centroid.y <= maxY)
        .filter(({ region }) => MaskParser.pointInPolygon(centroid, region.polygon))
        .map(({ region }) => ({ params: region.params, weight: region.weight ?? 1 }));
      
      const blended = CellParameterUtils.blend(blends, defaultParams);
      cell.updateParameters(blended);
    }
  }

  // Point-in-polygon test for a given point (optimized version)
  static pointInPolygon(pt: { x: number; y: number }, polygon: { x: number; y: number }[]): boolean {
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

  // Point-in-polygon test for cell centroid (deprecated - use pointInPolygon instead)
  static cellInPolygon(cell: HexCell, polygon: { x: number; y: number }[]): boolean {
    return MaskParser.pointInPolygon(cell.getCentroid(), polygon);
  }
}
