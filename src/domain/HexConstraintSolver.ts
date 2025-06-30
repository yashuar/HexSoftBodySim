// HexConstraintSolver.ts
// Position-based constraint solver for hexagon integrity
// Prevents springs from folding and maintains hexagon shape

import { HexSoftBody } from './HexSoftBody';
import { PointMass2D } from './PointMass2D';
import { HexCell } from './HexCell';

export class HexConstraintSolver {
  // Solve position-based constraints for hexagon integrity
  static solveHexagonConstraints(body: HexSoftBody, dt: number): void {
    const iterations = 3; // Multiple iterations for stability
    
    for (let iter = 0; iter < iterations; iter++) {
      // 1. Enforce minimum distance constraints (prevent folding)
      this.enforceMinimumDistances(body);
      
      // 2. Enforce hexagon area preservation (prevent collapse)
      this.enforceAreaConstraints(body, dt);
      
      // 3. Enforce maximum stretch constraints (prevent excessive elongation)
      this.enforceMaximumStretch(body);
    }
  }
  
  // Prevent nodes from getting too close (folding prevention)
  private static enforceMinimumDistances(body: HexSoftBody): void {
    const minDistance = 5.0; // Minimum allowed distance between any two nodes
    
    for (let i = 0; i < body.nodes.length; i++) {
      for (let j = i + 1; j < body.nodes.length; j++) {
        const nodeA = body.nodes[i];
        const nodeB = body.nodes[j];
        
        const dx = nodeB.position.x - nodeA.position.x;
        const dy = nodeB.position.y - nodeA.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < minDistance && dist > 0) {
          // Push nodes apart
          const correction = (minDistance - dist) * 0.5;
          const dirX = dx / dist;
          const dirY = dy / dist;
          
          // Apply correction proportional to inverse mass
          const totalInvMass = (1 / nodeA.mass) + (1 / nodeB.mass);
          const correctionA = correction * (1 / nodeA.mass) / totalInvMass;
          const correctionB = correction * (1 / nodeB.mass) / totalInvMass;
          
          nodeA.position.x -= dirX * correctionA;
          nodeA.position.y -= dirY * correctionA;
          nodeB.position.x += dirX * correctionB;
          nodeB.position.y += dirY * correctionB;
        }
      }
    }
  }
  
  // Prevent hexagons from collapsing by maintaining minimum area
  private static enforceAreaConstraints(body: HexSoftBody, dt: number): void {
    for (const cell of body.cells) {
      const currentArea = cell.getArea();
      // Use a reasonable baseline if rest positions aren't available
      const restArea = currentArea > 0 ? Math.max(currentArea, 100) : 100; // Minimum baseline area
      
      if (currentArea < restArea * 0.3) { // If area drops below 30% of rest area
        // Expand the hexagon back toward rest area
        this.expandHexagon(cell, restArea, currentArea);
      }
    }
  }
  
  // Expand a collapsed hexagon
  private static expandHexagon(cell: HexCell, targetArea: number, currentArea: number): void {
    const nodes = cell.nodes; // Use the nodes array directly
    
    // Calculate centroid
    let centroidX = 0;
    let centroidY = 0;
    for (const node of nodes) {
      centroidX += node.position.x;
      centroidY += node.position.y;
    }
    centroidX /= nodes.length;
    centroidY /= nodes.length;
    
    // Scale factor to achieve target area
    const scaleFactor = Math.sqrt(targetArea / Math.max(currentArea, 1e-6));
    const expansionFactor = Math.min(scaleFactor, 1.2); // Limit expansion per frame
    
    // Move nodes away from centroid
    for (const node of nodes) {
      const dx = node.position.x - centroidX;
      const dy = node.position.y - centroidY;
      
      node.position.x = centroidX + dx * expansionFactor;
      node.position.y = centroidY + dy * expansionFactor;
    }
  }
  
  // Prevent springs from stretching too far
  private static enforceMaximumStretch(body: HexSoftBody): void {
    const maxStretchRatio = 2.5; // Maximum stretch allowed
    
    for (const spring of body.springs) {
      const dx = spring.b.position.x - spring.a.position.x;
      const dy = spring.b.position.y - spring.a.position.y;
      const currentLength = Math.sqrt(dx * dx + dy * dy);
      const maxLength = spring.restLength * maxStretchRatio;
      
      if (currentLength > maxLength) {
        // Pull nodes closer together
        const correction = currentLength - maxLength;
        const dirX = dx / currentLength;
        const dirY = dy / currentLength;
        
        // Apply correction proportional to inverse mass
        const totalInvMass = (1 / spring.a.mass) + (1 / spring.b.mass);
        const correctionA = correction * 0.5 * (1 / spring.a.mass) / totalInvMass;
        const correctionB = correction * 0.5 * (1 / spring.b.mass) / totalInvMass;
        
        spring.a.position.x += dirX * correctionA;
        spring.a.position.y += dirY * correctionA;
        spring.b.position.x -= dirX * correctionB;
        spring.b.position.y -= dirY * correctionB;
      }
    }
  }
}
