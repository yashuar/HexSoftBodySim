// HexagonShapeEnforcer: Prevents node folding and maintains hexagon integrity
// Implements immediate repelling forces when nodes get too close and adaptive spring strengthening

import { HexCell } from '../HexCell';
import { PointMass2D } from '../PointMass2D';
import { HexSoftBody } from '../HexSoftBody';

export class HexagonShapeEnforcer {
  // Shape enforcement parameters - MORE AGGRESSIVE
  private readonly minNodeDistance = 15.0; // Increased minimum distance between nodes in same hexagon
  private readonly repellingForceStrength = 50.0; // Much stronger repelling force
  private readonly criticalDistanceThreshold = 20.0; // Higher distance at which to start repelling
  
  // Diagonal node repelling (for nodes that aren't directly connected by springs)
  private readonly diagonalMinDistance = 25.0; // Increased minimum distance between diagonal nodes
  private readonly diagonalRepellingStrength = 30.0; // Stronger diagonal repelling
  
  constructor() {
    console.log('[HexagonShapeEnforcer] Initialized shape enforcement with node collision avoidance');
  }
  
  /**
   * Main enforcement function - prevents node folding and maintains shape
   */
  enforceHexagonShapes(bodies: HexSoftBody[], dt: number): void {
    console.log(`[HexagonShapeEnforcer] Processing ${bodies.length} bodies with ${bodies.reduce((sum, b) => sum + b.cells.length, 0)} total cells`);
    
    for (const body of bodies) {
      for (const cell of body.cells) {
        // 1. Prevent node-to-node collisions within the hexagon
        this.preventNodeCollisions(cell, dt);
        
        // 2. Prevent diagonal node collisions (nodes that skip one in between)
        this.preventDiagonalCollisions(cell, dt);
        
        // 3. Maintain minimum area to prevent total collapse
        this.maintainMinimumArea(cell, dt);
      }
    }
  }
  
  /**
   * Prevent adjacent and nearby nodes from getting too close
   */
  private preventNodeCollisions(cell: HexCell, dt: number): void {
    const nodes = cell.nodes;
    
    // Check all pairs of nodes for proximity
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const nodeA = nodes[i];
        const nodeB = nodes[j];
        
        const dx = nodeB.position.x - nodeA.position.x;
        const dy = nodeB.position.y - nodeA.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Determine minimum distance based on node relationship
        let minDist = this.minNodeDistance;
        let repelStrength = this.repellingForceStrength;
        
        // Adjacent nodes (connected by springs) need different handling
        const isAdjacent = Math.abs(i - j) === 1 || (i === 0 && j === nodes.length - 1);
        
        if (isAdjacent) {
          // Adjacent nodes - prevent folding but allow closer approach
          minDist = this.minNodeDistance * 0.7;
          repelStrength = this.repellingForceStrength * 1.5; // Stronger for adjacent
        } else {
          // Non-adjacent nodes - maintain larger separation
          minDist = this.diagonalMinDistance;
          repelStrength = this.diagonalRepellingStrength;
        }
        
        // Apply repelling force if too close
        if (distance < minDist && distance > 0.1) {
          console.log(`[HexagonShapeEnforcer] Node collision detected: distance=${distance.toFixed(1)}, minDist=${minDist.toFixed(1)}, isAdjacent=${isAdjacent}`);
          
          const overlap = minDist - distance;
          const forceScale = repelStrength * overlap / minDist;
          
          // Unit vector pointing from A to B
          const dirX = dx / distance;
          const dirY = dy / distance;
          
          // Calculate repelling forces
          const forceX = dirX * forceScale;
          const forceY = dirY * forceScale;
          
          // Apply forces (A gets pushed away from B, B gets pushed away from A)
          nodeA.applyForce({ x: -forceX, y: -forceY });
          nodeB.applyForce({ x: forceX, y: forceY });
          
          // Add some damping to prevent oscillation
          const relativeVelX = nodeB.velocity.x - nodeA.velocity.x;
          const relativeVelY = nodeB.velocity.y - nodeA.velocity.y;
          const dampingForce = 0.5;
          
          nodeA.applyForce({ x: relativeVelX * dampingForce, y: relativeVelY * dampingForce });
          nodeB.applyForce({ x: -relativeVelX * dampingForce, y: -relativeVelY * dampingForce });
        }
      }
    }
  }
  
  /**
   * Prevent diagonal nodes (nodes that are 2 positions apart) from colliding
   */
  private preventDiagonalCollisions(cell: HexCell, dt: number): void {
    const nodes = cell.nodes;
    
    // Check diagonal pairs (nodes that are 2 apart in the hexagon)
    for (let i = 0; i < nodes.length; i++) {
      const diagonalIndex = (i + 2) % nodes.length;
      const nodeA = nodes[i];
      const nodeB = nodes[diagonalIndex];
      
      const dx = nodeB.position.x - nodeA.position.x;
      const dy = nodeB.position.y - nodeA.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // Diagonal nodes should maintain larger minimum distance
      const minDiagonalDist = this.diagonalMinDistance;
      
      if (distance < minDiagonalDist && distance > 0.1) {
        const overlap = minDiagonalDist - distance;
        const forceScale = this.diagonalRepellingStrength * overlap / minDiagonalDist;
        
        const dirX = dx / distance;
        const dirY = dy / distance;
        
        const forceX = dirX * forceScale;
        const forceY = dirY * forceScale;
        
        nodeA.applyForce({ x: -forceX, y: -forceY });
        nodeB.applyForce({ x: forceX, y: forceY });
      }
    }
  }
  
  /**
   * Maintain minimum area to prevent total hexagon collapse
   */
  private maintainMinimumArea(cell: HexCell, dt: number): void {
    const currentArea = cell.getArea();
    const restArea = this.estimateRestArea(cell);
    
    if (restArea > 0) {
      const areaRatio = currentArea / restArea;
      
      // If area is too small, apply outward forces from centroid
      if (areaRatio < 0.25) { // Less than 25% of rest area
        const centroid = cell.getCentroid();
        const expansionForce = 8.0 * (0.25 - areaRatio); // Stronger force for smaller areas
        
        for (const node of cell.nodes) {
          const dx = node.position.x - centroid.x;
          const dy = node.position.y - centroid.y;
          const distance = Math.sqrt(dx * dx + dy * dy) || 1e-8;
          
          // Apply outward force
          const forceX = (dx / distance) * expansionForce;
          const forceY = (dy / distance) * expansionForce;
          
          node.applyForce({ x: forceX, y: forceY });
        }
      }
    }
  }
  
  /**
   * Estimate rest area for a cell
   */
  private estimateRestArea(cell: HexCell): number {
    if (cell.restPositions && cell.restPositions.length === 6) {
      let area = 0;
      for (let i = 0; i < 6; i++) {
        const p1 = cell.restPositions[i];
        const p2 = cell.restPositions[(i + 1) % 6];
        area += (p1.x * p2.y - p2.x * p1.y);
      }
      return Math.abs(area) / 2;
    }
    
    // Fallback: estimate based on current area
    const currentArea = cell.getArea();
    return currentArea * 1.2; // Assume current is somewhat compressed
  }
  
  /**
   * Get debugging statistics
   */
  getEnforcementStats(bodies: HexSoftBody[]): any {
    let totalCells = 0;
    let cellsWithCloseNodes = 0;
    let minimumDistance = Infinity;
    let averageDistance = 0;
    let distanceCount = 0;
    
    for (const body of bodies) {
      for (const cell of body.cells) {
        totalCells++;
        let hasCloseNodes = false;
        
        // Check all node pairs
        for (let i = 0; i < cell.nodes.length; i++) {
          for (let j = i + 1; j < cell.nodes.length; j++) {
            const nodeA = cell.nodes[i];
            const nodeB = cell.nodes[j];
            
            const dx = nodeB.position.x - nodeA.position.x;
            const dy = nodeB.position.y - nodeA.position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            minimumDistance = Math.min(minimumDistance, distance);
            averageDistance += distance;
            distanceCount++;
            
            if (distance < this.criticalDistanceThreshold) {
              hasCloseNodes = true;
            }
          }
        }
        
        if (hasCloseNodes) {
          cellsWithCloseNodes++;
        }
      }
    }
    
    return {
      totalCells,
      cellsWithCloseNodes,
      minimumNodeDistance: minimumDistance === Infinity ? 0 : minimumDistance,
      averageNodeDistance: distanceCount > 0 ? averageDistance / distanceCount : 0,
      percentageWithCloseNodes: totalCells > 0 ? (cellsWithCloseNodes / totalCells) * 100 : 0
    };
  }
}
