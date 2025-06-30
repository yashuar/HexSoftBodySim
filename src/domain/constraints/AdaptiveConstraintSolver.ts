// AdaptiveConstraintSolver: Advanced constraint solver adapted from Box2D, Matter.js, and XPBD
// Handles center-crossing, force accumulation, and spring instability with position-based correction
// Preserves sophisticated frequency-based spring concepts while adding proven stability techniques

import { PointMass2D } from '../PointMass2D';
import { Spring2D } from '../Spring2D';
import { HexCell } from '../HexCell';
import { SIM_CONFIG } from '../../config';

export interface ConstraintImpulse {
  x: number;
  y: number;
  magnitude: number;
  timestamp: number;
}

export interface SpringConstraintState {
  spring: Spring2D;
  
  // Center-crossing detection (adapted from Box2D joint handling)
  lastDirection: { x: number; y: number };
  centerCrossCount: number;
  lastCenterCrossTime: number;
  
  // Force accumulation tracking (inspired by Matter.js constraint impulse system)
  accumulatedImpulse: ConstraintImpulse;
  velocityHistory: Array<{ vA: { x: number; y: number }, vB: { x: number; y: number }, time: number }>;
  
  // Position-based correction (XPBD-inspired)
  positionError: number;
  positionErrorHistory: number[];
  constraintCompliance: number; // Inverse stiffness for XPBD-style solving
  
  // Stabilization state
  isUnstable: boolean;
  stabilizationMode: 'normal' | 'damped' | 'emergency' | 'frozen';
  lastStabilizationTime: number;
}

export class AdaptiveConstraintSolver {
  private springStates = new Map<Spring2D, SpringConstraintState>();
  private solverIterations = 4; // Box2D-style iteration count
  private positionCorrectionEnabled = true;
  private emergencyFreezeThreshold = 1000; // Force magnitude threshold for emergency freeze
  
  // Box2D-inspired constraint solving parameters
  private readonly baumgarte = 0.2; // Position correction factor
  private readonly linearSlop = 0.005; // Minimum correction threshold
  private readonly maxLinearCorrection = 0.2; // Maximum single-step correction
  
  constructor() {
    console.log('[AdaptiveConstraintSolver] Initialized with Box2D/XPBD-inspired constraint solving');
  }
  
  /**
   * Register a spring for advanced constraint solving
   * Adapted from Box2D joint initialization
   */
  registerSpring(spring: Spring2D): void {
    if (this.springStates.has(spring)) return;
    
    const dx = spring.b.position.x - spring.a.position.x;
    const dy = spring.b.position.y - spring.a.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1e-8;
    
    this.springStates.set(spring, {
      spring,
      lastDirection: { x: dx / dist, y: dy / dist },
      centerCrossCount: 0,
      lastCenterCrossTime: 0,
      accumulatedImpulse: { x: 0, y: 0, magnitude: 0, timestamp: Date.now() },
      velocityHistory: [],
      positionError: 0,
      positionErrorHistory: [],
      constraintCompliance: 1.0 / (spring.springFrequency * spring.springFrequency), // Convert frequency to compliance
      isUnstable: false,
      stabilizationMode: 'normal',
      lastStabilizationTime: 0
    });
  }
  
  /**
   * Check if a spring is registered with the constraint solver
   */
  isRegistered(spring: Spring2D): boolean {
    return this.springStates.has(spring);
  }
  
  /**
   * Main constraint solving step - call this before spring force application
   * Implements sequential impulse solver similar to Box2D
   */
  solveConstraints(springs: Spring2D[], dt: number): void {
    // Pre-solve: detect and handle center-crossing
    for (const spring of springs) {
      this.detectCenterCrossing(spring);
      this.updateVelocityHistory(spring);
    }
    
    // Iterative constraint solving (Box2D approach)
    for (let iteration = 0; iteration < this.solverIterations; iteration++) {
      for (const spring of springs) {
        this.solveVelocityConstraint(spring, dt);
      }
    }
    
    // Position correction (XPBD-inspired)
    if (this.positionCorrectionEnabled) {
      for (const spring of springs) {
        this.solvePositionConstraint(spring, dt);
      }
    }
    
    // Post-solve stabilization
    for (const spring of springs) {
      this.updateStabilizationState(spring);
    }
  }
  
  /**
   * Detect center-crossing events (critical bug fix)
   * When nodes cross the spring center, direction flips and forces can accumulate explosively
   */
  private detectCenterCrossing(spring: Spring2D): void {
    const state = this.springStates.get(spring);
    if (!state) return;
    
    const dx = spring.b.position.x - spring.a.position.x;
    const dy = spring.b.position.y - spring.a.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1e-8;
    const currentDirection = { x: dx / dist, y: dy / dist };
    
    // Check for direction reversal (center crossing)
    const dotProduct = currentDirection.x * state.lastDirection.x + currentDirection.y * state.lastDirection.y;
    
    if (dotProduct < -0.5) { // Significant direction change
      state.centerCrossCount++;
      state.lastCenterCrossTime = Date.now();
      
      console.warn('[AdaptiveConstraintSolver] Center crossing detected', {
        springInfo: `${spring.a.position.x.toFixed(1)},${spring.a.position.y.toFixed(1)} -> ${spring.b.position.x.toFixed(1)},${spring.b.position.y.toFixed(1)}`,
        crossCount: state.centerCrossCount,
        dotProduct,
        distance: dist,
        restLength: spring.restLength
      });
      
      // Emergency intervention for center crossing
      this.handleCenterCrossing(spring, state);
    }
    
    state.lastDirection = currentDirection;
  }
  
  /**
   * Handle center-crossing emergency intervention
   * Adapted from Box2D joint limit handling
   */
  private handleCenterCrossing(spring: Spring2D, state: SpringConstraintState): void {
    // Immediately dampen velocities to prevent explosive forces
    const dampingFactor = 0.3; // Strong damping
    spring.a.velocity.x *= dampingFactor;
    spring.a.velocity.y *= dampingFactor;
    spring.b.velocity.x *= dampingFactor;
    spring.b.velocity.y *= dampingFactor;
    
    // Position correction to restore spring geometry
    const dx = spring.b.position.x - spring.a.position.x;
    const dy = spring.b.position.y - spring.a.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1e-8;
    
    if (dist > 0) {
      const targetDist = Math.max(spring.restLength * 0.8, dist * 0.7); // Contract towards rest length
      const correctionFactor = targetDist / dist;
      
      // Move both nodes towards each other (mass-proportional)
      const centerX = (spring.a.position.x + spring.b.position.x) * 0.5;
      const centerY = (spring.a.position.y + spring.b.position.y) * 0.5;
      
      const totalMass = spring.a.mass + spring.b.mass;
      const aRatio = spring.b.mass / totalMass;
      const bRatio = spring.a.mass / totalMass;
      
      const newAx = centerX + (spring.a.position.x - centerX) * correctionFactor * aRatio;
      const newAy = centerY + (spring.a.position.y - centerY) * correctionFactor * aRatio;
      const newBx = centerX + (spring.b.position.x - centerX) * correctionFactor * bRatio;
      const newBy = centerY + (spring.b.position.y - centerY) * correctionFactor * bRatio;
      
      spring.a.position.x = newAx;
      spring.a.position.y = newAy;
      spring.b.position.x = newBx;
      spring.b.position.y = newBy;
    }
    
    // Set emergency stabilization mode
    state.stabilizationMode = 'emergency';
    state.lastStabilizationTime = Date.now();
    
    // Reset accumulated impulse to prevent explosive forces
    state.accumulatedImpulse = { x: 0, y: 0, magnitude: 0, timestamp: Date.now() };
  }
  
  /**
   * Velocity constraint solving (Box2D-inspired sequential impulse)
   */
  private solveVelocityConstraint(spring: Spring2D, dt: number): void {
    const state = this.springStates.get(spring);
    if (!state) return;
    
    // Handle frozen state separately
    if (state.stabilizationMode === 'frozen') return;
    
    const dx = spring.b.position.x - spring.a.position.x;
    const dy = spring.b.position.y - spring.a.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1e-8;
    
    if (dist < this.linearSlop) return; // Skip tiny constraints
    
    const normal = { x: dx / dist, y: dy / dist };
    
    // Relative velocity along constraint
    const relVelX = spring.b.velocity.x - spring.a.velocity.x;
    const relVelY = spring.b.velocity.y - spring.a.velocity.y;
    const relVelNormal = relVelX * normal.x + relVelY * normal.y;
    
    // Constraint violation (C = current_length - rest_length)
    const C = dist - spring.restLength;
    
    // Constraint derivative (Cdot = relative velocity along normal)
    const Cdot = relVelNormal;
    
    // Bias for position correction (Baumgarte stabilization)
    const bias = -(this.baumgarte / dt) * Math.max(Math.abs(C) - this.linearSlop, 0) * Math.sign(C);
    
    // Effective mass calculation (Box2D style)
    const invMassA = 1.0 / spring.a.mass;
    const invMassB = 1.0 / spring.b.mass;
    const effectiveMass = invMassA + invMassB;
    
    if (effectiveMass < 1e-10) return; // Infinite mass case
    
    // Compute impulse magnitude
    const lambda = -(Cdot + bias) / effectiveMass;
    
    // Apply stabilization mode modifications
    let stabilizedLambda = lambda;
    switch (state.stabilizationMode) {
      case 'normal':
        // No modification
        break;
      case 'damped':
        stabilizedLambda *= 0.5; // Reduce impulse strength
        break;
      case 'emergency':
        stabilizedLambda *= 0.2; // Heavily damped
        break;
      default:
        // Handle any unexpected values (including frozen, though that's handled above)
        break;
    }
    
    // Clamp impulse to prevent explosions
    const maxImpulse = this.emergencyFreezeThreshold * dt;
    stabilizedLambda = Math.max(-maxImpulse, Math.min(stabilizedLambda, maxImpulse));
    
    // Apply impulse to bodies
    const impulseX = stabilizedLambda * normal.x;
    const impulseY = stabilizedLambda * normal.y;
    
    spring.a.velocity.x -= impulseX * invMassA;
    spring.a.velocity.y -= impulseY * invMassA;
    spring.b.velocity.x += impulseX * invMassB;
    spring.b.velocity.y += impulseY * invMassB;
    
    // Track accumulated impulse for force accumulation detection
    state.accumulatedImpulse.x += impulseX;
    state.accumulatedImpulse.y += impulseY;
    state.accumulatedImpulse.magnitude = Math.sqrt(
      state.accumulatedImpulse.x * state.accumulatedImpulse.x + 
      state.accumulatedImpulse.y * state.accumulatedImpulse.y
    );
  }
  
  /**
   * Position constraint solving (XPBD-inspired position-based correction)
   */
  private solvePositionConstraint(spring: Spring2D, dt: number): void {
    const state = this.springStates.get(spring);
    if (!state) return;
    
    // Handle frozen state separately
    if (state.stabilizationMode === 'frozen') return;
    
    const dx = spring.b.position.x - spring.a.position.x;
    const dy = spring.b.position.y - spring.a.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1e-8;
    
    const C = dist - spring.restLength;
    state.positionError = Math.abs(C);
    state.positionErrorHistory.push(state.positionError);
    
    // Keep history manageable
    if (state.positionErrorHistory.length > 10) {
      state.positionErrorHistory.shift();
    }
    
    if (Math.abs(C) < this.linearSlop) return; // Position is good enough
    
    const normal = { x: dx / dist, y: dy / dist };
    
    // XPBD-style compliance-based correction
    const alpha = state.constraintCompliance / (dt * dt);
    const invMassA = 1.0 / spring.a.mass;
    const invMassB = 1.0 / spring.b.mass;
    const w = invMassA + invMassB + alpha;
    
    if (w < 1e-10) return;
    
    // Position correction magnitude (clamped for stability)
    const correctionMagnitude = -C / w;
    const clampedCorrection = Math.max(-this.maxLinearCorrection, 
                                     Math.min(correctionMagnitude, this.maxLinearCorrection));
    
    // Apply position corrections
    const correctionX = clampedCorrection * normal.x;
    const correctionY = clampedCorrection * normal.y;
    
    spring.a.position.x -= correctionX * invMassA / w;
    spring.a.position.y -= correctionY * invMassA / w;
    spring.b.position.x += correctionX * invMassB / w;
    spring.b.position.y += correctionY * invMassB / w;
  }
  
  /**
   * Update velocity history for force accumulation detection
   */
  private updateVelocityHistory(spring: Spring2D): void {
    const state = this.springStates.get(spring);
    if (!state) return;
    
    const now = Date.now();
    state.velocityHistory.push({
      vA: { x: spring.a.velocity.x, y: spring.a.velocity.y },
      vB: { x: spring.b.velocity.x, y: spring.b.velocity.y },
      time: now
    });
    
    // Keep only recent history (last 100ms)
    const cutoff = now - 100;
    state.velocityHistory = state.velocityHistory.filter(entry => entry.time > cutoff);
  }
  
  /**
   * Update stabilization state based on spring behavior
   */
  private updateStabilizationState(spring: Spring2D): void {
    const state = this.springStates.get(spring);
    if (!state) return;
    
    const now = Date.now();
    
    // Check for force accumulation (rapid velocity changes)
    if (state.velocityHistory.length >= 3) {
      const recent = state.velocityHistory.slice(-3);
      let maxVelocityChange = 0;
      
      for (let i = 1; i < recent.length; i++) {
        const dvAx = recent[i].vA.x - recent[i-1].vA.x;
        const dvAy = recent[i].vA.y - recent[i-1].vA.y;
        const dvBx = recent[i].vB.x - recent[i-1].vB.x;
        const dvBy = recent[i].vB.y - recent[i-1].vB.y;
        
        const changeA = Math.sqrt(dvAx * dvAx + dvAy * dvAy);
        const changeB = Math.sqrt(dvBx * dvBx + dvBy * dvBy);
        maxVelocityChange = Math.max(maxVelocityChange, changeA, changeB);
      }
      
      // Detect rapid acceleration (force accumulation)
      if (maxVelocityChange > 50) { // Threshold for concerning velocity changes
        state.isUnstable = true;
        state.stabilizationMode = 'emergency';
        state.lastStabilizationTime = now;
        
        console.warn('[AdaptiveConstraintSolver] Force accumulation detected', {
          springInfo: `${spring.a.position.x.toFixed(1)},${spring.a.position.y.toFixed(1)} -> ${spring.b.position.x.toFixed(1)},${spring.b.position.y.toFixed(1)}`,
          maxVelocityChange,
          accumulatedImpulse: state.accumulatedImpulse.magnitude
        });
      }
    }
    
    // Check for accumulated impulse explosion
    if (state.accumulatedImpulse.magnitude > this.emergencyFreezeThreshold) {
      state.stabilizationMode = 'frozen';
      state.lastStabilizationTime = now;
      
      // Zero out velocities
      spring.a.velocity.x = spring.a.velocity.y = 0;
      spring.b.velocity.x = spring.b.velocity.y = 0;
      
      console.error('[AdaptiveConstraintSolver] Emergency freeze activated', {
        springInfo: `${spring.a.position.x.toFixed(1)},${spring.a.position.y.toFixed(1)} -> ${spring.b.position.x.toFixed(1)},${spring.b.position.y.toFixed(1)}`,
        accumulatedMagnitude: state.accumulatedImpulse.magnitude
      });
    }
    
    // Decay stabilization mode over time
    const timeSinceStabilization = now - state.lastStabilizationTime;
    if (timeSinceStabilization > 2000) { // 2 seconds
      if (state.stabilizationMode === 'emergency') {
        state.stabilizationMode = 'damped';
      } else if (state.stabilizationMode === 'damped') {
        state.stabilizationMode = 'normal';
        state.isUnstable = false;
      } else if (state.stabilizationMode === 'frozen') {
        state.stabilizationMode = 'emergency'; // Gradual unfreezing
      }
    }
    
    // Reset accumulated impulse periodically
    if (now - state.accumulatedImpulse.timestamp > 100) { // Reset every 100ms
      state.accumulatedImpulse = { x: 0, y: 0, magnitude: 0, timestamp: now };
    }
  }
  
  /**
   * Get constraint solver statistics for debugging
   */
  getConstraintStats(): any {
    const stats = {
      totalSprings: this.springStates.size,
      unstableSprings: 0,
      emergencyMode: 0,
      frozenSprings: 0,
      averagePositionError: 0,
      maxAccumulatedImpulse: 0
    };
    
    let totalPositionError = 0;
    
    for (const [spring, state] of this.springStates) {
      if (state.isUnstable) stats.unstableSprings++;
      if (state.stabilizationMode === 'emergency') stats.emergencyMode++;
      if (state.stabilizationMode === 'frozen') stats.frozenSprings++;
      
      totalPositionError += state.positionError;
      stats.maxAccumulatedImpulse = Math.max(stats.maxAccumulatedImpulse, state.accumulatedImpulse.magnitude);
    }
    
    if (this.springStates.size > 0) {
      stats.averagePositionError = totalPositionError / this.springStates.size;
    }
    
    return stats;
  }
  
  /**
   * Emergency reset for a specific spring
   */
  emergencyResetSpring(spring: Spring2D): void {
    const state = this.springStates.get(spring);
    if (!state) return;
    
    // Reset all accumulated state
    state.centerCrossCount = 0;
    state.accumulatedImpulse = { x: 0, y: 0, magnitude: 0, timestamp: Date.now() };
    state.velocityHistory = [];
    state.positionErrorHistory = [];
    state.isUnstable = false;
    state.stabilizationMode = 'normal';
    
    // Dampen velocities
    spring.a.velocity.x *= 0.5;
    spring.a.velocity.y *= 0.5;
    spring.b.velocity.x *= 0.5;
    spring.b.velocity.y *= 0.5;
    
    console.log('[AdaptiveConstraintSolver] Emergency reset applied to spring', {
      springInfo: `${spring.a.position.x.toFixed(1)},${spring.a.position.y.toFixed(1)} -> ${spring.b.position.x.toFixed(1)},${spring.b.position.y.toFixed(1)}`
    });
  }
}
