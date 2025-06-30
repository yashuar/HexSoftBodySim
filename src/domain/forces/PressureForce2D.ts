// PressureForce2D: Modular pressure force generator for the simulation engine.
// Applies pressure to the boundary nodes of a cell or soft body.

import { HexCell } from '../HexCell';

export class PressureForce2D {
  pressure: number;

  constructor(pressure: number = 0) {
    this.pressure = pressure;
  }

  // Apply pressure to a cell's nodes (outward normal approximation)
  apply(cell: HexCell): void {
    const centroid = cell.getCentroid();
    for (let i = 0; i < cell.nodes.length; i++) {
      const node = cell.nodes[i];
      // Outward direction from centroid to node
      const dx = node.getPositionX() - centroid.x;
      const dy = node.getPositionY() - centroid.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1e-8;
      const dirX = dx / len;
      const dirY = dy / len;
      // Apply pressure force proportional to cell area and pressure
      const forceMag = this.pressure * cell.getArea() / cell.nodes.length;
      node.addForce(forceMag * dirX, forceMag * dirY);
    }
  }
}
