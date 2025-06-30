// Spring2D: Represents a spring constraint between two PointMass2D objects in the simulation engine.
// Responsible for applying spring force (Hooke's law) and optional damping between the two masses.
// Used to connect nodes in the hexagonal mesh for elastic behavior.
// UPDATED: Integrated with AdaptiveConstraintSolver to prevent center-crossing and force accumulation

import { PointMass2D } from './PointMass2D';
import { CellParameters } from './CellParameters';
import { SIM_CONFIG } from '../config';
import { DebugLogger } from '../infrastructure/DebugLogger';

export class Spring2D {
  // The two point masses connected by this spring
  a: PointMass2D;
  b: PointMass2D;

  // Frequency-based spring parameters (Box2D approach)
  private _springFrequency: number; // Hz - more intuitive than raw stiffness
  private _dampingRatio: number; // 0.0 = no damping, 1.0 = critical damping
  private _restLength: number;
  
  // Store the original calculated rest length for scaling purposes
  originalRestLength?: number;

  // Spring frequency in Hz (Box2D style - more intuitive)
  get springFrequency() { return this._springFrequency; }
  set springFrequency(val: number) {
    if (this._springFrequency !== val) {
      if (SIM_CONFIG.enableDebugLogging) {
        DebugLogger.log('spring', 'springFrequency changed', { from: this._springFrequency, to: val });
      }
      this._springFrequency = Math.max(0.1, val); // Minimum frequency for stability
    }
  }

  // Damping ratio (standardized approach)
  get dampingRatio() { return this._dampingRatio; }
  set dampingRatio(val: number) {
    if (this._dampingRatio !== val) {
      if (SIM_CONFIG.enableDebugLogging) {
        DebugLogger.log('spring', 'dampingRatio changed', { from: this._dampingRatio, to: val });
      }
      this._dampingRatio = Math.max(0.0, Math.min(val, 2.0)); // Clamp to reasonable range
    }
  }

  // Legacy compatibility properties (computed from frequency-based parameters)
  get stiffness(): number {
    // Convert frequency to stiffness: k = (2πf)² * m_reduced
    const omega = 2 * Math.PI * this._springFrequency;
    const reducedMass = this.getReducedMass();
    return omega * omega * reducedMass;
  }
  
  set stiffness(val: number) {
    // Convert stiffness back to frequency for legacy compatibility
    const reducedMass = this.getReducedMass();
    if (reducedMass > 0) {
      this._springFrequency = Math.sqrt(val / reducedMass) / (2 * Math.PI);
    }
  }

  get damping(): number {
    // Convert damping ratio to damping coefficient for legacy compatibility
    return this._dampingRatio * this.getCriticalDamping();
  }

  set damping(val: number) {
    // Convert damping coefficient back to ratio for legacy compatibility
    const criticalDamping = this.getCriticalDamping();
    if (criticalDamping > 0) {
      this._dampingRatio = val / criticalDamping;
    }
  }

  // Rest length of the spring (distance at equilibrium)
  get restLength() { return this._restLength; }
  set restLength(val: number) {
    if (this._restLength !== val) {
      if (SIM_CONFIG.enableDebugLogging) {
        DebugLogger.log('spring', 'restLength changed', { from: this._restLength, to: val });
      }
      this._restLength = val;
    }
  }

  // Apply spring force and damping to the connected point masses
  // Supports non-Hookean (cubic) force law if nonLinearCoeff is set
  nonLinearCoeff: number = 0; // k3 coefficient for cubic term (default 0 = linear)

  // Strain-stiffening parameters
  baseStiffness: number = 1.0; // k0: base (soft) stiffness
  stiffeningCoeff: number = 0.0; // k1: how much stiffness increases with strain
  stiffeningPower: number = 1.0; // p: exponent for strain-stiffening

  // Object pooling
  static _pool: Spring2D[] = [];

  // Dirty flag for batching
  dirty: boolean = true;

  constructor(
    a: PointMass2D,
    b: PointMass2D,
    restLength: number,
    springFrequencyOrStiffness: number = 4.0, // Default 4 Hz frequency
    dampingRatioOrDamping: number = 0.7, // Default 0.7 damping ratio
    nonLinearCoeff: number = 0,
    baseStiffness: number = 1.0,
    stiffeningCoeff: number = 0.0,
    stiffeningPower: number = 1.0,
    // Flag to determine if legacy parameters are being used
    useLegacyParameters: boolean = false
  ) {
    DebugLogger.log('spring', 'Constructor', { restLength, springFrequencyOrStiffness, useLegacyParameters });
    this.a = a;
    this.b = b;
    this._restLength = restLength;
    this.originalRestLength = restLength; // Store the original calculated rest length
    
    // Handle both new frequency-based and legacy stiffness-based parameters
    if (useLegacyParameters) {
      // Legacy mode: convert stiffness/damping to frequency/ratio
      const stiffness = springFrequencyOrStiffness;
      const damping = dampingRatioOrDamping;
      const reducedMass = this.calculateReducedMass();
      this._springFrequency = reducedMass > 0 ? Math.sqrt(stiffness / reducedMass) / (2 * Math.PI) : 1.0;
      const criticalDamping = 2 * Math.sqrt(stiffness * reducedMass);
      this._dampingRatio = criticalDamping > 0 ? damping / criticalDamping : 0.1;
    } else {
      // New frequency-based mode
      this._springFrequency = Math.max(0.1, springFrequencyOrStiffness);
      this._dampingRatio = Math.max(0.0, Math.min(dampingRatioOrDamping, 2.0));
    }
    
    this.nonLinearCoeff = nonLinearCoeff;
    this.baseStiffness = baseStiffness;
    this.stiffeningCoeff = stiffeningCoeff;
    this.stiffeningPower = stiffeningPower;
  }

  // Helper method to calculate reduced mass
  private calculateReducedMass(): number {
    const m1 = this.a.mass;
    const m2 = this.b.mass;
    return (m1 * m2) / (m1 + m2);
  }

  // Helper method to get reduced mass (public for legacy compatibility)
  private getReducedMass(): number {
    return this.calculateReducedMass();
  }

  // Helper method to calculate critical damping (FIXED - was incorrectly calculated)
  private getCriticalDamping(): number {
    const reducedMass = this.calculateReducedMass();
    const omega = 2 * Math.PI * this._springFrequency;
    const stiffness = omega * omega * reducedMass;
    // CORRECT formula: b_critical = 2 * sqrt(k * m)
    return 2 * Math.sqrt(stiffness * reducedMass);
  }

  // Calculate timestep-aware stiffness (Box2D approach)
  private getTimestepAwareStiffness(dt: number): number {
    // Convert frequency to angular frequency
    const omega = 2 * Math.PI * this._springFrequency;
    const reducedMass = this.calculateReducedMass();
    
    // Base stiffness
    const baseK = omega * omega * reducedMass;
    
    // TEMPORARILY DISABLE timestep adjustment to test if this is causing dissipation
    // Apply timestep factor for stability (smaller timesteps allow higher stiffness)
    // const maxStableDt = SIM_CONFIG.maxTimestep;
    // const timestepFactor = Math.min(1.0, (maxStableDt / Math.max(dt, 1e-6)) * SIM_CONFIG.stiffnessTimestepFactor);
    const timestepFactor = 1.0; // Full stiffness - no timestep reduction
    
    return baseK * timestepFactor;
  }

  // Static batching for logging (global for all springs)
  private static _lastLogTime = 0;
  private static _applyCount = 0;
  private static _minDisp = Number.POSITIVE_INFINITY;
  private static _maxDisp = Number.NEGATIVE_INFINITY;
  private static _minForce = Number.POSITIVE_INFINITY;
  private static _maxForce = Number.NEGATIVE_INFINITY;
  
  // Additional debug tracking
  private static _totalApplyCalls = 0;
  private static _lastApplyCountLog = 0;

  // Apply spring force and damping to the connected point masses (improved version)
  // CRITICAL FIX: Added pre-constraint solving to prevent center crossing and force accumulation
  apply(dt: number = 1/60, boundaryDampingScale: number = 1.0, constraintSolver?: any): void {
    // Debug: Count all apply calls to see if springs are being called at all
    if (SIM_CONFIG.enableDebugLogging) {
      Spring2D._totalApplyCalls = (Spring2D._totalApplyCalls || 0) + 1;
      const now = Date.now();
      if (now - (Spring2D._lastApplyCountLog || 0) > 3000) { // Log every 3 seconds
        DebugLogger.log('spring', 'Total apply() calls in last 3s', { count: Spring2D._totalApplyCalls || 0 });
        Spring2D._lastApplyCountLog = now;
        Spring2D._totalApplyCalls = 0;
      }
    }
    
    // Pre-solving constraint check (if constraint solver is provided)
    if (constraintSolver && constraintSolver.isRegistered && constraintSolver.isRegistered(this)) {
      // Let the constraint solver handle center-crossing and force accumulation
      // The constraint solver will modify positions/velocities before force application
    }
    
    // Debug: Log boundary damping application occasionally
    if (boundaryDampingScale !== 1.0 && Math.random() < 0.001) { // Very rare logging
      DebugLogger.log('spring', 'Applying boundary damping', {
        boundaryDampingScale,
        originalDampingRatio: this._dampingRatio,
        springFrequency: this._springFrequency
      });
    }
    
    const dx = this.b.position.x - this.a.position.x;
    const dy = this.b.position.y - this.a.position.y;

    // Early bounds checking to prevent extreme cases - adjusted for coordinate system
    const MAX_DIST = 30; // Much reduced from 300 for new coordinate scale
    const clampedDx = Math.max(-MAX_DIST, Math.min(dx, MAX_DIST));
    const clampedDy = Math.max(-MAX_DIST, Math.min(dy, MAX_DIST));
    let dist = Math.sqrt(clampedDx * clampedDx + clampedDy * clampedDy) || 1e-8;
    
    // EMERGENCY CONSTRAINT REMOVED: Direct position correction was causing artificial oscillations
    // Natural spring forces with proper limiting provide sufficient stability
    
    dist = Math.min(dist, MAX_DIST);
    const dirX = clampedDx / dist;
    const dirY = clampedDy / dist;

    // Displacement from rest length
    let displacement = dist - this.restLength;
    const absDisp = Math.abs(displacement);

    // IMPROVED: Progressive stiffness with anti-folding bias AND adaptive stretch response
    const timestepAwareK = this.getTimestepAwareStiffness(dt);
    
    // Progressive stiffness curve with enhanced compression handling
    let progressiveK = timestepAwareK;
    const stretchRatio = dist / this.restLength;
    
    // ADAPTIVE STIFFNESS: Much more aggressive response to prevent folding and over-stretching
    let stiffnessMultiplier = 1.0;
    if (stretchRatio > 2.0) {
      // EXTREME stretching - very aggressive response
      stiffnessMultiplier = 12.0;
      DebugLogger.log('spring', 'EXTREME stretch detected', { ratio: stretchRatio, stiffnessMultiplier });
    } else if (stretchRatio > 1.5) {
      // Very stiff for excessive stretching - prevent springs from becoming too long
      stiffnessMultiplier = 6.0;
      DebugLogger.log('spring', 'High stretch detected', { ratio: stretchRatio, stiffnessMultiplier });
    } else if (stretchRatio > 1.3) {
      // Moderate stretching - increase stiffness progressively
      stiffnessMultiplier = 3.0;
    } else if (stretchRatio > 1.1) {
      // Light stretching - slight increase
      stiffnessMultiplier = 1.5;
    } else if (stretchRatio < 0.3) {
      // EXTREME compression/folding - maximum response
      stiffnessMultiplier = 20.0;
      DebugLogger.log('spring', 'EXTREME compression detected', { ratio: stretchRatio, stiffnessMultiplier });
    } else if (stretchRatio < 0.6) {
      // Severe compression - very stiff response
      stiffnessMultiplier = 10.0;
      DebugLogger.log('spring', 'Severe compression detected', { ratio: stretchRatio, stiffnessMultiplier });
    } else if (stretchRatio < 0.8) {
      // Moderate compression - stiffer response
      stiffnessMultiplier = 4.0;
    }
    
    progressiveK *= stiffnessMultiplier;
    
    // Spring force with progressive stiffness
    let forceMag = progressiveK * displacement;
    
    // FORCE ACCUMULATION FIX: Enhanced force limiting with velocity-based scaling
    const relativeSpeed = Math.sqrt(
      (this.b.velocity.x - this.a.velocity.x) ** 2 + 
      (this.b.velocity.y - this.a.velocity.y) ** 2
    );
    
    // Reduce force if nodes are moving too fast (prevents explosive acceleration)
    const speedLimit = 20; // INCREASED from 10 for better momentum preservation
    const speedFactor = relativeSpeed > speedLimit ? speedLimit / relativeSpeed : 1.0;
    forceMag *= speedFactor;
    
    // Stricter force limiting with adaptive bounds - increased for new coordinate system
    const maxForceBase = 50; // INCREASED from 15 for stronger spring forces
    const dynamicMaxForce = maxForceBase * (1.0 + Math.min(stretchRatio, 3.0)); // Allow higher forces for larger deformations
    const clampedForceMag = Math.max(-dynamicMaxForce, Math.min(forceMag, dynamicMaxForce));

    // Relative velocity along the spring direction
    const relVelX = this.b.velocity.x - this.a.velocity.x;
    const relVelY = this.b.velocity.y - this.a.velocity.y;
    const relVelAlongSpring = relVelX * dirX + relVelY * dirY;

    // Improved physically-based damping using frequency-based parameters
    const reducedMass = this.calculateReducedMass();
    const safeReducedMass = Math.max(1e-6, Math.min(reducedMass, 1e3));
    
    // Use the configured damping ratio from global config, but allow per-spring override
    // Apply boundary damping scale for oscillation prevention
    const effectiveDampingRatio = this._dampingRatio * boundaryDampingScale;
    const safeDampingRatio = Math.max(0.01, Math.min(effectiveDampingRatio, 1.5));
    
    // Critical damping calculation using progressive stiffness
    const omega = 2 * Math.PI * this._springFrequency;
    const stiffness = progressiveK; // Use the progressive stiffness
    const bCritical = 2 * Math.sqrt(stiffness * safeReducedMass);
    const b = safeDampingRatio * bCritical;
    const dampingForce = b * relVelAlongSpring;

    // Total force to apply (spring + damping) - use clamped force magnitude
    let fx = (clampedForceMag + dampingForce) * dirX;
    let fy = (clampedForceMag + dampingForce) * dirY;
    
    // Final safety check on total force
    const totalForceMag = Math.sqrt(fx * fx + fy * fy);
    if (!isFinite(fx) || !isFinite(fy) || !isFinite(forceMag) || !isFinite(dampingForce)) {
      if (typeof DebugLogger !== 'undefined') DebugLogger.log('spring', 'NaN/Inf in spring force', {
        spring: this,
        fx, fy, forceMag, dampingForce,
        a: { pos: { ...this.a.position }, vel: { ...this.a.velocity }, mass: this.a.mass },
        b: { pos: { ...this.b.position }, vel: { ...this.b.velocity }, mass: this.b.mass }
      });
    }
    if (totalForceMag > dynamicMaxForce) {
      if (typeof DebugLogger !== 'undefined') DebugLogger.log('spring', 'Exceeded dynamicMaxForce clamp', {
        spring: this,
        fx, fy, forceMag, dampingForce, totalForceMag,
        a: { pos: { ...this.a.position }, vel: { ...this.a.velocity }, mass: this.a.mass },
        b: { pos: { ...this.b.position }, vel: { ...this.b.velocity }, mass: this.b.mass },
        dynamicMaxForce
      });
      const scale = dynamicMaxForce / totalForceMag;
      fx *= scale;
      fy *= scale;
    }

    // Debug: log force application for any spring with ANY displacement or force (very low thresholds)
    if (SIM_CONFIG.enableDebugLogging && 
        (Math.abs(displacement) > 0.0001 || Math.abs(clampedForceMag) > 0.001 || Math.abs(dampingForce) > 0.001)) {
      const logObj = {
        springId: `a:(${this.a.position.x.toFixed(1)},${this.a.position.y.toFixed(1)}) -> b:(${this.b.position.x.toFixed(1)},${this.b.position.y.toFixed(1)})`,
        displacement: displacement.toFixed(6),
        dist: dist.toFixed(6),
        restLength: this.restLength.toFixed(6),
        springFrequency: this._springFrequency,
        dampingRatio: this._dampingRatio,
        springForce: clampedForceMag.toFixed(6),
        dampingForce: dampingForce.toFixed(6),
        totalForce: { fx: fx.toFixed(6), fy: fy.toFixed(6) },
        dt
      };
      
      if (typeof DebugLogger !== 'undefined') {
        // Only log significant spring init if not high-frequency
        // Use springForce and dampingForce, which are numbers as strings
        if (Math.abs(clampedForceMag) > 1e2 || Math.abs(dampingForce) > 1e2) {
          DebugLogger.log('spring', 'Spring force applied', logObj);
        }
      } else {
        // Suppress legacy log
      }
    }

    // Condensed debug logging for force explosion diagnosis
    if (SIM_CONFIG.enableDebugLogging && 
        (Math.abs(clampedForceMag) > 1e3 || Math.abs(dampingForce) > 1e3 || Math.abs(fx) > 1e3 || Math.abs(fy) > 1e3)) {
      DebugLogger.log('spring', 'Spring force explosion', {
        displacement,
        progressiveK,
        forceMag: clampedForceMag,
        relVelAlongSpring,
        bCritical,
        effectiveDampingRatio,
        boundaryDampingScale,
        b,
        dampingForce,
        fx,
        fy,
        springFrequency: this._springFrequency,
        timestepAwareK,
        restLength: this.restLength,
        dt
      });
    }

    // Only accumulate if force or displacement is significant AND debug logging is enabled
    const FORCE_EPSILON = 0.001; // Reduced from 0.01 to catch more activity
    const DISPLACEMENT_EPSILON = 0.0001; // Reduced from 0.001 to catch tiny displacements
    
    // Debug: Log springs that should be applying force but aren't
    if (SIM_CONFIG.enableDebugLogging && 
        Math.abs(displacement) > DISPLACEMENT_EPSILON && 
        Math.abs(clampedForceMag) < FORCE_EPSILON) {
      if (typeof DebugLogger !== 'undefined') {
        DebugLogger.log('spring', 'Spring has displacement but low force', {
          springId: `a:(${this.a.position.x.toFixed(1)},${this.a.position.y.toFixed(1)}) -> b:(${this.b.position.x.toFixed(1)},${this.b.position.y.toFixed(1)})`,
          displacement: displacement.toFixed(4),
          springForce: clampedForceMag.toFixed(4),
          dampingRatio: this._dampingRatio,
          springFrequency: this._springFrequency,
          timestepAwareK: timestepAwareK.toFixed(2),
          progressiveK: progressiveK.toFixed(2)
        });
      }
    }
    
    if (SIM_CONFIG.enableDebugLogging && 
        (Math.abs(forceMag) > FORCE_EPSILON || Math.abs(displacement) > DISPLACEMENT_EPSILON)) {
      Spring2D._applyCount++;
      Spring2D._minDisp = Math.min(Spring2D._minDisp, displacement);
      Spring2D._maxDisp = Math.max(Spring2D._maxDisp, displacement);
      const forceNorm = Math.sqrt(fx * fx + fy * fy);
      Spring2D._minForce = Math.min(Spring2D._minForce, forceNorm);
      Spring2D._maxForce = Math.max(Spring2D._maxForce, forceNorm);
    }
    // Log every 1 second (approx, global for all springs) - only when debug logging is enabled
    const now = Date.now();
    if (SIM_CONFIG.enableDebugLogging && now - Spring2D._lastLogTime > 1000 && Spring2D._applyCount > 0) {
      DebugLogger.log('spring', 'batch 1s', {
        applies: Spring2D._applyCount,
        minDisp: Spring2D._minDisp,
        maxDisp: Spring2D._maxDisp,
        minForce: Spring2D._minForce,
        maxForce: Spring2D._maxForce
      });
      Spring2D._lastLogTime = now;
      Spring2D._applyCount = 0;
      Spring2D._minDisp = Number.POSITIVE_INFINITY;
      Spring2D._maxDisp = Number.NEGATIVE_INFINITY;
      Spring2D._minForce = Number.POSITIVE_INFINITY;
      Spring2D._maxForce = Number.NEGATIVE_INFINITY;
    }
    // Clamp total force to prevent explosions (increased for high-energy soft bodies)
    const MAX_FORCE = 1e6; // 1,000,000 N - much higher limit for high-frequency springs
    let clampedFx = Math.max(-MAX_FORCE, Math.min(fx, MAX_FORCE));
    let clampedFy = Math.max(-MAX_FORCE, Math.min(fy, MAX_FORCE));
    // Apply equal and opposite forces
    this.a.applyForce({ x: clampedFx, y: clampedFy });
    this.b.applyForce({ x: -clampedFx, y: -clampedFy });

    // Force propagation analysis (for debugging)
    if (SIM_CONFIG.enableDebugLogging) {
      const totalForce = Math.sqrt(fx * fx + fy * fy);
      const dampingRatio = this._dampingRatio;
      const forceAttenuation = dampingRatio;
      
      // Log force propagation issues
      if (totalForce < 0.01 && Math.abs(displacement) > 0.001) {
        DebugLogger.log('spring', 'Force propagation issue detected', {
          displacement: displacement.toFixed(4),
          totalForce: totalForce.toFixed(6),
          dampingRatio: dampingRatio.toFixed(3),
          springFreq: this._springFrequency.toFixed(2),
          mass: safeReducedMass.toFixed(4),
          timestepAwareK: timestepAwareK.toFixed(2),
          expectedForceAttenuation: `${(forceAttenuation * 100).toFixed(1)}%`,
          forceAfter8Springs: `${(Math.pow(1 - forceAttenuation, 8) * 100).toFixed(3)}%`
        });
      }
      
      // Log significant forces to trace propagation
      if (totalForce > 0.1) {
        DebugLogger.log('spring', 'Force propagation', {
          springId: `${this.a.position.x.toFixed(0)},${this.a.position.y.toFixed(0)} -> ${this.b.position.x.toFixed(0)},${this.b.position.y.toFixed(0)}`,
          force: totalForce.toFixed(3),
          displacement: displacement.toFixed(4),
          dampingRatio: dampingRatio.toFixed(2)
        });
      }
    }
  }

  // Returns the current length of the spring
  getCurrentLength(): number {
    const dx = this.b.position.x - this.a.position.x;
    const dy = this.b.position.y - this.a.position.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // Alias for apply (for test compatibility) - maintains backward compatibility
  applyForce(): void {
    this.apply(); // Use default timestep
  }

  // Object pooling (updated for frequency-based parameters)
  static getFromPool(
    a: PointMass2D, 
    b: PointMass2D, 
    restLength: number, 
    springFrequencyOrStiffness: number = 4.0, 
    dampingRatioOrDamping: number = 0.7,
    useLegacyParameters: boolean = false
  ): Spring2D {
    const obj = this._pool.pop();
    if (obj) {
      obj.a = a;
      obj.b = b;
      obj._restLength = restLength;
      
      if (useLegacyParameters) {
        // Legacy mode: convert stiffness/damping to frequency/ratio
        const stiffness = springFrequencyOrStiffness;
        const damping = dampingRatioOrDamping;
        const reducedMass = obj.calculateReducedMass();
        obj._springFrequency = reducedMass > 0 ? Math.sqrt(stiffness / reducedMass) / (2 * Math.PI) : 1.0;
        const criticalDamping = 2 * Math.sqrt(stiffness * reducedMass);
        obj._dampingRatio = criticalDamping > 0 ? damping / criticalDamping : 0.1;
      } else {
        // New frequency-based mode
        obj._springFrequency = Math.max(0.1, springFrequencyOrStiffness);
        obj._dampingRatio = Math.max(0.0, Math.min(dampingRatioOrDamping, 2.0));
      }
      
      obj.dirty = true;
      return obj;
    }
    return new Spring2D(a, b, restLength, springFrequencyOrStiffness, dampingRatioOrDamping, 0, 1.0, 0.0, 1.0, useLegacyParameters);
  }

  static releaseToPool(obj: Spring2D) {
    this._pool.push(obj);
  }

  // Create a Spring2D instance from CellParameters (updated for new interface)
  static fromParams(a: PointMass2D, b: PointMass2D, restLength: number, params: CellParameters): Spring2D {
    return this.getFromPool(a, b, restLength, params.springFrequency, params.dampingRatio, false);
  }

  // Legacy compatibility method for old stiffness/damping parameters
  static fromLegacyParams(
    a: PointMass2D, 
    b: PointMass2D, 
    restLength: number, 
    stiffness: number, 
    damping: number
  ): Spring2D {
    return this.getFromPool(a, b, restLength, stiffness, damping, true);
  }
}
