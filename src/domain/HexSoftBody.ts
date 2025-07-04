// HexSoftBody: Stores nodes, edges (springs), and cells for the soft-body simulation engine.
// Provides methods for area, pressure, and density modulation.
// Integrates with HexCell, Spring2D, and PointMass2D.

import { PointMass2D } from './PointMass2D';
import { Spring2D } from './Spring2D';
import { HexCell } from './HexCell';
import { CellParameters } from './CellParameters';
import { SIM_CONFIG } from '../config';

export class HexSoftBody {
  // All point masses (nodes) in the mesh
  nodes: PointMass2D[];
  // All springs (edges) connecting nodes
  springs: Spring2D[];
  // All hexagonal cells
  cells: HexCell[];

  static releaseAllToPool(body: HexSoftBody) {
    for (const node of body.nodes) PointMass2D.releaseToPool(node);
    for (const spring of body.springs) Spring2D.releaseToPool(spring);
  }

  constructor(nodes: PointMass2D[], springs: Spring2D[], cells: HexCell[]) {
    this.nodes = nodes;
    this.springs = springs;
    this.cells = cells;
    // Mark all as dirty on creation
    for (const n of nodes) n.dirty = true;
    for (const s of springs) s.dirty = true;
  }

  // Compute the total area of the soft body (sum of cell areas)
  getTotalArea(): number {
    return this.cells.reduce((sum, cell) => sum + cell.getArea(), 0);
  }

  // Compute the average density (total mass / total area) - optimized single pass
  getAverageDensity(): number {
    let totalMass = 0;
    let totalArea = 0;
    
    // Single loop to compute both mass and area
    for (let i = 0; i < this.cells.length; i++) {
      const cell = this.cells[i];
      totalMass += cell.mass;
      totalArea += cell.getArea();
    }
    
    return totalArea > 0 ? totalMass / totalArea : 0;
  }

  // Apply Mooney-Rivlin forces to all cells (if enabled)
  applyMooneyRivlinForces(): void {
    if (!SIM_CONFIG.enableMooneyRivlin) return;
    for (const cell of this.cells) {
      if (typeof cell.applyMooneyRivlinForces === 'function') {
        cell.applyMooneyRivlinForces();
      }
    }
  }

  // Apply all spring forces (updated to pass timestep for stability and constraint solver)
  applySpringForces(dt: number = 1/60, boundaryDampingScale: number = 1.0, constraintSolver?: any): void {
    for (const spring of this.springs) {
      spring.apply(dt, boundaryDampingScale, constraintSolver); // Always apply spring forces every step
    }
  }

  // Integrate all nodes
  integrate(dt: number): void {
    for (const node of this.nodes) {
      if (node.dirty) {
        node.integrate(dt);
        node.dirty = false;
      }
    }
  }

  setGlobalInteractionStrength(value: number) {
    for (const cell of this.cells) {
      if ('interactionStrength' in cell) {
        (cell as any).interactionStrength = value;
      }
    }
    for (const spring of this.springs) {
      if ('interactionStrength' in spring) {
        (spring as any).interactionStrength = value;
      }
    }
  }
}
