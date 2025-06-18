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

  private _stiffness: number;
  private _damping: number;
  private _restLength: number;

  // Spring stiffness (Hooke's constant)
  get stiffness() { return this._stiffness; }
  set stiffness(val: number) {
    if (this._stiffness !== val) {
      console.log(`[Spring2D] stiffness changed: ${this._stiffness} -> ${val}`);
      this._stiffness = val;
    }
  }

  // Damping factor for relative velocity along the spring
  get damping() { return this._damping; }
  set damping(val: number) {
    if (this._damping !== val) {
      console.log(`[Spring2D] damping changed: ${this._damping} -> ${val}`);
      this._damping = val;
    }
  }

  // Rest length of the spring (distance at equilibrium)
  get restLength() { return this._restLength; }
  set restLength(val: number) {
    if (this._restLength !== val) {
      console.log(`[Spring2D] restLength changed: ${this._restLength} -> ${val}`);
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
    stiffness: number = 1.0,
    damping: number = 0.01,
    nonLinearCoeff: number = 0,
    baseStiffness: number = 1.0,
    stiffeningCoeff: number = 0.0,
    stiffeningPower: number = 1.0
  ) {
    this.a = a;
    this.b = b;
    this._restLength = restLength;
    this._stiffness = stiffness;
    this._damping = damping;
    this.nonLinearCoeff = nonLinearCoeff;
    this.baseStiffness = baseStiffness;
    this.stiffeningCoeff = stiffeningCoeff;
    this.stiffeningPower = stiffeningPower;
  }

  // Static batching for logging (global for all springs)
  private static _lastLogTime = 0;
  private static _applyCount = 0;
  private static _minDisp = Number.POSITIVE_INFINITY;
  private static _maxDisp = Number.NEGATIVE_INFINITY;
  private static _minForce = Number.POSITIVE_INFINITY;
  private static _maxForce = Number.NEGATIVE_INFINITY;

  // Apply spring force and damping to the connected point masses
  apply(): void {
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

    // Strain-stiffening: effective stiffness increases with strain
    const kEff = this.baseStiffness + this.stiffeningCoeff * Math.pow(absDisp, this.stiffeningPower);

    // Non-Hookean force: F = kEff * x + k3 * x^3
    // Clamp values to avoid instability but do not overdamp
    const safeK = Math.max(1e-6, Math.min(kEff, 1e3));
    const forceMag = safeK * displacement + this.nonLinearCoeff * Math.pow(displacement, 3);

    // Relative velocity along the spring direction
    const relVelX = this.b.velocity.x - this.a.velocity.x;
    const relVelY = this.b.velocity.y - this.a.velocity.y;
    const relVelAlongSpring = relVelX * dirX + relVelY * dirY;

    // Physically-based damping
    const m1 = this.a.mass;
    const m2 = this.b.mass;
    const reducedMass = (m1 * m2) / (m1 + m2);
    // Clamp values to avoid instability but do not overdamp
    const safeReducedMass = Math.max(1e-6, Math.min(reducedMass, 1e3));
    const dampingRatio = SIM_CONFIG.globalDampingRatio;
    const safeDampingRatio = Math.max(0.01, Math.min(dampingRatio, 1.5));
    const bCritical = 2 * Math.sqrt(safeK * safeReducedMass);
    const b = safeDampingRatio * bCritical;
    const dampingForce = b * relVelAlongSpring;

    // Total force to apply (spring + damping)
    const fx = (forceMag + dampingForce) * dirX;
    const fy = (forceMag + dampingForce) * dirY;

    // Debug: log all values for first spring connected to debug node
    if (this.a === (globalThis as any)._debugFirstNode || this.b === (globalThis as any)._debugFirstNode) {
      const logObj = {
        a: { pos: { ...this.a.position }, vel: { ...this.a.velocity }, mass: this.a.mass },
        b: { pos: { ...this.b.position }, vel: { ...this.b.velocity }, mass: this.b.mass },
        dx, dy, dist, dirX, dirY,
        displacement, absDisp,
        kEff, safeK, forceMag,
        relVelX, relVelY, relVelAlongSpring,
        m1, m2, reducedMass, safeReducedMass,
        dampingRatio, // from local calculation
        SIM_CONFIG_dampingRatio: SIM_CONFIG.globalDampingRatio, // from config
        localSafeDampingRatio: safeDampingRatio,
        bCritical, dampingCoeffB: b, dampingForce,
        fx, fy,
        restLength: this.restLength,
        nonLinearCoeff: this.nonLinearCoeff,
        baseStiffness: this.baseStiffness,
        stiffeningCoeff: this.stiffeningCoeff,
        stiffeningPower: this.stiffeningPower,
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
    if (Math.abs(forceMag) > 1e3 || Math.abs(dampingForce) > 1e3 || Math.abs(fx) > 1e3 || Math.abs(fy) > 1e3) {
      DebugLogger.log('spring', 'Spring force explosion', {
        displacement,
        kEff,
        forceMag,
        relVelAlongSpring,
        bCritical,
        dampingRatio,
        b,
        dampingForce,
        fx,
        fy,
        m1,
        m2,
        restLength: this.restLength
      });
    }

    // Only accumulate if force or displacement is significant
    const FORCE_EPSILON = 0.01;
    if (Math.abs(forceMag) > FORCE_EPSILON || Math.abs(displacement) > FORCE_EPSILON) {
      Spring2D._applyCount++;
      Spring2D._minDisp = Math.min(Spring2D._minDisp, displacement);
      Spring2D._maxDisp = Math.max(Spring2D._maxDisp, displacement);
      const forceNorm = Math.sqrt(fx * fx + fy * fy);
      Spring2D._minForce = Math.min(Spring2D._minForce, forceNorm);
      Spring2D._maxForce = Math.max(Spring2D._maxForce, forceNorm);
    }
    // Log every 2 seconds (approx, global for all springs)
    const now = Date.now();
    if (now - Spring2D._lastLogTime > 2000 && Spring2D._applyCount > 0) {
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
    // Clamp total force to prevent explosions
    const MAX_FORCE = 1e3;
    let clampedFx = Math.max(-MAX_FORCE, Math.min(fx, MAX_FORCE));
    let clampedFy = Math.max(-MAX_FORCE, Math.min(fy, MAX_FORCE));
    // Apply equal and opposite forces
    this.a.applyForce({ x: clampedFx, y: clampedFy });
    this.b.applyForce({ x: -clampedFx, y: -clampedFy });
  }

  // Returns the current length of the spring
  getCurrentLength(): number {
    const dx = this.b.position.x - this.a.position.x;
    const dy = this.b.position.y - this.a.position.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // Alias for apply (for test compatibility)
  applyForce(): void {
    this.apply();
  }

  // Object pooling
  static getFromPool(a: PointMass2D, b: PointMass2D, restLength: number, stiffness: number = 1.0, damping: number = 0.01): Spring2D {
    const obj = this._pool.pop();
    if (obj) {
      obj.a = a;
      obj.b = b;
      obj._restLength = restLength;
      obj._stiffness = stiffness;
      obj._damping = damping;
      obj.dirty = true;
      return obj;
    }
    return new Spring2D(a, b, restLength, stiffness, damping);
  }
  static releaseToPool(obj: Spring2D) {
    this._pool.push(obj);
  }

  // Create a Spring2D instance from CellParameters
  static fromParams(a: PointMass2D, b: PointMass2D, restLength: number, params: CellParameters): Spring2D {
    return this.getFromPool(a, b, restLength, params.stiffness, params.damping);
  }
}
