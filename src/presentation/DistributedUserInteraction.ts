import { PointMass2D } from '../domain/PointMass2D';
import { HexCell } from '../domain/HexCell';
import { VolumeConstraint2D } from '../domain/constraints/VolumeConstraint2D';
import { SIM_CONFIG } from '../config';

// DistributedUserInteraction: Softly drags a node and its neighbors, preserving local area
export class DistributedUserInteraction {
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
    console.log('[INTERACTION-DEBUG][DistributedUserInteraction] applyForce', {
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
    
    // Apply full force to main node in drag direction
    this._applyDirectionalForce(this.mainNode, dragVector, this.strength);
    
    // Apply reduced force to neighbors in the same direction
    for (const n of this.neighborNodes) {
      this._applyDirectionalForce(n, dragVector, this.strength * 0.4); // Increased neighbor influence for more cohesive drag
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
    
    // Apply force realism scaling from config
    const realismScale = SIM_CONFIG.forceRealismScale;
    fx *= realismScale;
    fy *= realismScale;
    
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
    
    // Apply moderate velocity damping during drag to allow some momentum but prevent excessive buildup
    const dampingFactor = this.isReleasing ? 0.85 : 0.9; // Less damping during drag for responsiveness
    node.velocity.x *= dampingFactor;
    node.velocity.y *= dampingFactor;
    
    node.applyForce({ x: fx, y: fy });
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
    
    console.group("🔬 [FORCE ANALYSIS] User Interaction Forces vs. Biological Reality");
    console.log(`📊 Force Statistics (last ${forces.length} samples):`);
    console.log(`   Average: ${avgForce.toFixed(1)} N`);
    console.log(`   Range: ${minForce.toFixed(1)} - ${maxForce.toFixed(1)} N`);
    console.log(`   Closest biological equivalent: ${closestMatch}`);
    console.log(`📏 Biological Force Ranges:`);
    console.log(`   Light touch: 0.5-2 N`);
    console.log(`   Firm press: 5-20 N`);
    console.log(`   Strong press: 20-50 N`);
    console.log(`   Medical palpation: 5-25 N`);
    console.log(`   Surgical manipulation: 50-200 N`);
    
    // Provide scaling recommendations
    if (avgForce > 50) {
      console.log(`💡 Current forces feel like: Medical/surgical manipulation`);
      console.log(`   For realistic finger touch, reduce forces by ${(avgForce / 10).toFixed(1)}x`);
    } else if (avgForce > 20) {
      console.log(`💡 Current forces feel like: Strong finger pressure`);
      console.log(`   For light touch, reduce forces by ${(avgForce / 2).toFixed(1)}x`);
    } else if (avgForce > 5) {
      console.log(`💡 Current forces feel like: Firm finger pressure (realistic!)`);
    } else {
      console.log(`💡 Current forces feel like: Light finger touch (very realistic!)`);
    }
    console.groupEnd();
  }
}
