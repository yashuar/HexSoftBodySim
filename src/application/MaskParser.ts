// MaskParser: Samples mask per hex cell (averaging algorithm), resolves overlaps.
// Converts image/polygon mask data into per-cell parameter values.

import { HexCell } from '../domain/HexCell';

export interface MaskRegion {
  polygon: { x: number; y: number }[]; // Polygonal mask region
  params: { mass?: number; stiffness?: number; damping?: number };
  weight?: number; // Optional blending weight
}

export class MaskParser {
  // For each cell, sample all mask regions and blend parameters
  static applyMaskToCells(maskRegions: MaskRegion[], cells: HexCell[], defaultParams: { mass: number; stiffness: number; damping: number }) {
    for (const cell of cells) {
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
      if (totalWeight > 0) {
        cell.updateParameters({
          mass: blended.mass / totalWeight,
          stiffness: blended.stiffness / totalWeight,
          damping: blended.damping / totalWeight
        });
      } else {
        cell.updateParameters(defaultParams);
      }
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
