// MeshStabilizer: Global mesh-aware shape preservation and boundary stabilization
// Replaces the localized BoundaryShapePreserver with a mesh-wide approach that considers
// node connectivity across multiple hexagons to prevent "whack-a-mole" effects

import { HexCell } from '../HexCell';
import { PointMass2D } from '../PointMass2D';
import { HexSoftBody } from '../HexSoftBody';

interface NodeConnectivity {
  node: PointMass2D;
  connectedCells: HexCell[];
  isBoundaryNode: boolean;
  boundaryType: 'corner' | 'edge' | 'internal' | 'isolated';
  constraintWeight: number; // How much this node should be constrained
}

interface MeshConstraint {
  type: 'mesh_stability' | 'boundary_preservation' | 'global_shape';
  affectedNodes: PointMass2D[];
  targetPositions?: { x: number; y: number }[];
  strength: number;
  priority: number;
}

interface MeshAnalysis {
  nodeConnectivity: Map<PointMass2D, NodeConnectivity>;
  boundaryNodes: PointMass2D[];
  unstableRegions: { center: { x: number; y: number }; radius: number; severity: number }[];
  meshIntegrity: number; // 0-1, overall mesh health
}

export class MeshStabilizer {
  private meshAnalysis: MeshAnalysis | null = null;
  private meshConstraints: MeshConstraint[] = [];
  private nodeTargetPositions: Map<PointMass2D, { x: number; y: number; confidence: number }> = new Map();
  
  // Stabilization parameters - much gentler than previous approach
  private readonly stabilityThreshold = 0.8; // Only intervene when mesh integrity < 0.8
  private readonly maxStabilizationForce = 3.0; // Reduced from 5.0
  private readonly boundaryPreservationStrength = 0.15; // Gentle boundary preservation
  private readonly globalShapeStrength = 0.1; // Very gentle global shape maintenance
  
  constructor() {
    console.log('[MeshStabilizer] Initialized mesh-wide stability system');
  }
  
  /**
   * Main processing function - analyzes entire mesh and applies coordinated stabilization
   */
  stabilizeMesh(bodies: HexSoftBody[], dt: number): void {
    for (const body of bodies) {
      // 1. Analyze mesh topology and connectivity
      this.analyzeMeshTopology(body);
      
      // 2. Only intervene if mesh integrity is poor
      if (this.meshAnalysis && this.meshAnalysis.meshIntegrity < this.stabilityThreshold) {
        // 3. Generate mesh-wide constraints
        this.generateMeshConstraints(body);
        
        // 4. Solve constraints with global awareness
        this.solveMeshConstraints(dt);
      }
    }
  }
  
  /**
   * Analyze the entire mesh to understand topology and connectivity
   */
  private analyzeMeshTopology(body: HexSoftBody): void {
    const nodeConnectivity = new Map<PointMass2D, NodeConnectivity>();
    const allNodes = new Set<PointMass2D>();
    
    // Build connectivity map
    for (const cell of body.cells) {
      for (const node of cell.nodes) {
        allNodes.add(node);
        
        if (!nodeConnectivity.has(node)) {
          nodeConnectivity.set(node, {
            node,
            connectedCells: [],
            isBoundaryNode: false,
            boundaryType: 'internal',
            constraintWeight: 1.0
          });
        }
        
        const connectivity = nodeConnectivity.get(node)!;
        if (!connectivity.connectedCells.includes(cell)) {
          connectivity.connectedCells.push(cell);
        }
      }
    }
    
    // Determine boundary nodes and types
    const boundaryNodes: PointMass2D[] = [];
    const canvasWidth = window?.innerWidth || 1920;
    const canvasHeight = window?.innerHeight || 1080;
    const boundaryMargin = 100;
    
    for (const [node, connectivity] of nodeConnectivity) {
      // Check if node is near canvas boundaries
      const nearBoundary = 
        node.position.x < boundaryMargin ||
        node.position.x > canvasWidth - boundaryMargin ||
        node.position.y < boundaryMargin ||
        node.position.y > canvasHeight - boundaryMargin;
      
      if (nearBoundary) {
        connectivity.isBoundaryNode = true;
        boundaryNodes.push(node);
        
        // Determine boundary type based on connectivity
        if (connectivity.connectedCells.length === 1) {
          connectivity.boundaryType = 'corner';
          connectivity.constraintWeight = 0.3; // Corner nodes are most flexible
        } else if (connectivity.connectedCells.length === 2) {
          connectivity.boundaryType = 'edge';
          connectivity.constraintWeight = 0.5; // Edge nodes are moderately constrained
        } else {
          connectivity.boundaryType = 'internal';
          connectivity.constraintWeight = 0.8; // Internal boundary nodes are more constrained
        }
      } else {
        // Internal nodes with many connections should be more stable
        connectivity.constraintWeight = Math.min(1.0, connectivity.connectedCells.length / 3.0);
      }
    }
    
    // Detect unstable regions
    const unstableRegions = this.detectUnstableRegions(body, nodeConnectivity);
    
    // Calculate overall mesh integrity
    const meshIntegrity = this.calculateMeshIntegrity(body, nodeConnectivity, unstableRegions);
    
    this.meshAnalysis = {
      nodeConnectivity,
      boundaryNodes,
      unstableRegions,
      meshIntegrity
    };
  }
  
  /**
   * Detect regions of the mesh that are unstable or severely deformed
   */
  private detectUnstableRegions(body: HexSoftBody, nodeConnectivity: Map<PointMass2D, NodeConnectivity>): { center: { x: number; y: number }; radius: number; severity: number }[] {
    const unstableRegions: { center: { x: number; y: number }; radius: number; severity: number }[] = [];
    
    for (const cell of body.cells) {
      const centroid = cell.getCentroid();
      const currentArea = cell.getArea();
      const restArea = this.estimateRestArea(cell);
      
      // Check for severe deformation
      let severity = 0;
      
      // Area deformation
      if (restArea > 0) {
        const areaRatio = currentArea / restArea;
        if (areaRatio < 0.5 || areaRatio > 2.0) {
          severity += Math.abs(Math.log(areaRatio));
        }
      }
      
      // Edge length deformation
      let maxEdgeDeformation = 0;
      for (let i = 0; i < 6; i++) {
        const nodeA = cell.nodes[i];
        const nodeB = cell.nodes[(i + 1) % 6];
        const dx = nodeB.position.x - nodeA.position.x;
        const dy = nodeB.position.y - nodeA.position.y;
        const currentDist = Math.sqrt(dx * dx + dy * dy);
        const expectedDist = Math.sqrt(restArea * 2 / (3 * Math.sqrt(3))) || 20;
        const stretchRatio = currentDist / expectedDist;
        maxEdgeDeformation = Math.max(maxEdgeDeformation, Math.abs(Math.log(stretchRatio)));
      }
      severity += maxEdgeDeformation;
      
      // If severity is high enough, mark as unstable region
      if (severity > 0.5) {
        unstableRegions.push({
          center: centroid,
          radius: Math.sqrt(currentArea / Math.PI) * 1.5, // Approximate influence radius
          severity: Math.min(severity, 2.0) // Cap severity
        });
      }
    }
    
    return unstableRegions;
  }
  
  /**
   * Calculate overall mesh integrity (0 = broken, 1 = perfect)
   */
  private calculateMeshIntegrity(body: HexSoftBody, nodeConnectivity: Map<PointMass2D, NodeConnectivity>, unstableRegions: any[]): number {
    let totalDeformation = 0;
    let cellCount = 0;
    
    for (const cell of body.cells) {
      const currentArea = cell.getArea();
      const restArea = this.estimateRestArea(cell);
      
      if (restArea > 0) {
        const areaRatio = currentArea / restArea;
        const areaDeformation = Math.abs(Math.log(areaRatio));
        totalDeformation += areaDeformation;
        cellCount++;
      }
    }
    
    const averageDeformation = cellCount > 0 ? totalDeformation / cellCount : 0;
    const unstabilityPenalty = unstableRegions.length * 0.1;
    
    return Math.max(0, 1.0 - averageDeformation - unstabilityPenalty);
  }
  
  /**
   * Generate mesh-wide constraints based on analysis
   */
  private generateMeshConstraints(body: HexSoftBody): void {
    this.meshConstraints = [];
    this.nodeTargetPositions.clear();
    
    if (!this.meshAnalysis) return;
    
    // 1. Boundary preservation constraints - very gentle
    this.generateBoundaryConstraints();
    
    // 2. Regional stability constraints for unstable areas
    this.generateRegionalStabilityConstraints(body);
    
    // 3. Global shape maintenance (only if severely deformed)
    if (this.meshAnalysis.meshIntegrity < 0.6) {
      this.generateGlobalShapeConstraints(body);
    }
  }
  
  /**
   * Generate gentle boundary preservation constraints
   */
  private generateBoundaryConstraints(): void {
    if (!this.meshAnalysis) return;
    
    const boundaryTargets: PointMass2D[] = [];
    const targetPositions: { x: number; y: number }[] = [];
    
    for (const node of this.meshAnalysis.boundaryNodes) {
      const connectivity = this.meshAnalysis.nodeConnectivity.get(node);
      if (!connectivity || connectivity.boundaryType === 'corner') continue; // Skip corner nodes
      
      // Calculate a "relaxed" target position based on connected cells
      const targetPos = this.calculateRelaxedPosition(node, connectivity);
      if (targetPos) {
        boundaryTargets.push(node);
        targetPositions.push(targetPos);
        this.nodeTargetPositions.set(node, { ...targetPos, confidence: 0.7 });
      }
    }
    
    if (boundaryTargets.length > 0) {
      this.meshConstraints.push({
        type: 'boundary_preservation',
        affectedNodes: boundaryTargets,
        targetPositions,
        strength: this.boundaryPreservationStrength,
        priority: 2
      });
    }
  }
  
  /**
   * Calculate a relaxed target position for a node based on its connectivity
   */
  private calculateRelaxedPosition(node: PointMass2D, connectivity: NodeConnectivity): { x: number; y: number } | null {
    if (connectivity.connectedCells.length < 2) return null;
    
    // Calculate the "ideal" position based on connected cell centroids
    let idealX = 0, idealY = 0;
    let validCells = 0;
    
    for (const cell of connectivity.connectedCells) {
      const centroid = cell.getCentroid();
      const restArea = this.estimateRestArea(cell);
      
      if (restArea > 0) {
        // Find this node's position in the cell and calculate ideal position
        const nodeIndex = cell.nodes.indexOf(node);
        if (nodeIndex >= 0) {
          const expectedRadius = Math.sqrt(restArea / (6 * Math.sin(Math.PI / 3) / 2));
          const angle = (nodeIndex * Math.PI) / 3;
          
          idealX += centroid.x + expectedRadius * Math.cos(angle);
          idealY += centroid.y + expectedRadius * Math.sin(angle);
          validCells++;
        }
      }
    }
    
    if (validCells === 0) return null;
    
    idealX /= validCells;
    idealY /= validCells;
    
    // Blend with current position for gentle correction
    const blendFactor = 0.1; // Very gentle
    return {
      x: node.position.x * (1 - blendFactor) + idealX * blendFactor,
      y: node.position.y * (1 - blendFactor) + idealY * blendFactor
    };
  }
  
  /**
   * Generate constraints for unstable regions
   */
  private generateRegionalStabilityConstraints(body: HexSoftBody): void {
    if (!this.meshAnalysis) return;
    
    for (const region of this.meshAnalysis.unstableRegions) {
      const affectedNodes: PointMass2D[] = [];
      const targetPositions: { x: number; y: number }[] = [];
      
      // Find nodes within the unstable region
      for (const [node, connectivity] of this.meshAnalysis.nodeConnectivity) {
        const dx = node.position.x - region.center.x;
        const dy = node.position.y - region.center.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance <= region.radius) {
          const relaxedPos = this.calculateRelaxedPosition(node, connectivity);
          if (relaxedPos) {
            affectedNodes.push(node);
            targetPositions.push(relaxedPos);
          }
        }
      }
      
      if (affectedNodes.length > 0) {
        this.meshConstraints.push({
          type: 'mesh_stability',
          affectedNodes,
          targetPositions,
          strength: Math.min(0.2, region.severity * 0.1), // Very gentle even for severe deformation
          priority: 3
        });
      }
    }
  }
  
  /**
   * Generate global shape constraints (only for severely deformed meshes)
   */
  private generateGlobalShapeConstraints(body: HexSoftBody): void {
    // Only apply very gentle global constraints to prevent total collapse
    const allNodes: PointMass2D[] = [];
    const targetPositions: { x: number; y: number }[] = [];
    
    for (const cell of body.cells) {
      for (const node of cell.nodes) {
        if (!allNodes.includes(node)) {
          const connectivity = this.meshAnalysis?.nodeConnectivity.get(node);
          if (connectivity) {
            const relaxedPos = this.calculateRelaxedPosition(node, connectivity);
            if (relaxedPos) {
              allNodes.push(node);
              targetPositions.push(relaxedPos);
            }
          }
        }
      }
    }
    
    if (allNodes.length > 0) {
      this.meshConstraints.push({
        type: 'global_shape',
        affectedNodes: allNodes,
        targetPositions,
        strength: this.globalShapeStrength,
        priority: 1
      });
    }
  }
  
  /**
   * Solve all mesh constraints with awareness of interactions
   */
  private solveMeshConstraints(dt: number): void {
    // Sort constraints by priority (lower number = higher priority)
    this.meshConstraints.sort((a, b) => a.priority - b.priority);
    
    // Track total forces per node to prevent overcompensation
    const nodeForces = new Map<PointMass2D, { x: number; y: number; constraintCount: number }>();
    
    for (const constraint of this.meshConstraints) {
      this.applyMeshConstraint(constraint, dt, nodeForces);
    }
    
    // Apply accumulated forces with global force limiting
    for (const [node, force] of nodeForces) {
      // Average forces from multiple constraints
      if (force.constraintCount > 1) {
        force.x /= force.constraintCount;
        force.y /= force.constraintCount;
      }
      
      // Global force limiting
      const forceMag = Math.sqrt(force.x * force.x + force.y * force.y);
      if (forceMag > this.maxStabilizationForce) {
        const scale = this.maxStabilizationForce / forceMag;
        force.x *= scale;
        force.y *= scale;
      }
      
      // Apply the final force
      node.applyForce({ x: force.x, y: force.y });
    }
  }
  
  /**
   * Apply a single mesh constraint
   */
  private applyMeshConstraint(constraint: MeshConstraint, dt: number, nodeForces: Map<PointMass2D, { x: number; y: number; constraintCount: number }>): void {
    if (!constraint.targetPositions || constraint.targetPositions.length !== constraint.affectedNodes.length) {
      return;
    }
    
    for (let i = 0; i < constraint.affectedNodes.length; i++) {
      const node = constraint.affectedNodes[i];
      const target = constraint.targetPositions[i];
      
      const dx = target.x - node.position.x;
      const dy = target.y - node.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < 1.0) continue; // Skip very small corrections
      
      const forceX = dx * constraint.strength;
      const forceY = dy * constraint.strength;
      
      // Accumulate force
      if (!nodeForces.has(node)) {
        nodeForces.set(node, { x: 0, y: 0, constraintCount: 0 });
      }
      const force = nodeForces.get(node)!;
      force.x += forceX;
      force.y += forceY;
      force.constraintCount++;
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
    
    const currentArea = cell.getArea();
    return currentArea * 1.1; // Assume slight compression
  }
  
  /**
   * Get detailed statistics for debugging
   */
  getMeshStabilizationStats(): any {
    if (!this.meshAnalysis) {
      return { meshIntegrity: 1.0, message: 'No analysis available' };
    }
    
    return {
      meshIntegrity: this.meshAnalysis.meshIntegrity,
      boundaryNodeCount: this.meshAnalysis.boundaryNodes.length,
      unstableRegionCount: this.meshAnalysis.unstableRegions.length,
      activeConstraints: this.meshConstraints.length,
      targetPositions: this.nodeTargetPositions.size,
      stabilizationActive: this.meshAnalysis.meshIntegrity < this.stabilityThreshold
    };
  }
}
