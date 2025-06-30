import { PointMass2D } from '../domain/PointMass2D';
import { HexCell } from '../domain/HexCell';
import { VolumeConstraint2D } from '../domain/constraints/VolumeConstraint2D';
import { SIM_CONFIG } from '../config';
import { DebugLogger } from '../infrastructure/DebugLogger';

// DistributedUserInteraction: Softly drags a node and its neighbors, preserving local area
export class DistributedUserInteraction {
  // Dynamic force realism scale
  private _forceRealismScale: number = SIM_CONFIG.forceRealismScale;
  setForceRealismScale(val: number) { this._forceRealismScale = val; }
  getForceRealismScale() { return this._forceRealismScale; }
  mainNode: PointMass2D;
  neighborNodes: PointMass2D[];
  target: { x: number; y: number };
  strength: number;
  maxPointerForce: number = 800; // Increased to match spring force magnitude
  areaConstraint: VolumeConstraint2D | null;
  neighborAreaConstraints: VolumeConstraint2D[] = [];
  cell: HexCell | null;
  isReleasing: boolean = false;
  releaseTimer: number = 0;
  releaseDuration: number = 0.25; // Longer release for better momentum dissipation

  // Force analysis tracking for biological realism tuning
  private static forceHistory: number[] = [];
  private static lastForceLog = 0;
  private static readonly FORCE_LOG_INTERVAL = 1000; // Log every 1 second

  constructor(mainNode: PointMass2D, cell: HexCell, target: { x: number; y: number }, strength = 300) { // Much stronger interaction
    this.mainNode = mainNode;
    this.cell = cell;
    this.neighborNodes = cell.nodes.filter(n => n !== mainNode);
    this.target = { ...target };
    this.strength = strength;
    // Stronger area constraint for robust shape preservation
    this.areaConstraint = new VolumeConstraint2D(cell, 5.0); // Reduced slightly to allow more immediate interaction response
    // Add area constraints for all immediate neighbor cells (sharing at least 2 nodes)
    const neighborCells = cell.nodes
      .flatMap(n => n.cellRefs || [])
      .filter(c => c !== cell);
    // Deduplicate
    const uniqueNeighbors = Array.from(new Set(neighborCells));
    this.neighborAreaConstraints = uniqueNeighbors.map(nc => new VolumeConstraint2D(nc, 4.0)); // Reduced for more responsiveness
  }

  /**
   * Returns all active area constraints (main + neighbors) for use in the constraint phase.
   * Note: These are NOT applied during interaction - only returned for global constraint system.
   */
  getActiveAreaConstraints(): VolumeConstraint2D[] {
    const constraints: VolumeConstraint2D[] = [];
    if (this.areaConstraint) constraints.push(this.areaConstraint);
    if (this.neighborAreaConstraints && this.neighborAreaConstraints.length > 0) {
      constraints.push(...this.neighborAreaConstraints);
    }
    return constraints;
  }

  setTarget(target: { x: number; y: number }) {
    this.target = { ...target };
  }

  startRelease() {
    this.isReleasing = true;
    this.releaseTimer = 0;
    
    // Immediately reduce momentum when release starts
    this.mainNode.velocity.x *= 0.3;
    this.mainNode.velocity.y *= 0.3;
    
    // Also dampen neighbor velocities to prevent spring oscillation
    for (const neighbor of this.neighborNodes) {
      neighbor.velocity.x *= 0.5;
      neighbor.velocity.y *= 0.5;
    }
  }

  updateRelease(dt: number): boolean {
    if (!this.isReleasing) return false;
    this.releaseTimer += dt;
    if (this.releaseTimer >= this.releaseDuration) {
      return true;
    }
    return false;
  }

  // Apply distributed directional vector-based drag force
  applyForce() {
    DebugLogger.log('user-interaction', 'applyForce', {
      mainNode: this.mainNode,
      target: this.target,
      strength: this.strength,
      isReleasing: this.isReleasing
    });
    
    // Calculate the drag direction vector from main node to target
    const dragVector = {
      x: this.target.x - this.mainNode.position.x,
      y: this.target.y - this.mainNode.position.y
    };
    
    // Apply stronger force to main node to ensure springs can transmit effectively
    this._applyDirectionalForce(this.mainNode, dragVector, this.strength * 1.2);
    
    // Apply gentle assistance to neighbors to help springs transmit force
    // This supplements spring force rather than replacing it
    for (const neighbor of this.neighborNodes) {
      // Calculate spring extension direction (from neighbor toward main node)
      const springVector = {
        x: this.mainNode.position.x - neighbor.position.x,
        y: this.mainNode.position.y - neighbor.position.y
      };
      
      const dist = Math.sqrt(springVector.x * springVector.x + springVector.y * springVector.y);
      if (dist > 0.01) {
        // Normalize and apply gentle assistance in spring direction
        const normalizedSpring = {
          x: springVector.x / dist,
          y: springVector.y / dist
        };
        
        // Small force to help springs overcome initial inertia
        this._applyDirectionalForce(neighbor, normalizedSpring, this.strength * 0.15);
      }
    }
    
    // Note: Volume preservation is handled by global constraint system, not here
  }

  _applyDirectionalForce(node: PointMass2D, dragVector: { x: number; y: number }, strength: number) {
    // Calculate distance for scaling (optional - for distance-based falloff)
    let distance = Math.sqrt(dragVector.x * dragVector.x + dragVector.y * dragVector.y);
    
    // Clamp maximum distance to prevent extreme forces
    const maxDistance = 40; // Reduced for more stable interaction
    if (distance > maxDistance) {
      const scale = maxDistance / distance;
      dragVector = { x: dragVector.x * scale, y: dragVector.y * scale };
      distance = maxDistance;
    }
    
    // Apply force directly in drag direction with properly scaled force to match spring magnitude
    let fx = dragVector.x * strength * 0.02; // Much stronger force to compete with springs
    let fy = dragVector.y * strength * 0.02;
    
    // Apply force realism scaling (dynamic)
    fx *= this._forceRealismScale;
    fy *= this._forceRealismScale;
    
    // Clamp total force magnitude
    const maxForce = this.maxPointerForce;
    const mag = Math.sqrt(fx * fx + fy * fy);
    if (mag > maxForce) {
      fx = (fx / mag) * maxForce;
      fy = (fy / mag) * maxForce;
    }

    // 🔬 FORCE ANALYSIS: Track force magnitudes for biological realism assessment
    const finalForceMag = Math.sqrt(fx * fx + fy * fy);
    DistributedUserInteraction.forceHistory.push(finalForceMag);
    
    // Keep only recent force samples (last 100 samples)
    if (DistributedUserInteraction.forceHistory.length > 100) {
      DistributedUserInteraction.forceHistory.shift();
    }
    
    // Log force analysis periodically
    const now = Date.now();
    if (now - DistributedUserInteraction.lastForceLog > DistributedUserInteraction.FORCE_LOG_INTERVAL) {
      this.logForceAnalysis();
      DistributedUserInteraction.lastForceLog = now;
    }
    
    // Apply progressive velocity damping during interaction and stronger damping during release
    let dampingFactor: number;
    let forceScale = 1.0;
    
    if (this.isReleasing) {
      // During release: strong damping and reduced force
      const releaseProgress = this.releaseTimer / this.releaseDuration;
      dampingFactor = 0.6 - (releaseProgress * 0.3); // Start at 0.6, reduce to 0.3 (strong damping)
      forceScale = Math.max(0, 1.0 - releaseProgress * 2); // Quickly reduce force to zero
    } else {
      // During active drag: moderate damping for responsiveness
      dampingFactor = 0.92;
    }
    
    node.velocity.x *= dampingFactor;
    node.velocity.y *= dampingFactor;
    
    // Apply scaled force
    node.applyForce({ x: fx * forceScale, y: fy * forceScale });
  }

  /**
   * 🔬 Log force analysis comparing to biological force ranges
   */
  private logForceAnalysis() {
    if (DistributedUserInteraction.forceHistory.length === 0) return;
    
    const forces = DistributedUserInteraction.forceHistory;
    const avgForce = forces.reduce((sum, f) => sum + f, 0) / forces.length;
    const maxForce = Math.max(...forces);
    const minForce = Math.min(...forces);
    
    // Biological force ranges for comparison (in Newtons)
    const bioRanges = {
      lightTouch: { min: 0.5, max: 2, name: "Light finger touch" },
      firmPress: { min: 5, max: 20, name: "Firm finger press" },
      strongPress: { min: 20, max: 50, name: "Strong finger press" },
      medicalPalpation: { min: 5, max: 25, name: "Medical palpation" },
      surgicalManip: { min: 50, max: 200, name: "Surgical manipulation" }
    };
    
    // Find closest biological equivalent
    let closestMatch = "Unknown";
    let closestDistance = Infinity;
    
    for (const [key, range] of Object.entries(bioRanges)) {
      const rangeCenter = (range.min + range.max) / 2;
      const distance = Math.abs(avgForce - rangeCenter);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestMatch = range.name;
      }
    }
    
    DebugLogger.log('user-interaction', 'Force Statistics', {
      count: forces.length,
      avg: avgForce,
      min: minForce,
      max: maxForce,
      closestMatch
    });
    DebugLogger.log('user-interaction', 'Biological Force Ranges', {
      light: '0.5-2 N',
      firm: '5-20 N',
      strong: '20-50 N',
      palpation: '5-25 N',
      surgical: '50-200 N'
    });
    if (avgForce > 50) {
      DebugLogger.log('user-interaction', 'Current forces feel like: Medical/surgical manipulation', { avgForce });
      DebugLogger.log('user-interaction', 'For realistic finger touch, reduce forces', { factor: (avgForce / 10).toFixed(1) });
    } else if (avgForce > 20) {
      DebugLogger.log('user-interaction', 'Current forces feel like: Strong finger pressure', { avgForce });
      DebugLogger.log('user-interaction', 'For light touch, reduce forces', { factor: (avgForce / 2).toFixed(1) });
    } else if (avgForce > 5) {
      DebugLogger.log('user-interaction', 'Current forces feel like: Firm finger pressure (realistic!)', { avgForce });
    } else {
      DebugLogger.log('user-interaction', 'Current forces feel like: Light finger touch (very realistic!)', { avgForce });
    }
  }
}
