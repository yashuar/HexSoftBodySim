// BoundaryShapePreserver: Adaptive volume and shape preservation for boundary hexagons
// Implements techniques from cloth simulation and soft body physics to maintain cell integrity
// Uses distance constraints, area preservation, and angle preservation to keep hexagons well-formed

import { HexCell } from '../HexCell';
import { PointMass2D } from '../PointMass2D';
import { HexSoftBody } from '../HexSoftBody';

interface ShapeConstraint {
  type: 'distance' | 'area' | 'angle';
  nodes: PointMass2D[];
  targetValue: number;
  stiffness: number;
  importance: number; // 0-1, how critical this constraint is
}

interface BoundaryAnalysis {
  isBoundaryCell: boolean;
  boundaryEdges: number; // How many edges are on boundary
  deformationLevel: number; // 0-1, how deformed the cell is
  criticalNodes: PointMass2D[]; // Nodes that need shape preservation
}

export class BoundaryShapePreserver {
  private shapeConstraints: Map<HexCell, ShapeConstraint[]> = new Map();
  private boundaryAnalysis: Map<HexCell, BoundaryAnalysis> = new Map();
  
  // Shape preservation parameters (reduced aggressiveness to prevent overcompensation)
  private readonly distanceConstraintStiffness = 0.3; // Reduced from 0.8
  private readonly areaConstraintStiffness = 0.2; // Reduced from 0.6
  private readonly angleConstraintStiffness = 0.1; // Reduced from 0.4
  private readonly maxDeformationRatio = 2.2; // Increased tolerance from 1.8
  private readonly minAreaRatio = 0.3; // Reduced from 0.4 (more tolerant)
  private readonly maxForcePerNode = 5.0; // NEW: Cap force magnitude to prevent overcompensation
  
  constructor() {
    console.log('[BoundaryShapePreserver] Initialized adaptive shape preservation for boundary cells');
  }
  
  /**
   * Main processing function - call this after forces are applied but before integration
   */
  preserveBoundaryShapes(bodies: HexSoftBody[], dt: number): void {
    for (const body of bodies) {
      // 1. Analyze which cells are on boundaries and how deformed they are
      this.analyzeBoundaryCells(body);
      
      // 2. Create/update shape constraints for boundary cells
      this.updateShapeConstraints(body);
      
      // 3. Apply shape preservation forces
      this.applyShapePreservationForces(body, dt);
    }
  }
  
  /**
   * Analyze cells to determine boundary status and deformation level
   */
  private analyzeBoundaryCells(body: HexSoftBody): void {
    const canvasWidth = window?.innerWidth || 1920;
    const canvasHeight = window?.innerHeight || 1080;
    const boundaryMargin = 150; // Distance from edge to consider "boundary"
    
    for (const cell of body.cells) {
      const centroid = cell.getCentroid();
      const currentArea = cell.getArea();
      
      // Check if cell is near boundaries
      const nearLeft = centroid.x < boundaryMargin;
      const nearRight = centroid.x > canvasWidth - boundaryMargin;
      const nearTop = centroid.y < boundaryMargin;
      const nearBottom = centroid.y > canvasHeight - boundaryMargin;
      
      const isBoundaryCell = nearLeft || nearRight || nearTop || nearBottom;
      let boundaryEdges = 0;
      if (nearLeft) boundaryEdges++;
      if (nearRight) boundaryEdges++;
      if (nearTop) boundaryEdges++;
      if (nearBottom) boundaryEdges++;
      
      // Calculate deformation level
      let deformationLevel = 0;
      const criticalNodes: PointMass2D[] = [];
      
      if (isBoundaryCell) {
        // Check edge length deformation
        let maxStretchRatio = 0;
        let minAreaRatio = 1;
        
        // Check distances between adjacent nodes
        for (let i = 0; i < 6; i++) {
          const nodeA = cell.nodes[i];
          const nodeB = cell.nodes[(i + 1) % 6];
          const dx = nodeB.position.x - nodeA.position.x;
          const dy = nodeB.position.y - nodeA.position.y;
          const currentDist = Math.sqrt(dx * dx + dy * dy);
          
          // Estimate expected edge length (assuming regular hexagon)
          const expectedEdgeLength = Math.sqrt(currentArea * 2 / (3 * Math.sqrt(3))) || 20;
          const stretchRatio = currentDist / expectedEdgeLength;
          
          if (stretchRatio > this.maxDeformationRatio || stretchRatio < 1/this.maxDeformationRatio) {
            maxStretchRatio = Math.max(maxStretchRatio, Math.abs(stretchRatio - 1));
            criticalNodes.push(nodeA, nodeB);
          }
        }
        
        // Check area deformation
        const restArea = this.estimateRestArea(cell);
        if (restArea > 0) {
          minAreaRatio = currentArea / restArea;
          if (minAreaRatio < this.minAreaRatio) {
            deformationLevel = Math.max(deformationLevel, 1 - minAreaRatio);
          }
        }
        
        deformationLevel = Math.max(deformationLevel, maxStretchRatio);
      }
      
      this.boundaryAnalysis.set(cell, {
        isBoundaryCell,
        boundaryEdges,
        deformationLevel: Math.min(deformationLevel, 1),
        criticalNodes: [...new Set(criticalNodes)] // Remove duplicates
      });
    }
  }
  
  /**
   * Create or update shape constraints for cells that need preservation
   */
  private updateShapeConstraints(body: HexSoftBody): void {
    for (const cell of body.cells) {
      const analysis = this.boundaryAnalysis.get(cell);
      // Increased threshold - only apply to significantly deformed cells
      if (!analysis || !analysis.isBoundaryCell || analysis.deformationLevel < 0.3) {
        // Remove constraints for cells that don't need them
        this.shapeConstraints.delete(cell);
        continue;
      }
      
      const constraints: ShapeConstraint[] = [];
      const currentArea = cell.getArea();
      const restArea = this.estimateRestArea(cell);
      
      // Only add distance constraints for severely deformed cells
      if (analysis.deformationLevel > 0.5) {
        // 1. Distance constraints (preserve edge lengths) - only for critical edges
        for (let i = 0; i < 6; i++) {
          const nodeA = cell.nodes[i];
          const nodeB = cell.nodes[(i + 1) % 6];
          
          // Check if this edge is actually problematic
          const dx = nodeB.position.x - nodeA.position.x;
          const dy = nodeB.position.y - nodeA.position.y;
          const currentDist = Math.sqrt(dx * dx + dy * dy);
          const expectedEdgeLength = Math.sqrt(currentArea * 2 / (3 * Math.sqrt(3))) || 20;
          const stretchRatio = currentDist / expectedEdgeLength;
          
          // Only constrain edges that are significantly over/under-stretched
          if (stretchRatio > 1.5 || stretchRatio < 0.7) {
            constraints.push({
              type: 'distance',
              nodes: [nodeA, nodeB],
              targetValue: expectedEdgeLength,
              stiffness: this.distanceConstraintStiffness * (analysis.deformationLevel - 0.3), // Reduced strength
              importance: (analysis.deformationLevel - 0.3) * 0.5 // Reduced importance
            });
          }
        }
      }
      
      // Only add area constraint for severely collapsed cells
      if (restArea > 0 && analysis.deformationLevel > 0.4) {
        const areaRatio = currentArea / restArea;
        if (areaRatio < 0.6 || areaRatio > 1.4) { // Only if significantly different
          constraints.push({
            type: 'area',
            nodes: [...cell.nodes],
            targetValue: restArea,
            stiffness: this.areaConstraintStiffness * (analysis.deformationLevel - 0.3),
            importance: (analysis.deformationLevel - 0.3) * 0.3
          });
        }
      }
      
      // Only store constraints if we actually have any
      if (constraints.length > 0) {
        this.shapeConstraints.set(cell, constraints);
      } else {
        this.shapeConstraints.delete(cell);
      }
    }
  }
  
  /**
   * Apply shape preservation forces based on constraints (with connectivity awareness)
   */
  private applyShapePreservationForces(body: HexSoftBody, dt: number): void {
    // Track forces applied to each node to prevent overcompensation
    const nodeForces = new Map<PointMass2D, { x: number; y: number; count: number }>();
    
    for (const [cell, constraints] of this.shapeConstraints) {
      const analysis = this.boundaryAnalysis.get(cell);
      if (!analysis) continue;
      
      // Reduce force for cells with many boundary edges (they're more constrained)
      const connectivityReduction = Math.max(0.3, 1.0 - (analysis.boundaryEdges - 1) * 0.3);
      
      for (const constraint of constraints) {
        const forceScale = constraint.stiffness * constraint.importance * connectivityReduction;
        
        switch (constraint.type) {
          case 'distance':
            this.applyDistanceConstraintGentle(constraint, forceScale, dt, nodeForces);
            break;
          case 'area':
            this.applyAreaConstraintGentle(constraint, forceScale, dt, nodeForces);
            break;
          case 'angle':
            // Skip angle constraints - they're too aggressive
            break;
        }
      }
    }
    
    // Apply accumulated forces with capping to prevent overcompensation
    for (const [node, force] of nodeForces) {
      if (force.count > 1) {
        // Average forces from multiple constraints to prevent accumulation
        force.x /= force.count;
        force.y /= force.count;
      }
      
      // Cap force magnitude
      const forceMag = Math.sqrt(force.x * force.x + force.y * force.y);
      if (forceMag > this.maxForcePerNode) {
        const scale = this.maxForcePerNode / forceMag;
        force.x *= scale;
        force.y *= scale;
      }
      
      node.applyForce({ x: force.x, y: force.y });
    }
  }
  
  /**
   * Apply distance constraint between two nodes (gentle version with force accumulation)
   */
  private applyDistanceConstraintGentle(constraint: ShapeConstraint, forceScale: number, dt: number, nodeForces: Map<PointMass2D, { x: number; y: number; count: number }>): void {
    const [nodeA, nodeB] = constraint.nodes;
    const dx = nodeB.position.x - nodeA.position.x;
    const dy = nodeB.position.y - nodeA.position.y;
    const currentDist = Math.sqrt(dx * dx + dy * dy) || 1e-8;
    const targetDist = constraint.targetValue;
    
    const error = currentDist - targetDist;
    if (Math.abs(error) < 1.0) return; // Increased tolerance from 0.1
    
    const correctionStrength = forceScale * error * 0.2; // Reduced from 0.5
    const dirX = dx / currentDist;
    const dirY = dy / currentDist;
    
    const forceX = dirX * correctionStrength;
    const forceY = dirY * correctionStrength;
    
    // Accumulate forces instead of applying directly
    this.accumulateNodeForce(nodeA, forceX, forceY, nodeForces);
    this.accumulateNodeForce(nodeB, -forceX, -forceY, nodeForces);
  }
  
  /**
   * Apply area preservation constraint (gentle version with force accumulation)
   */
  private applyAreaConstraintGentle(constraint: ShapeConstraint, forceScale: number, dt: number, nodeForces: Map<PointMass2D, { x: number; y: number; count: number }>): void {
    const nodes = constraint.nodes;
    const currentArea = this.calculateArea(nodes);
    const targetArea = constraint.targetValue;
    const areaError = currentArea - targetArea;
    
    if (Math.abs(areaError) < 50) return; // Increased tolerance from 10
    
    // Calculate centroid
    let centroidX = 0, centroidY = 0;
    for (const node of nodes) {
      centroidX += node.position.x;
      centroidY += node.position.y;
    }
    centroidX /= nodes.length;
    centroidY /= nodes.length;
    
    // Apply gentler radial forces
    const correctionFactor = areaError > 0 ? -0.05 : 0.05; // Reduced from 0.1
    const adjustmentForce = forceScale * Math.abs(areaError) * correctionFactor * 0.005; // Reduced from 0.01
    
    for (const node of nodes) {
      const radialX = node.position.x - centroidX;
      const radialY = node.position.y - centroidY;
      const radialDist = Math.sqrt(radialX * radialX + radialY * radialY) || 1e-8;
      
      const forceX = (radialX / radialDist) * adjustmentForce;
      const forceY = (radialY / radialDist) * adjustmentForce;
      
      this.accumulateNodeForce(node, forceX, forceY, nodeForces);
    }
  }
  
  /**
   * Helper to accumulate forces on nodes to prevent double-application
   */
  private accumulateNodeForce(node: PointMass2D, fx: number, fy: number, nodeForces: Map<PointMass2D, { x: number; y: number; count: number }>): void {
    if (!nodeForces.has(node)) {
      nodeForces.set(node, { x: 0, y: 0, count: 0 });
    }
    const force = nodeForces.get(node)!;
    force.x += fx;
    force.y += fy;
    force.count++;
  }
  
  /**
   * Apply area preservation constraint
   */
  private applyAreaConstraint(constraint: ShapeConstraint, forceScale: number, dt: number): void {
    const nodes = constraint.nodes;
    const currentArea = this.calculateArea(nodes);
    const targetArea = constraint.targetValue;
    const areaError = currentArea - targetArea;
    
    if (Math.abs(areaError) < 10) return; // Small area errors are okay
    
    // Calculate centroid
    let centroidX = 0, centroidY = 0;
    for (const node of nodes) {
      centroidX += node.position.x;
      centroidY += node.position.y;
    }
    centroidX /= nodes.length;
    centroidY /= nodes.length;
    
    // Apply radial forces to adjust area
    const correctionFactor = areaError > 0 ? -0.1 : 0.1; // Shrink or expand
    const adjustmentForce = forceScale * Math.abs(areaError) * correctionFactor * 0.01;
    
    for (const node of nodes) {
      const radialX = node.position.x - centroidX;
      const radialY = node.position.y - centroidY;
      const radialDist = Math.sqrt(radialX * radialX + radialY * radialY) || 1e-8;
      
      const forceX = (radialX / radialDist) * adjustmentForce;
      const forceY = (radialY / radialDist) * adjustmentForce;
      
      node.applyForce({ x: forceX, y: forceY });
    }
  }
  
  /**
   * Apply angle preservation constraint
   */
  private applyAngleConstraint(constraint: ShapeConstraint, forceScale: number, dt: number): void {
    const [nodeA, nodeB, nodeC] = constraint.nodes;
    const targetAngle = constraint.targetValue;
    
    // Calculate current angle at nodeB
    const vec1X = nodeA.position.x - nodeB.position.x;
    const vec1Y = nodeA.position.y - nodeB.position.y;
    const vec2X = nodeC.position.x - nodeB.position.x;
    const vec2Y = nodeC.position.y - nodeB.position.y;
    
    const len1 = Math.sqrt(vec1X * vec1X + vec1Y * vec1Y) || 1e-8;
    const len2 = Math.sqrt(vec2X * vec2X + vec2Y * vec2Y) || 1e-8;
    
    const dot = (vec1X * vec2X + vec1Y * vec2Y) / (len1 * len2);
    const currentAngle = Math.acos(Math.max(-1, Math.min(1, dot)));
    
    const angleError = currentAngle - targetAngle;
    if (Math.abs(angleError) < 0.1) return; // Small angle errors are okay
    
    // Apply small corrective forces to adjust angle
    const correctionStrength = forceScale * angleError * 0.05;
    
    // Simplified: just apply small forces perpendicular to current vectors
    const perpX1 = -vec1Y / len1;
    const perpY1 = vec1X / len1;
    const perpX2 = vec2Y / len2;
    const perpY2 = -vec2X / len2;
    
    nodeA.applyForce({ x: perpX1 * correctionStrength, y: perpY1 * correctionStrength });
    nodeC.applyForce({ x: perpX2 * correctionStrength, y: perpY2 * correctionStrength });
  }
  
  /**
   * Calculate area of polygon defined by nodes
   */
  private calculateArea(nodes: PointMass2D[]): number {
    let area = 0;
    for (let i = 0; i < nodes.length; i++) {
      const p1 = nodes[i].position;
      const p2 = nodes[(i + 1) % nodes.length].position;
      area += (p1.x * p2.y - p2.x * p1.y);
    }
    return Math.abs(area) / 2;
  }
  
  /**
   * Estimate rest area for a cell (fallback if rest positions not available)
   */
  private estimateRestArea(cell: HexCell): number {
    if (cell.restPositions && cell.restPositions.length === 6) {
      // Use actual rest area if available
      let area = 0;
      for (let i = 0; i < 6; i++) {
        const p1 = cell.restPositions[i];
        const p2 = cell.restPositions[(i + 1) % 6];
        area += (p1.x * p2.y - p2.x * p1.y);
      }
      return Math.abs(area) / 2;
    }
    
    // Fallback: estimate based on current area but adjusted for typical deformation
    const currentArea = cell.getArea();
    return currentArea * 1.1; // Assume current is slightly compressed
  }
  
  /**
   * Get statistics for debugging
   */
  getShapePreservationStats(): any {
    const stats = {
      totalBoundaryCells: 0,
      cellsWithConstraints: this.shapeConstraints.size,
      averageDeformation: 0,
      maxDeformation: 0,
      totalConstraints: 0
    };
    
    let totalDeformation = 0;
    for (const [cell, analysis] of this.boundaryAnalysis) {
      if (analysis.isBoundaryCell) {
        stats.totalBoundaryCells++;
        totalDeformation += analysis.deformationLevel;
        stats.maxDeformation = Math.max(stats.maxDeformation, analysis.deformationLevel);
      }
    }
    
    if (stats.totalBoundaryCells > 0) {
      stats.averageDeformation = totalDeformation / stats.totalBoundaryCells;
    }
    
    for (const constraints of this.shapeConstraints.values()) {
      stats.totalConstraints += constraints.length;
    }
    
    return stats;
  }
}
