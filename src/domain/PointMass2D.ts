// PointMass2D: Represents a point mass in 2D space for the simulation engine.
// Core properties: position, velocity, mass, force accumulator, and damping.

import { CellParameters } from './CellParameters';
import { DebugLogger } from '../infrastructure/DebugLogger';
import { SIM_CONFIG } from '../config';

import type { HexCell } from './HexCell';

export class PointMass2D {
  cellRefs?: HexCell[];
  // Current position in world space
  position: { x: number; y: number };

  // Current velocity
  velocity: { x: number; y: number };

  // Accumulated force to be applied during the next integration step
  force: { x: number; y: number };

  // Mass of the point (must be > 0)
  mass: number;

  // Damping factor (0 = no damping, 1 = full damping)
  damping: number;

  // Static batching for logging
  private static _lastLogTime = 0;
  private static _changeCount = 0;
  private static _minPos = {
    x: Number.POSITIVE_INFINITY,
    y: Number.POSITIVE_INFINITY,
  };
  private static _maxPos = {
    x: Number.NEGATIVE_INFINITY,
    y: Number.NEGATIVE_INFINITY,
  };
  private static _minVel = {
    x: Number.POSITIVE_INFINITY,
    y: Number.POSITIVE_INFINITY,
  };
  private static _maxVel = {
    x: Number.NEGATIVE_INFINITY,
    y: Number.NEGATIVE_INFINITY,
  };
  static _pool: PointMass2D[] = [];

  dirty: boolean = true;

  constructor(
    position: { x: number; y: number },
    mass: number = 1.0,
    damping: number = 0.0 // Set to 0 for soft-body systems - damping handled by springs
  ) {
    this.position = { ...position };
    this.velocity = { x: 0, y: 0 };
    this.force = { x: 0, y: 0 };
    this.mass = mass;
    this.damping = damping;
  }

  // Apply a force to this point mass (accumulates until next integration)
  applyForce(force: { x: number; y: number }): void {
    this.force.x += force.x;
    this.force.y += force.y;
  }

  // Integrate position and velocity using semi-implicit Euler
  integrate(dt: number): void {
    if (this.mass <= 0) return;
    const EPSILON = 0.01;
    // Store old position and velocity for comparison
    const oldX = this.position.x;
    const oldY = this.position.y;
    const oldVx = this.velocity.x;
    const oldVy = this.velocity.y;
    let anomaly = false;
    
    // Store forces for this integration step (before clearing)
    const fx = this.force.x;
    const fy = this.force.y;
    
    // Reset force accumulator BEFORE integration to avoid double-application
    this.resetForce();
    
    // Clamp mass to safe range
    const safeMass = Math.max(1e-6, Math.min(this.mass, 1e3));
    if (!isFinite(safeMass) || safeMass <= 0) return;
    // Acceleration = F / m
    const ax = fx / safeMass;
    const ay = fy / safeMass;
    // Debug: log all values before integration for first node
    if (SIM_CONFIG.enableDebugLogging && this === (globalThis as any)._debugFirstNode) {
      const preLog = {
        position: { ...this.position },
        velocity: { ...this.velocity },
        force: { x: fx, y: fy }, // Use stored force values
        mass: this.mass,
        safeMass,
        ax,
        ay,
        dt,
      };
      const hasNaN = Object.values(preLog).some(v => typeof v === 'number' && (!isFinite(v) || isNaN(v))) ||
        Object.values(preLog.position).some(v => !isFinite(v) || isNaN(v)) ||
        Object.values(preLog.velocity).some(v => !isFinite(v) || isNaN(v)) ||
        Object.values(preLog.force).some(v => !isFinite(v) || isNaN(v));
      if (hasNaN) {
        console.error('[CRITICAL][PointMass2D][pre-integrate][NaN/Inf detected]', preLog);
      } // Only log debug if NaN/Inf detected
    }
    // Clamp acceleration to prevent explosions (increased for high-energy soft bodies)
    const MAX_ACC = 1e5; // 100,000 m/s² - much higher limit for high-frequency springs
    const clampedAx = Math.max(-MAX_ACC, Math.min(ax, MAX_ACC));
    const clampedAy = Math.max(-MAX_ACC, Math.min(ay, MAX_ACC));
    // Update velocity
    this.velocity.x += clampedAx * dt;
    this.velocity.y += clampedAy * dt;
    // Log if velocity changes by a large amount in one step
    if (Math.abs(this.velocity.x - oldVx) > 50 || Math.abs(this.velocity.y - oldVy) > 50) {
      anomaly = true;
      if (typeof DebugLogger !== 'undefined') DebugLogger.log('pointmass', 'Large velocity change in one step', {
        node: this,
        oldVx,
        oldVy,
        newVx: this.velocity.x,
        newVy: this.velocity.y,
        ax,
        ay,
        dt
      });
    }
    // Apply per-point damping (should be 0 for soft-body systems)
    // In soft-body physics, damping is handled by springs to avoid double-damping
    // which kills force propagation through the mesh
    if (this.damping > 0) {
      this.velocity.x *= 1 - this.damping;
      this.velocity.y *= 1 - this.damping;
    }
    // Update position
    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;
    // Log if position changes by a large amount in one step
    if (Math.abs(this.position.x - oldX) > 50 || Math.abs(this.position.y - oldY) > 50) {
      anomaly = true;
      if (typeof DebugLogger !== 'undefined') DebugLogger.log('pointmass', 'Large position change in one step', {
        node: this,
        oldX,
        oldY,
        newX: this.position.x,
        newY: this.position.y,
        velocity: { ...this.velocity },
        dt
      });
    }
    // Clamp position and velocity to prevent numerical explosions
    const MAX_VAL = 1e4;
    if (Math.abs(this.position.x) > MAX_VAL || Math.abs(this.position.y) > MAX_VAL || Math.abs(this.velocity.x) > MAX_VAL || Math.abs(this.velocity.y) > MAX_VAL) {
      anomaly = true;
      if (typeof DebugLogger !== 'undefined') DebugLogger.log('pointmass', 'Exceeded MAX_VAL clamp', {
        node: this,
        position: { ...this.position },
        velocity: { ...this.velocity },
        MAX_VAL
      });
    }
    this.position.x = Math.max(-MAX_VAL, Math.min(this.position.x, MAX_VAL));
    this.position.y = Math.max(-MAX_VAL, Math.min(this.position.y, MAX_VAL));
    this.velocity.x = Math.max(-MAX_VAL, Math.min(this.velocity.x, MAX_VAL));
    this.velocity.y = Math.max(-MAX_VAL, Math.min(this.velocity.y, MAX_VAL));
    if (anomaly && typeof DebugLogger !== 'undefined') DebugLogger.flush();
    // Debug: log all values after integration for first node
    if (SIM_CONFIG.enableDebugLogging && this === (globalThis as any)._debugFirstNode) {
      const postLog = {
        position: { ...this.position },
        velocity: { ...this.velocity },
        ax,
        ay,
        dt,
      };
      const hasNaN = Object.values(postLog).some(v => typeof v === 'number' && (!isFinite(v) || isNaN(v))) ||
        Object.values(postLog.position).some(v => !isFinite(v) || isNaN(v)) ||
        Object.values(postLog.velocity).some(v => !isFinite(v) || isNaN(v));
      if (hasNaN) {
        console.error('[CRITICAL][PointMass2D][post-integrate][NaN/Inf detected]', postLog);
      } // Only log debug if NaN/Inf detected
    }
    // Condensed debug logging for instability
    if (SIM_CONFIG.enableDebugLogging && (
      !isFinite(this.position.x) ||
      !isFinite(this.position.y) ||
      !isFinite(this.velocity.x) ||
      !isFinite(this.velocity.y)
    )) {
      DebugLogger.log('pointmass', 'NaN/Inf in PointMass2D', {
        position: this.position,
        velocity: this.velocity,
        ax,
        ay,
        force: { x: fx, y: fy }, // Use stored force values
        mass: this.mass,
        dt,
      });
    }
    if (SIM_CONFIG.enableDebugLogging && (
      Math.abs(this.position.x) > 1e6 ||
      Math.abs(this.position.y) > 1e6 ||
      Math.abs(this.velocity.x) > 1e6 ||
      Math.abs(this.velocity.y) > 1e6
    )) {
      DebugLogger.log('pointmass', 'PointMass2D explosion', {
        position: this.position,
        velocity: this.velocity,
        ax,
        ay,
        force: { x: fx, y: fy }, // Use stored force values
        mass: this.mass,
        dt,
      });
    }
    // Only accumulate if position or velocity changed significantly AND debug logging is enabled
    const posChanged =
      Math.abs(oldX - this.position.x) > EPSILON ||
      Math.abs(oldY - this.position.y) > EPSILON;
    const velChanged =
      Math.abs(oldVx - this.velocity.x) > EPSILON ||
      Math.abs(oldVy - this.velocity.y) > EPSILON;
    if (SIM_CONFIG.enableDebugLogging && (posChanged || velChanged)) {
      PointMass2D._changeCount++;
      // Track min/max position
      PointMass2D._minPos.x = Math.min(PointMass2D._minPos.x, this.position.x);
      PointMass2D._minPos.y = Math.min(PointMass2D._minPos.y, this.position.y);
      PointMass2D._maxPos.x = Math.max(PointMass2D._maxPos.x, this.position.x);
      PointMass2D._maxPos.y = Math.max(PointMass2D._maxPos.y, this.position.y);
      // Track min/max velocity
      PointMass2D._minVel.x = Math.min(PointMass2D._minVel.x, this.velocity.x);
      PointMass2D._minVel.y = Math.min(PointMass2D._minVel.y, this.velocity.y);
      PointMass2D._maxVel.x = Math.max(PointMass2D._maxVel.x, this.velocity.x);
      PointMass2D._maxVel.y = Math.max(PointMass2D._maxVel.y, this.velocity.y);
    }
    // Log every 10 seconds (approx) - only when debug logging is enabled
    const now = Date.now();
    const LOG_INTERVAL_MS = 10000; // 10 seconds
    if (SIM_CONFIG.enableDebugLogging &&
      now - PointMass2D._lastLogTime > LOG_INTERVAL_MS &&
      PointMass2D._changeCount > 0
    ) {
      console.log(
        `[PointMass2D][batch 10s] changes: ${PointMass2D._changeCount}, pos[min: (${PointMass2D._minPos.x.toFixed(2)}, ${PointMass2D._minPos.y.toFixed(2)}), max: (${PointMass2D._maxPos.x.toFixed(2)}, ${PointMass2D._maxPos.y.toFixed(2)})], vel[min: (${PointMass2D._minVel.x.toFixed(2)}, ${PointMass2D._minVel.y.toFixed(2)}), max: (${PointMass2D._maxVel.x.toFixed(2)}, ${PointMass2D._maxVel.y.toFixed(2)})]`
      );
      PointMass2D._lastLogTime = now;
      PointMass2D._changeCount = 0;
      PointMass2D._minPos = {
        x: Number.POSITIVE_INFINITY,
        y: Number.POSITIVE_INFINITY,
      };
      PointMass2D._maxPos = {
        x: Number.NEGATIVE_INFINITY,
        y: Number.NEGATIVE_INFINITY,
      };
      PointMass2D._minVel = {
        x: Number.POSITIVE_INFINITY,
        y: Number.POSITIVE_INFINITY,
      };
      PointMass2D._maxVel = {
        x: Number.NEGATIVE_INFINITY,
        y: Number.NEGATIVE_INFINITY,
      };
    }
    // Condensed: log integration for first node every 30 frames - only when debug logging is enabled
    const DEBUG_LOG_INTERVAL = 300; // frames
    let debugFrameCount = 0;
    if (SIM_CONFIG.enableDebugLogging && this === (globalThis as any)._debugFirstNode) {
      debugFrameCount++;
      if (debugFrameCount % DEBUG_LOG_INTERVAL === 0) {
        console.debug('[DEBUG][PointMass2D] integrate', {
          position: this.position,
          velocity: this.velocity,
          force: { x: fx, y: fy }, // Use stored force values
          dt,
        });
      }
    }
    // Note: Force accumulator was already reset at the beginning of integration
  }

  // Reset the force accumulator
  resetForce(): void {
    this.force.x = 0;
    this.force.y = 0;
  }

  static getFromPool(position: { x: number; y: number }, mass: number = 1.0, damping: number = 0.0): PointMass2D {
    const obj = this._pool.pop();
    if (obj) {
      obj.position.x = position.x;
      obj.position.y = position.y;
      obj.velocity.x = 0;
      obj.velocity.y = 0;
      obj.force.x = 0;
      obj.force.y = 0;
      obj.mass = mass;
      obj.damping = damping;
      obj.dirty = true;
      return obj;
    }
    return new PointMass2D(position, mass, damping);
  }
  static releaseToPool(obj: PointMass2D) {
    this._pool.push(obj);
  }
  static fromParams(position: { x: number; y: number }, params: CellParameters): PointMass2D {
    // For soft-body systems, per-point damping should be 0 - all damping handled by springs
    return this.getFromPool(position, params.mass, 0.0);
  }
}
