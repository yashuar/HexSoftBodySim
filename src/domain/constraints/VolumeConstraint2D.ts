// VolumeConstraint2D: Enforces local or global volume preservation for a set of cells or a soft body.
// Typically used to keep the area of a HexCell (or group) close to its rest value.

import { HexCell } from '../HexCell';

export class VolumeConstraint2D {
  cell: HexCell;
  restArea: number;
  stiffness: number;

  constructor(cell: HexCell, stiffness: number = 1.0) {
    this.cell = cell;
    this.restArea = cell.getArea();
    this.stiffness = stiffness;
  }

  // Apply a position-based area correction to the cell's nodes
  apply(): void {

    const currentArea = this.cell.getArea();
    const error = currentArea - this.restArea;
    
    if (Math.abs(error) < 1e-6) return; // Skip if area is close to target
    
    // Position-based correction: scale positions relative to centroid
    const centroid = this.cell.getCentroid();
    const correctionFactor = Math.sqrt(this.restArea / Math.max(currentArea, 1e-8));
    const dampingFactor = 0.1 * this.stiffness; // Limit correction magnitude
    
    for (const node of this.cell.nodes) {
      // Vector from centroid to node
      const dx = node.position.x - centroid.x;
      const dy = node.position.y - centroid.y;
      
      // Apply scaled correction toward target area
      const targetX = centroid.x + dx * correctionFactor;
      const targetY = centroid.y + dy * correctionFactor;
      
      // Blend current position with target position
      node.position.x += (targetX - node.position.x) * dampingFactor;
      node.position.y += (targetY - node.position.y) * dampingFactor;
    }
  }
}
