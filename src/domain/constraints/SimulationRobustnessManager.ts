// SimulationRobustnessManager: Advanced techniques adapted from Box2D, Matter.js, and XPBD
// Implements proven stability and robustness techniques for soft-body physics simulation

import { PointMass2D } from '../PointMass2D';
import { Spring2D } from '../Spring2D';
import { HexCell } from '../HexCell';
import { HexSoftBody } from '../HexSoftBody';
import { SIM_CONFIG } from '../../config';

// Warm starting technique from Box2D - reuse impulses from previous frame
interface WarmStartCache {
  impulse: { x: number; y: number };
  lambda: number; // Lagrange multiplier from previous frame
  timestamp: number;
}

// Sub-stepping technique from high-end physics engines
interface SubStepState {
  originalPositions: Array<{ x: number; y: number }>;
  originalVelocities: Array<{ x: number; y: number }>;
  stepCount: number;
  maxSteps: number;
}

// Energy tracking and conservation (Bullet Physics approach)
interface EnergyState {
  kinetic: number;
  potential: number;
  dissipated: number;
  total: number;
  timestamp: number;
}

// Boundary stabilization using soft constraints (XPBD approach)
interface BoundaryConstraint {
  node: PointMass2D;
  targetPosition: { x: number; y: number };
  compliance: number; // Softness of the constraint
  active: boolean;
}

export class SimulationRobustnessManager {
  private warmStartCache = new Map<string, WarmStartCache>();
  private energyHistory: EnergyState[] = [];
  private boundaryConstraints: BoundaryConstraint[] = [];
  private subStepState: SubStepState | null = null;
  
  // Box2D-inspired parameters
  private readonly warmStartingFactor = 0.8; // How much to reuse previous impulses
  private readonly energyThreshold = 1.2; // Energy increase limit before intervention
  private readonly maxSubSteps = 4; // Maximum sub-steps per frame
  private readonly boundaryCompliance = 1e-6; // Boundary constraint softness
  
  // Matter.js-inspired constraint stabilization
  private readonly positionIterations = 3;
  private readonly velocityIterations = 6;
  private readonly constraintStiffness = 0.7;
  
  constructor() {
    console.log('[SimulationRobustnessManager] Initialized with advanced stability techniques');
  }
  
  /**
   * Main robustness processing - call this before simulation step
   * Implements multiple proven techniques in sequence
   */
  processFrame(bodies: HexSoftBody[], dt: number): { modifiedDt: number; requiresSubStepping: boolean } {
    const energy = this.calculateSystemEnergy(bodies);
    this.energyHistory.push(energy);
    
    // Keep energy history manageable
    if (this.energyHistory.length > 60) { // 1 second at 60fps
      this.energyHistory.shift();
    }
    
    // 1. Energy explosion detection (Bullet Physics technique)
    const energyGrowth = this.detectEnergyExplosion();
    
    // 2. Determine if sub-stepping is needed
    const requiresSubStepping = energyGrowth > this.energyThreshold || dt > SIM_CONFIG.maxTimestep;
    
    // 3. Adaptive timestep based on system state
    let modifiedDt = dt;
    if (energyGrowth > 1.1) {
      modifiedDt = dt * 0.5; // Halve timestep for stability
      console.warn('[SimulationRobustnessManager] Reducing timestep due to energy growth', {
        energyGrowth,
        originalDt: dt,
        modifiedDt
      });
    }
    
    // 4. Apply warm starting for springs
    this.applyWarmStarting(bodies);
    
    // 5. Setup boundary stabilization
    this.updateBoundaryConstraints(bodies);
    
    return { modifiedDt, requiresSubStepping };
  }
  
  /**
   * Sub-stepping implementation (Box2D/Bullet approach)
   * Breaks large timesteps into smaller, stable steps
   */
  executeSubStepping(bodies: HexSoftBody[], dt: number, stepFunction: (bodies: HexSoftBody[], subDt: number) => void): void {
    const targetSteps = Math.min(Math.ceil(dt / SIM_CONFIG.maxTimestep), this.maxSubSteps);
    const subDt = dt / targetSteps;
    
    console.log('[SimulationRobustnessManager] Sub-stepping', { dt, targetSteps, subDt });
    
    // Store initial state for potential rollback
    this.subStepState = {
      originalPositions: bodies.flatMap(body => body.nodes.map(n => ({ ...n.position }))),
      originalVelocities: bodies.flatMap(body => body.nodes.map(n => ({ ...n.velocity }))),
      stepCount: 0,
      maxSteps: targetSteps
    };
    
    for (let step = 0; step < targetSteps; step++) {
      this.subStepState.stepCount = step;
      
      // Execute one sub-step
      stepFunction(bodies, subDt);
      
      // Check for explosion after each sub-step
      if (this.detectSubStepExplosion(bodies)) {
        console.error('[SimulationRobustnessManager] Sub-step explosion detected, rolling back');
        this.rollbackSubStep(bodies);
        break;
      }
    }
    
    this.subStepState = null;
  }
  
  /**
   * Warm starting implementation (Box2D technique)
   * Reuses impulses from previous frame to converge faster
   */
  private applyWarmStarting(bodies: HexSoftBody[]): void {
    const now = Date.now();
    
    for (const body of bodies) {
      for (const spring of body.springs) {
        const key = this.getSpringKey(spring);
        const cached = this.warmStartCache.get(key);
        
        if (cached && (now - cached.timestamp) < 100) { // Use cache within 100ms
          // Apply cached impulse to nodes (warm start)
          const impulseScale = this.warmStartingFactor;
          const impulseX = cached.impulse.x * impulseScale;
          const impulseY = cached.impulse.y * impulseScale;
          
          const invMassA = 1.0 / spring.a.mass;
          const invMassB = 1.0 / spring.b.mass;
          
          spring.a.velocity.x -= impulseX * invMassA;
          spring.a.velocity.y -= impulseY * invMassA;
          spring.b.velocity.x += impulseX * invMassB;
          spring.b.velocity.y += impulseY * invMassB;
        }
      }
    }
  }
  
  /**
   * Store impulses for next frame warm starting
   */
  storeImpulseForWarmStart(spring: Spring2D, impulse: { x: number; y: number }, lambda: number): void {
    const key = this.getSpringKey(spring);
    this.warmStartCache.set(key, {
      impulse: { ...impulse },
      lambda,
      timestamp: Date.now()
    });
  }
  
  /**
   * Iterative constraint solving (Matter.js approach)
   * Solves position and velocity constraints iteratively for stability
   */
  solveConstraintsIteratively(bodies: HexSoftBody[], dt: number): void {
    // Velocity iterations (constraint forces)
    for (let iter = 0; iter < this.velocityIterations; iter++) {
      for (const body of bodies) {
        for (const spring of body.springs) {
          this.solveVelocityConstraint(spring, dt, iter);
        }
      }
    }
    
    // Position iterations (constraint positions)
    for (let iter = 0; iter < this.positionIterations; iter++) {
      for (const body of bodies) {
        for (const spring of body.springs) {
          this.solvePositionConstraint(spring, dt, iter);
        }
      }
    }
    
    // Boundary constraint iterations (XPBD approach)
    for (let iter = 0; iter < this.positionIterations; iter++) {
      for (const constraint of this.boundaryConstraints) {
        if (constraint.active) {
          this.solveBoundaryConstraint(constraint, dt);
        }
      }
    }
  }
  
  /**
   * Boundary stabilization using soft constraints (XPBD approach)
   * Prevents nodes from escaping the simulation domain
   */
  private updateBoundaryConstraints(bodies: HexSoftBody[]): void {
    const bounds = this.getSimulationBounds();
    
    for (const body of bodies) {
      for (const node of body.nodes) {
        const constraint = this.findOrCreateBoundaryConstraint(node);
        
        // Check if node is outside bounds
        let needsConstraint = false;
        let targetX = node.position.x;
        let targetY = node.position.y;
        
        if (node.position.x < bounds.left) {
          targetX = bounds.left;
          needsConstraint = true;
        } else if (node.position.x > bounds.right) {
          targetX = bounds.right;
          needsConstraint = true;
        }
        
        if (node.position.y < bounds.top) {
          targetY = bounds.top;
          needsConstraint = true;
        } else if (node.position.y > bounds.bottom) {
          targetY = bounds.bottom;
          needsConstraint = true;
        }
        
        constraint.active = needsConstraint;
        if (needsConstraint) {
          constraint.targetPosition.x = targetX;
          constraint.targetPosition.y = targetY;
          
          console.warn('[SimulationRobustnessManager] Boundary constraint activated', {
            nodePos: { x: node.position.x, y: node.position.y },
            target: { x: targetX, y: targetY },
            bounds
          });
        }
      }
    }
  }
  
  /**
   * XPBD-style boundary constraint solving
   */
  private solveBoundaryConstraint(constraint: BoundaryConstraint, dt: number): void {
    const node = constraint.node;
    const target = constraint.targetPosition;
    
    // Position error
    const dx = node.position.x - target.x;
    const dy = node.position.y - target.y;
    const error = Math.sqrt(dx * dx + dy * dy);
    
    if (error < 1e-6) return; // Already satisfied
    
    // XPBD formulation: compliance-based correction
    const alpha = constraint.compliance / (dt * dt);
    const invMass = 1.0 / node.mass;
    const w = invMass + alpha;
    
    if (w < 1e-10) return;
    
    // Correction impulse
    const lambda = -error / w;
    const correctionX = lambda * dx / error * invMass / w;
    const correctionY = lambda * dy / error * invMass / w;
    
    // Apply position correction
    node.position.x += correctionX;
    node.position.y += correctionY;
    
    // Apply velocity correction (stabilization)
    const velocityCorrection = 0.1; // Damping factor
    node.velocity.x += correctionX * velocityCorrection / dt;
    node.velocity.y += correctionY * velocityCorrection / dt;
  }
  
  /**
   * Energy-based explosion detection (Bullet Physics approach)
   */
  private detectEnergyExplosion(): number {
    if (this.energyHistory.length < 2) return 1.0;
    
    const current = this.energyHistory[this.energyHistory.length - 1];
    const previous = this.energyHistory[this.energyHistory.length - 2];
    
    if (previous.total < 1e-6) return 1.0; // Avoid division by zero
    
    const growth = current.total / previous.total;
    
    if (growth > this.energyThreshold) {
      console.warn('[SimulationRobustnessManager] Energy explosion detected', {
        growth,
        currentEnergy: current.total,
        previousEnergy: previous.total,
        kinetic: current.kinetic,
        potential: current.potential
      });
    }
    
    return growth;
  }
  
  /**
   * Calculate total system energy for explosion detection
   */
  private calculateSystemEnergy(bodies: HexSoftBody[]): EnergyState {
    let kinetic = 0;
    let potential = 0;
    
    for (const body of bodies) {
      // Kinetic energy (0.5 * m * v²)
      for (const node of body.nodes) {
        const vSq = node.velocity.x * node.velocity.x + node.velocity.y * node.velocity.y;
        kinetic += 0.5 * node.mass * vSq;
      }
      
      // Potential energy from springs (0.5 * k * x²)
      for (const spring of body.springs) {
        const dx = spring.b.position.x - spring.a.position.x;
        const dy = spring.b.position.y - spring.a.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const displacement = dist - spring.restLength;
        potential += 0.5 * spring.stiffness * displacement * displacement;
      }
    }
    
    return {
      kinetic,
      potential,
      dissipated: 0, // Would need to track this separately
      total: kinetic + potential,
      timestamp: Date.now()
    };
  }
  
  /**
   * Matter.js-style velocity constraint solving
   */
  private solveVelocityConstraint(spring: Spring2D, dt: number, iteration: number): void {
    const dx = spring.b.position.x - spring.a.position.x;
    const dy = spring.b.position.y - spring.a.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1e-8;
    
    const normal = { x: dx / dist, y: dy / dist };
    
    // Relative velocity
    const relVel = {
      x: spring.b.velocity.x - spring.a.velocity.x,
      y: spring.b.velocity.y - spring.a.velocity.y
    };
    
    const relVelNormal = relVel.x * normal.x + relVel.y * normal.y;
    
    // Constraint violation rate
    const C = dist - spring.restLength;
    const bias = -(0.1 / dt) * Math.max(Math.abs(C) - 0.01, 0) * Math.sign(C);
    
    // Effective mass
    const invMassA = 1.0 / spring.a.mass;
    const invMassB = 1.0 / spring.b.mass;
    const effectiveMass = invMassA + invMassB;
    
    if (effectiveMass < 1e-10) return;
    
    // Impulse magnitude
    const lambda = -(relVelNormal + bias) / effectiveMass;
    
    // Apply impulse
    const impulseX = lambda * normal.x;
    const impulseY = lambda * normal.y;
    
    spring.a.velocity.x -= impulseX * invMassA;
    spring.a.velocity.y -= impulseY * invMassA;
    spring.b.velocity.x += impulseX * invMassB;
    spring.b.velocity.y += impulseY * invMassB;
    
    // Store for warm starting
    this.storeImpulseForWarmStart(spring, { x: impulseX, y: impulseY }, lambda);
  }
  
  /**
   * Position constraint solving for geometric stability
   */
  private solvePositionConstraint(spring: Spring2D, dt: number, iteration: number): void {
    const dx = spring.b.position.x - spring.a.position.x;
    const dy = spring.b.position.y - spring.a.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1e-8;
    
    const C = dist - spring.restLength;
    
    if (Math.abs(C) < 0.01) return; // Already satisfied
    
    const normal = { x: dx / dist, y: dy / dist };
    
    // Effective mass for position correction
    const invMassA = 1.0 / spring.a.mass;
    const invMassB = 1.0 / spring.b.mass;
    const effectiveMass = invMassA + invMassB;
    
    if (effectiveMass < 1e-10) return;
    
    // Position correction (clamped for stability)
    const correction = -Math.max(-0.2, Math.min(C * this.constraintStiffness, 0.2));
    
    const correctionX = correction * normal.x;
    const correctionY = correction * normal.y;
    
    spring.a.position.x -= correctionX * invMassA / effectiveMass;
    spring.a.position.y -= correctionY * invMassA / effectiveMass;
    spring.b.position.x += correctionX * invMassB / effectiveMass;
    spring.b.position.y += correctionY * invMassB / effectiveMass;
  }
  
  /**
   * Detect explosion during sub-stepping
   */
  private detectSubStepExplosion(bodies: HexSoftBody[]): boolean {
    const maxVelocity = 500; // Maximum reasonable velocity
    const maxPosition = 5000; // Maximum reasonable position
    
    for (const body of bodies) {
      for (const node of body.nodes) {
        const vMag = Math.sqrt(node.velocity.x ** 2 + node.velocity.y ** 2);
        const pMag = Math.sqrt(node.position.x ** 2 + node.position.y ** 2);
        
        if (vMag > maxVelocity || pMag > maxPosition || !isFinite(vMag) || !isFinite(pMag)) {
          return true;
        }
      }
    }
    
    return false;
  }
  
  /**
   * Rollback to previous sub-step state
   */
  private rollbackSubStep(bodies: HexSoftBody[]): void {
    if (!this.subStepState) return;
    
    let nodeIndex = 0;
    for (const body of bodies) {
      for (const node of body.nodes) {
        if (nodeIndex < this.subStepState.originalPositions.length) {
          node.position.x = this.subStepState.originalPositions[nodeIndex].x;
          node.position.y = this.subStepState.originalPositions[nodeIndex].y;
          node.velocity.x = this.subStepState.originalVelocities[nodeIndex].x * 0.5; // Damped
          node.velocity.y = this.subStepState.originalVelocities[nodeIndex].y * 0.5;
        }
        nodeIndex++;
      }
    }
  }
  
  /**
   * Utility methods
   */
  private getSpringKey(spring: Spring2D): string {
    // Create unique key for spring (order-independent)
    const a = `${spring.a.position.x.toFixed(0)},${spring.a.position.y.toFixed(0)}`;
    const b = `${spring.b.position.x.toFixed(0)},${spring.b.position.y.toFixed(0)}`;
    return a < b ? `${a}-${b}` : `${b}-${a}`;
  }
  
  private getSimulationBounds(): { left: number; right: number; top: number; bottom: number } {
    const margin = 50;
    return {
      left: -margin,
      right: (window?.innerWidth || 1920) + margin,
      top: -margin,
      bottom: (window?.innerHeight || 1080) + margin
    };
  }
  
  private findOrCreateBoundaryConstraint(node: PointMass2D): BoundaryConstraint {
    let constraint = this.boundaryConstraints.find(c => c.node === node);
    if (!constraint) {
      constraint = {
        node,
        targetPosition: { x: node.position.x, y: node.position.y },
        compliance: this.boundaryCompliance,
        active: false
      };
      this.boundaryConstraints.push(constraint);
    }
    return constraint;
  }
  
  /**
   * Get robustness statistics for debugging
   */
  getRobustnessStats(): any {
    const recentEnergy = this.energyHistory.slice(-10);
    const avgEnergy = recentEnergy.reduce((sum, e) => sum + e.total, 0) / recentEnergy.length;
    
    return {
      energyHistoryLength: this.energyHistory.length,
      averageRecentEnergy: avgEnergy,
      warmStartCacheSize: this.warmStartCache.size,
      activeBoundaryConstraints: this.boundaryConstraints.filter(c => c.active).length,
      isSubStepping: this.subStepState !== null,
      subStepProgress: this.subStepState ? `${this.subStepState.stepCount}/${this.subStepState.maxSteps}` : 'N/A'
    };
  }
}
