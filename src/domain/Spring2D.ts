// Spring2D: Represents a spring constraint between two PointMass2D objects in the simulation engine.
// Responsible for applying spring force (Hooke's law) and optional damping between the two masses.
// Used to connect nodes in the hexagonal mesh for elastic behavior.

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

  // Spring frequency in Hz (Box2D style - more intuitive)
  get springFrequency() { return this._springFrequency; }
  set springFrequency(val: number) {
    if (this._springFrequency !== val) {
      if (SIM_CONFIG.enableDebugLogging) {
        console.log(`[Spring2D] springFrequency changed: ${this._springFrequency} -> ${val} Hz`);
      }
      this._springFrequency = Math.max(0.1, val); // Minimum frequency for stability
    }
  }

  // Damping ratio (standardized approach)
  get dampingRatio() { return this._dampingRatio; }
  set dampingRatio(val: number) {
    if (this._dampingRatio !== val) {
      if (SIM_CONFIG.enableDebugLogging) {
        console.log(`[Spring2D] dampingRatio changed: ${this._dampingRatio} -> ${val}`);
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
        console.log(`[Spring2D] restLength changed: ${this._restLength} -> ${val}`);
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
    this.a = a;
    this.b = b;
    this._restLength = restLength;
    
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

  // Apply spring force and damping to the connected point masses (improved version)
  apply(dt: number = 1/60): void {
    const dx = this.b.position.x - this.a.position.x;
    const dy = this.b.position.y - this.a.position.y;

    // Clamp dx, dy, dist, displacement to prevent numerical explosions
    const MAX_DIST = 1e4;
    const clampedDx = Math.max(-MAX_DIST, Math.min(dx, MAX_DIST));
    const clampedDy = Math.max(-MAX_DIST, Math.min(dy, MAX_DIST));
    let dist = Math.sqrt(clampedDx * clampedDx + clampedDy * clampedDy) || 1e-8; // Avoid division by zero
    dist = Math.min(dist, MAX_DIST);
    const dirX = clampedDx / dist;
    const dirY = clampedDy / dist;

    // Displacement from rest length
    let displacement = dist - this.restLength;
    displacement = Math.max(-MAX_DIST, Math.min(displacement, MAX_DIST));
    const absDisp = Math.abs(displacement);

    // Timestep-aware stiffness calculation (Box2D approach)
    const timestepAwareK = this.getTimestepAwareStiffness(dt);

    // Strain-stiffening: effective stiffness increases with strain
    const kEff = this.baseStiffness + this.stiffeningCoeff * Math.pow(absDisp, this.stiffeningPower);
    
    // Combine timestep-aware and strain-stiffening effects
    const finalK = timestepAwareK + kEff;

    // Non-Hookean force: F = kEff * x + k3 * x^3
    // Clamp values to avoid instability but do not overdamp
    const safeK = Math.max(1e-6, Math.min(finalK, 1e3));
    const forceMag = safeK * displacement + this.nonLinearCoeff * Math.pow(displacement, 3);

    // Relative velocity along the spring direction
    const relVelX = this.b.velocity.x - this.a.velocity.x;
    const relVelY = this.b.velocity.y - this.a.velocity.y;
    const relVelAlongSpring = relVelX * dirX + relVelY * dirY;

    // Improved physically-based damping using frequency-based parameters
    const reducedMass = this.calculateReducedMass();
    const safeReducedMass = Math.max(1e-6, Math.min(reducedMass, 1e3));
    
    // Use the configured damping ratio from global config, but allow per-spring override
    const dampingRatio = this._dampingRatio; // Use spring-specific damping ratio
    const safeDampingRatio = Math.max(0.01, Math.min(dampingRatio, 1.5));
    
    // Critical damping calculation (FIXED - was using wrong formula)
    const omega = 2 * Math.PI * this._springFrequency;
    const stiffness = timestepAwareK; // Use the actual stiffness being applied
    const bCritical = 2 * Math.sqrt(stiffness * safeReducedMass); // CORRECT physics formula
    const b = safeDampingRatio * bCritical;
    const dampingForce = b * relVelAlongSpring;

    // Total force to apply (spring + damping)
    const fx = (forceMag + dampingForce) * dirX;
    const fy = (forceMag + dampingForce) * dirY;

    // Debug: log all values for first spring connected to debug node
    if (SIM_CONFIG.enableDebugLogging && 
        (this.a === (globalThis as any)._debugFirstNode || this.b === (globalThis as any)._debugFirstNode)) {
      const logObj = {
        a: { pos: { ...this.a.position }, vel: { ...this.a.velocity }, mass: this.a.mass },
        b: { pos: { ...this.b.position }, vel: { ...this.b.velocity }, mass: this.b.mass },
        dx, dy, dist, dirX, dirY,
        displacement, absDisp,
        springFrequency: this._springFrequency,
        dampingRatio: this._dampingRatio,
        timestepAwareK, kEff, finalK, safeK, forceMag,
        relVelX, relVelY, relVelAlongSpring,
        reducedMass, safeReducedMass,
        omega, bCritical, dampingCoeffB: b, dampingForce,
        fx, fy,
        restLength: this.restLength,
        nonLinearCoeff: this.nonLinearCoeff,
        baseStiffness: this.baseStiffness,
        stiffeningCoeff: this.stiffeningCoeff,
        stiffeningPower: this.stiffeningPower,
        dt
      };
      // Automated NaN/Inf detection
      const hasNaN = Object.values(logObj).some(v => typeof v === 'number' && (!isFinite(v) || isNaN(v))) ||
        Object.values(logObj.a.pos).some(v => !isFinite(v) || isNaN(v)) ||
        Object.values(logObj.a.vel).some(v => !isFinite(v) || isNaN(v)) ||
        Object.values(logObj.b.pos).some(v => !isFinite(v) || isNaN(v)) ||
        Object.values(logObj.b.vel).some(v => !isFinite(v) || isNaN(v));
      if (hasNaN) {
        console.error('[CRITICAL][Spring2D][apply][NaN/Inf detected]', logObj);
      } else {
        console.debug('[DEBUG][Spring2D][apply]', logObj);
      }
    }

    // Condensed debug logging for force explosion diagnosis
    if (SIM_CONFIG.enableDebugLogging && 
        (Math.abs(forceMag) > 1e3 || Math.abs(dampingForce) > 1e3 || Math.abs(fx) > 1e3 || Math.abs(fy) > 1e3)) {
      DebugLogger.log('spring', 'Spring force explosion', {
        displacement,
        finalK,
        forceMag,
        relVelAlongSpring,
        bCritical,
        dampingRatio,
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
    const FORCE_EPSILON = 0.01;
    if (SIM_CONFIG.enableDebugLogging && 
        (Math.abs(forceMag) > FORCE_EPSILON || Math.abs(displacement) > FORCE_EPSILON)) {
      Spring2D._applyCount++;
      Spring2D._minDisp = Math.min(Spring2D._minDisp, displacement);
      Spring2D._maxDisp = Math.max(Spring2D._maxDisp, displacement);
      const forceNorm = Math.sqrt(fx * fx + fy * fy);
      Spring2D._minForce = Math.min(Spring2D._minForce, forceNorm);
      Spring2D._maxForce = Math.max(Spring2D._maxForce, forceNorm);
    }
    // Log every 2 seconds (approx, global for all springs) - only when debug logging is enabled
    const now = Date.now();
    if (SIM_CONFIG.enableDebugLogging && now - Spring2D._lastLogTime > 2000 && Spring2D._applyCount > 0) {
      console.log(
        `[Spring2D][batch 2s] applies: ${Spring2D._applyCount}, disp[min: ${Spring2D._minDisp.toFixed(2)}, max: ${Spring2D._maxDisp.toFixed(2)}], force[min: ${Spring2D._minForce.toFixed(2)}, max: ${Spring2D._maxForce.toFixed(2)}]`
      );
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
        console.warn(`[Spring2D] Force propagation issue detected:`, {
          displacement: displacement.toFixed(4),
          totalForce: totalForce.toFixed(6),
          dampingRatio: dampingRatio.toFixed(3),
          springFreq: this._springFrequency.toFixed(2),
          mass: safeReducedMass.toFixed(4),
          timestepAwareK: timestepAwareK.toFixed(2),
          'Expected Force Attenuation per spring': `${(forceAttenuation * 100).toFixed(1)}%`,
          'Force after 8 springs': `${(Math.pow(1 - forceAttenuation, 8) * 100).toFixed(3)}%`
        });
      }
      
      // Log significant forces to trace propagation
      if (totalForce > 0.1) {
        console.log(`[Spring2D] Force propagation:`, {
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
