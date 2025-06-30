// PointMass2D: Represents a point mass in 2D space for the simulation engine.
// Core properties: position, velocity, mass, force accumulator, and damping.

import { CellParameters } from './CellParameters';
import { DebugLogger } from '../infrastructure/DebugLogger';
import { SIM_CONFIG } from '../config';

import type { HexCell } from './HexCell';

export class PointMass2D {
  cellRefs?: HexCell[];
  
  // PRIVATE internal state - should only be accessed via methods
  private _position: { x: number; y: number };
  private _velocity: { x: number; y: number };
  private _force: { x: number; y: number };

  // Mass of the point (must be > 0)
  mass: number;

  // Damping factor (0 = no damping, 1 = full damping)
  damping: number;

  // PUBLIC ACCESSORS - Controlled access to internal state
  get position(): { x: number; y: number } {
    return { x: this._position.x, y: this._position.y }; // Return copy to prevent mutation
  }

  get velocity(): { x: number; y: number } {
    return { x: this._velocity.x, y: this._velocity.y }; // Return copy to prevent mutation
  }

  get force(): { x: number; y: number } {
    return { x: this._force.x, y: this._force.y }; // Return copy to prevent mutation
  }

  // DEPRECATED PROPERTY ACCESSORS - For backward compatibility only
  // These will show warnings to encourage migration to proper methods
  set position(value: { x: number; y: number }) {
    console.warn('[DEPRECATED] Direct position assignment. Use setPosition(x, y) instead.');
    this._position.x = value.x;
    this._position.y = value.y;
  }

  set velocity(value: { x: number; y: number }) {
    console.warn('[DEPRECATED] Direct velocity assignment. Use setVelocity(vx, vy) instead.');
    this._velocity.x = value.x;
    this._velocity.y = value.y;
  }

  set force(value: { x: number; y: number }) {
    console.warn('[DEPRECATED] Direct force assignment. Use setForce(fx, fy) or addForce(fx, fy) instead.');
    this._force.x = value.x;
    this._force.y = value.y;
  }

  // POSITION METHODS
  getPositionX(): number { return this._position.x; }
  getPositionY(): number { return this._position.y; }
  
  setPosition(x: number, y: number): void {
    this._position.x = x;
    this._position.y = y;
  }
  
  setPositionX(x: number): void { this._position.x = x; }
  setPositionY(y: number): void { this._position.y = y; }
  
  translatePosition(dx: number, dy: number): void {
    this._position.x += dx;
    this._position.y += dy;
  }

  // VELOCITY METHODS
  getVelocityX(): number { return this._velocity.x; }
  getVelocityY(): number { return this._velocity.y; }
  
  setVelocity(vx: number, vy: number): void {
    this._velocity.x = vx;
    this._velocity.y = vy;
  }
  
  setVelocityX(vx: number): void { this._velocity.x = vx; }
  setVelocityY(vy: number): void { this._velocity.y = vy; }

  scaleVelocity(factor: number): void {
    this._velocity.x *= factor;
    this._velocity.y *= factor;
  }

  // FORCE METHODS
  getForceX(): number { return this._force.x; }
  getForceY(): number { return this._force.y; }
  
  addForce(fx: number, fy: number): void {
    this._force.x += fx;
    this._force.y += fy;
  }
  
  setForce(fx: number, fy: number): void {
    this._force.x = fx;
    this._force.y = fy;
  }

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
    this._position = { ...position };
    this._velocity = { x: 0, y: 0 };
    this._force = { x: 0, y: 0 };
    this.mass = mass;
    this.damping = damping;
  }

  // Apply a force to this point mass (accumulates until next integration)
  applyForce(force: { x: number; y: number }): void {
    this._force.x += force.x;
    this._force.y += force.y;
  }

  // Integrate position and velocity using semi-implicit Euler
  integrate(dt: number): void {
    if (this.mass <= 0) return;
    const EPSILON = 0.01;
    // Store old position and velocity for comparison
    const oldX = this._position.x;
    const oldY = this._position.y;
    const oldVx = this._velocity.x;
    const oldVy = this._velocity.y;
    let anomaly = false;
    
    // Store forces for this integration step (before clearing)
    const fx = this._force.x;
    const fy = this._force.y;
    
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
    this._velocity.x += clampedAx * dt;
    this._velocity.y += clampedAy * dt;
    
    // COORDINATE SYSTEM VELOCITY LIMITING: For a 20-unit wide physics world, 
    // Allow higher velocities to enable force propagation through the mesh
    const MAX_VELOCITY = 5.0; // 5 physics units per second (25% of world width)
    const velMagnitude = Math.sqrt(this._velocity.x * this._velocity.x + this._velocity.y * this._velocity.y);
    if (velMagnitude > MAX_VELOCITY) {
      const scale = MAX_VELOCITY / velMagnitude;
      this._velocity.x *= scale;
      this._velocity.y *= scale;
      if (typeof DebugLogger !== 'undefined') {
        DebugLogger.log('pointmass', 'Velocity clamped to prevent instability', {
          originalMagnitude: velMagnitude,
          clampedMagnitude: MAX_VELOCITY,
          scaleFactor: scale
        });
      }
    }
    // Log if velocity changes by a large amount in one step (adjusted for coordinate system)
    if (Math.abs(this._velocity.x - oldVx) > 2.0 || Math.abs(this._velocity.y - oldVy) > 2.0) {
      anomaly = true;
      if (typeof DebugLogger !== 'undefined') DebugLogger.log('pointmass', 'Large velocity change in one step', {
        node: this,
        oldVx,
        oldVy,
        newVx: this._velocity.x,
        newVy: this._velocity.y,
        ax,
        ay,
        dt
      });
    }
    // Apply per-point damping (should be 0 for soft-body systems)
    // In soft-body physics, damping is handled by springs to avoid double-damping
    // which kills force propagation through the mesh
    if (this.damping > 0) {
      this._velocity.x *= 1 - this.damping;
      this._velocity.y *= 1 - this.damping;
    }
    // Update position
    this._position.x += this._velocity.x * dt;
    this._position.y += this._velocity.y * dt;
    // Log if position changes by a large amount in one step (adjusted for coordinate system)
    if (Math.abs(this._position.x - oldX) > 1.0 || Math.abs(this._position.y - oldY) > 1.0) {
      anomaly = true;
      if (typeof DebugLogger !== 'undefined') DebugLogger.log('pointmass', 'Large position change in one step', {
        node: this,
        oldX,
        oldY,
        newX: this._position.x,
        newY: this._position.y,
        velocity: { ...this._velocity },
        dt
      });
    }
    // Clamp position and velocity to prevent numerical explosions (adjusted for coordinate system)
    const MAX_POS = 100; // 100 physics units (5x world width)
    const MAX_VEL = 10;   // 10 physics units/second
    if (Math.abs(this._position.x) > MAX_POS || Math.abs(this._position.y) > MAX_POS || 
        Math.abs(this._velocity.x) > MAX_VEL || Math.abs(this._velocity.y) > MAX_VEL) {
      anomaly = true;
      if (typeof DebugLogger !== 'undefined') DebugLogger.log('pointmass', 'Exceeded coordinate system limits', {
        node: this,
        position: { ...this._position },
        velocity: { ...this._velocity },
        MAX_POS,
        MAX_VEL
      });
    }
    this._position.x = Math.max(-MAX_POS, Math.min(this._position.x, MAX_POS));
    this._position.y = Math.max(-MAX_POS, Math.min(this._position.y, MAX_POS));
    this._velocity.x = Math.max(-MAX_VEL, Math.min(this._velocity.x, MAX_VEL));
    this._velocity.y = Math.max(-MAX_VEL, Math.min(this._velocity.y, MAX_VEL));
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
      !isFinite(this._position.x) ||
      !isFinite(this._position.y) ||
      !isFinite(this._velocity.x) ||
      !isFinite(this._velocity.y)
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
      Math.abs(this._position.x) > 1e6 ||
      Math.abs(this._position.y) > 1e6 ||
      Math.abs(this._velocity.x) > 1e6 ||
      Math.abs(this._velocity.y) > 1e6
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
      Math.abs(oldX - this._position.x) > EPSILON ||
      Math.abs(oldY - this._position.y) > EPSILON;
    const velChanged =
      Math.abs(oldVx - this._velocity.x) > EPSILON ||
      Math.abs(oldVy - this._velocity.y) > EPSILON;
    if (SIM_CONFIG.enableDebugLogging && (posChanged || velChanged)) {
      PointMass2D._changeCount++;
      // Track min/max position
      PointMass2D._minPos.x = Math.min(PointMass2D._minPos.x, this._position.x);
      PointMass2D._minPos.y = Math.min(PointMass2D._minPos.y, this._position.y);
      PointMass2D._maxPos.x = Math.max(PointMass2D._maxPos.x, this._position.x);
      PointMass2D._maxPos.y = Math.max(PointMass2D._maxPos.y, this._position.y);
      // Track min/max velocity
      PointMass2D._minVel.x = Math.min(PointMass2D._minVel.x, this._velocity.x);
      PointMass2D._minVel.y = Math.min(PointMass2D._minVel.y, this._velocity.y);
      PointMass2D._maxVel.x = Math.max(PointMass2D._maxVel.x, this._velocity.x);
      PointMass2D._maxVel.y = Math.max(PointMass2D._maxVel.y, this._velocity.y);
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
    this._force.x = 0;
    this._force.y = 0;
  }

  static getFromPool(position: { x: number; y: number }, mass: number = 1.0, damping: number = 0.0): PointMass2D {
    const obj = this._pool.pop();
    if (obj) {
      obj.setPosition(position.x, position.y);
      obj.setVelocity(0, 0);
      obj.setForce(0, 0);
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
