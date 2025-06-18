// HexCell: Represents a single hexagonal cell in the mesh for the soft-body simulation engine.
// Each cell references its six neighboring PointMass2D nodes (corners),
// stores cell-specific parameters (mass, stiffness, damping), and provides methods for area, centroid, and parameter updates.
// Cells may also store references to their neighbors or indices for mesh traversal.

import { PointMass2D } from './PointMass2D';
import { CellParameters } from './CellParameters';

export class HexCell {
  // The six corner nodes of the hexagon (ordered, e.g., clockwise)
  nodes: PointMass2D[];

  // Cell center position (computed from nodes or provided)
  center: { x: number; y: number };

  // Cell parameters (can be updated via mask):
  mass: number;
  stiffness: number;
  damping: number;

  // Optional: cell index in the grid (axial or offset coordinates)
  index?: { q: number; r: number };

  // Store rest (reference) positions for Mooney-Rivlin energy calculation
  restPositions: { x: number; y: number }[] = [];

  // Mooney-Rivlin material parameters (C1, C2)
  mooneyC1: number = 1.0;
  mooneyC2: number = 0.0;

  constructor(
    nodes: PointMass2D[],
    center: { x: number; y: number },
    params: CellParameters = { mass: 0.01, stiffness: 0.01, damping: 0.01 },
    index?: { q: number; r: number }
  ) {
    if (nodes.length !== 6) {
      throw new Error('HexCell requires exactly 6 nodes');
    }
    this.nodes = nodes;
    this.center = { ...center };
    this.mass = params.mass;
    this.stiffness = params.stiffness;
    this.damping = params.damping;
    this.index = index;
  }

  // Compute the area of the hex cell (using the shoelace formula)
  getArea(): number {
    let area = 0;
    for (let i = 0; i < 6; i++) {
      const p1 = this.nodes[i].position;
      const p2 = this.nodes[(i + 1) % 6].position;
      area += (p1.x * p2.y - p2.x * p1.y);
    }
    return Math.abs(area) / 2;
  }

  // Compute the centroid of the hex cell (average of node positions)
  getCentroid(): { x: number; y: number } {
    let x = 0, y = 0;
    for (const node of this.nodes) {
      x += node.position.x;
      y += node.position.y;
    }
    return { x: x / 6, y: y / 6 };
  }

  // Update cell parameters (e.g., from mask sampling)
  updateParameters(params: Partial<CellParameters>): void {
    if (params.mass !== undefined) this.mass = params.mass;
    if (params.stiffness !== undefined) this.stiffness = params.stiffness;
    if (params.damping !== undefined) this.damping = params.damping;
  }

  // Call this after construction to set the rest shape
  setRestShape(): void {
    this.restPositions = this.nodes.map(n => ({ ...n.position }));
  }

  // Compute and apply Mooney-Rivlin forces to the nodes
  // (Simplified for 2D hexagon, assumes small deformations and area preservation)
  applyMooneyRivlinForces(): void {
    if (this.restPositions.length !== 6) return;
    // Compute deformation gradient F (approximate for 2D polygon)
    // For simplicity, use centroid-based mapping
    const Xc = this.restPositions.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
    Xc.x /= 6; Xc.y /= 6;
    const xc = this.nodes.reduce((acc, n) => ({ x: acc.x + n.position.x, y: acc.y + n.position.y }), { x: 0, y: 0 });
    xc.x /= 6; xc.y /= 6;
    // Build 2x2 matrices for rest/current edge vectors
    let F = [[0, 0], [0, 0]];
    for (let i = 0; i < 6; i++) {
      const X = { x: this.restPositions[i].x - Xc.x, y: this.restPositions[i].y - Xc.y };
      const x = { x: this.nodes[i].position.x - xc.x, y: this.nodes[i].position.y - xc.y };
      F[0][0] += x.x * X.x; F[0][1] += x.x * X.y;
      F[1][0] += x.y * X.x; F[1][1] += x.y * X.y;
    }
    // Normalize by sum of squared rest edge lengths
    let norm = 0;
    for (let i = 0; i < 6; i++) {
      const X = { x: this.restPositions[i].x - Xc.x, y: this.restPositions[i].y - Xc.y };
      norm += X.x * X.x + X.y * X.y;
    }
    if (norm > 1e-8) {
      F[0][0] /= norm; F[0][1] /= norm;
      F[1][0] /= norm; F[1][1] /= norm;
    }
    // Compute invariants I1, I2 for 2D Mooney-Rivlin
    const I1 = F[0][0] * F[0][0] + F[0][1] * F[0][1] + F[1][0] * F[1][0] + F[1][1] * F[1][1];
    const detF = F[0][0] * F[1][1] - F[0][1] * F[1][0];
    const I2 = detF * detF;
    // Mooney-Rivlin energy density: W = C1*(I1-2) + C2*(I2-1)
    // For simplicity, apply force proportional to gradient of W wrt node positions (approximate)
    // Here, we apply a simple force proportional to deviation from rest shape
    for (let i = 0; i < 6; i++) {
      const rest = this.restPositions[i];
      const curr = this.nodes[i].position;
      const fx = this.mooneyC1 * (curr.x - rest.x) + this.mooneyC2 * (I1 - 2) * (curr.x - rest.x);
      const fy = this.mooneyC1 * (curr.y - rest.y) + this.mooneyC2 * (I1 - 2) * (curr.y - rest.y);
      this.nodes[i].applyForce({ x: -fx, y: -fy });
    }
  }
}
