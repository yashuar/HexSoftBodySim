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

  // Apply a simple area correction force to the cell's nodes
  apply(): void {
    const currentArea = this.cell.getArea();
    const error = currentArea - this.restArea;
    // Distribute correction force to all nodes
    const centroid = this.cell.getCentroid();
    for (const node of this.cell.nodes) {
      // Direction from centroid to node
      const dx = node.position.x - centroid.x;
      const dy = node.position.y - centroid.y;
      // Normalize
      const len = Math.sqrt(dx * dx + dy * dy) || 1e-8;
      const dirX = dx / len;
      const dirY = dy / len;
      // Apply force proportional to area error and direction
      const forceMag = -this.stiffness * error / this.cell.nodes.length;
      node.applyForce({ x: forceMag * dirX, y: forceMag * dirY });
    }
  }
}
