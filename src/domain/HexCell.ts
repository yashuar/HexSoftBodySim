// HexCell: Represents a single hexagonal cell in the mesh for the soft-body simulation engine.
// Each cell references its six neighboring PointMass2D nodes (corners),
// stores cell-specific parameters (mass, stiffness, damping), and provides methods for area, centroid, and parameter updates.
// Cells may also store references to their neighbors or indices for mesh traversal.

import { PointMass2D } from './PointMass2D';
import { CellParameters } from './CellParameters';
import { SIM_CONFIG } from '../config';

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
  
  // Mooney-Rivlin damping parameters for biological realism
  mooneyDamping: number = SIM_CONFIG.mooneyDamping; // Viscous damping coefficient (biological tissues are viscous)
  mooneyMaxForce: number = SIM_CONFIG.mooneyMaxForce; // Maximum force per node to prevent instability

  constructor(
    nodes: PointMass2D[],
    center: { x: number; y: number },
    params: CellParameters = { mass: 0.01, springFrequency: 8.0, dampingRatio: 0.3 },
    index?: { q: number; r: number }
  ) {
    if (nodes.length !== 6) {
      throw new Error('HexCell requires exactly 6 nodes');
    }
    this.nodes = nodes;
    this.center = { ...center };
    this.mass = params.mass;
    this.stiffness = params.springFrequency || 8.0; // Convert from frequency for backward compatibility
    this.damping = params.dampingRatio || 0.3; // Convert from ratio for backward compatibility
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
    if (params.springFrequency !== undefined) this.stiffness = params.springFrequency;
    if (params.dampingRatio !== undefined) this.damping = params.dampingRatio;
  }

  // Call this after construction to set the rest shape
  setRestShape(): void {
    this.restPositions = this.nodes.map(n => ({ ...n.position }));
  }

  // Compute and apply Mooney-Rivlin forces to the nodes
  // Improved implementation with biological damping and stability
  applyMooneyRivlinForces(): void {
    if (this.restPositions.length !== 6) return;
    
    // Calculate current centroid and rest centroid
    const currentCentroid = this.getCentroid();
    const restCentroid = {
      x: this.restPositions.reduce((sum, p) => sum + p.x, 0) / 6,
      y: this.restPositions.reduce((sum, p) => sum + p.y, 0) / 6
    };
    
    // Calculate area-based strain (biological tissues resist area changes)
    const currentArea = this.getArea();
    const restArea = this.calculateRestArea();
    const areaStrain = (currentArea - restArea) / Math.max(restArea, 1e-8);
    
    // Calculate shape strain for each node (deviation from rest configuration)
    for (let i = 0; i < 6; i++) {
      const restPos = this.restPositions[i];
      const currentPos = this.nodes[i].position;
      const currentVel = this.nodes[i].velocity;
      
      // Position relative to centroid (to handle translation invariance)
      const restRelative = {
        x: restPos.x - restCentroid.x,
        y: restPos.y - restCentroid.y
      };
      const currentRelative = {
        x: currentPos.x - currentCentroid.x,
        y: currentPos.y - currentCentroid.y
      };
      
      // Calculate strain tensor components (simplified 2D)
      const strainX = currentRelative.x - restRelative.x;
      const strainY = currentRelative.y - restRelative.y;
      const shearStrain = (currentRelative.x * restRelative.y - currentRelative.y * restRelative.x) / Math.max(restArea, 1e-8);
      
      // Mooney-Rivlin force components
      // C1 term: resists extension/compression
      const c1ForceX = -this.mooneyC1 * strainX;
      const c1ForceY = -this.mooneyC1 * strainY;
      
      // C2 term: resists area change and shear
      const c2ForceX = -this.mooneyC2 * (areaStrain * strainX + 0.5 * shearStrain * restRelative.y);
      const c2ForceY = -this.mooneyC2 * (areaStrain * strainY - 0.5 * shearStrain * restRelative.x);
      
      // Total elastic force
      let totalForceX = c1ForceX + c2ForceX;
      let totalForceY = c1ForceY + c2ForceY;
      
      // Apply biological damping (tissues are viscous)
      // Damping force proportional to velocity relative to neighbors
      let avgNeighborVelX = 0;
      let avgNeighborVelY = 0;
      const prevNode = this.nodes[(i + 5) % 6]; // Previous node in hexagon
      const nextNode = this.nodes[(i + 1) % 6]; // Next node in hexagon
      avgNeighborVelX = (prevNode.velocity.x + nextNode.velocity.x) / 2;
      avgNeighborVelY = (prevNode.velocity.y + nextNode.velocity.y) / 2;
      
      const relativeVelX = currentVel.x - avgNeighborVelX;
      const relativeVelY = currentVel.y - avgNeighborVelY;
      
      const dampingForceX = -this.mooneyDamping * relativeVelX;
      const dampingForceY = -this.mooneyDamping * relativeVelY;
      
      // Combine elastic and damping forces
      totalForceX += dampingForceX;
      totalForceY += dampingForceY;
      
      // Clamp forces to prevent instability (biological tissues have limits)
      const forceMagnitude = Math.sqrt(totalForceX * totalForceX + totalForceY * totalForceY);
      if (forceMagnitude > this.mooneyMaxForce) {
        const scale = this.mooneyMaxForce / forceMagnitude;
        totalForceX *= scale;
        totalForceY *= scale;
      }
      
      // Apply forces to the node
      if (isFinite(totalForceX) && isFinite(totalForceY)) {
        this.nodes[i].applyForce({ x: totalForceX, y: totalForceY });
      }
    }
  }
  
  // Helper method to calculate rest area
  private calculateRestArea(): number {
    if (this.restPositions.length !== 6) return 0;
    let area = 0;
    for (let i = 0; i < 6; i++) {
      const p1 = this.restPositions[i];
      const p2 = this.restPositions[(i + 1) % 6];
      area += (p1.x * p2.y - p2.x * p1.y);
    }
    return Math.abs(area) / 2;
  }
}
