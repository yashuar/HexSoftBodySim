// HexSoftBody: Stores nodes, edges (springs), and cells for the soft-body simulation engine.
// Provides methods for area, pressure, and density modulation.
// Integrates with HexCell, Spring2D, and PointMass2D.

import { PointMass2D } from './PointMass2D';
import { Spring2D } from './Spring2D';
import { HexCell } from './HexCell';

export class HexSoftBody {
  // All point masses (nodes) in the mesh
  nodes: PointMass2D[];
  // All springs (edges) connecting nodes
  springs: Spring2D[];
  // All hexagonal cells
  cells: HexCell[];

  constructor(nodes: PointMass2D[], springs: Spring2D[], cells: HexCell[]) {
    this.nodes = nodes;
    this.springs = springs;
    this.cells = cells;
  }

  // Compute the total area of the soft body (sum of cell areas)
  getTotalArea(): number {
    return this.cells.reduce((sum, cell) => sum + cell.getArea(), 0);
  }

  // Compute the average density (total mass / total area)
  getAverageDensity(): number {
    const totalMass = this.cells.reduce((sum, cell) => sum + cell.mass, 0);
    const totalArea = this.getTotalArea();
    return totalArea > 0 ? totalMass / totalArea : 0;
  }

  // Apply Mooney-Rivlin forces to all cells (if enabled)
  applyMooneyRivlinForces(): void {
    for (const cell of this.cells) {
      if (typeof cell.applyMooneyRivlinForces === 'function') {
        cell.applyMooneyRivlinForces();
      }
    }
  }

  // Apply all spring forces
  applySpringForces(): void {
    for (const spring of this.springs) {
      spring.apply();
    }
  }

  // Integrate all nodes
  integrate(dt: number): void {
    for (const node of this.nodes) {
      node.integrate(dt);
    }
  }
}
