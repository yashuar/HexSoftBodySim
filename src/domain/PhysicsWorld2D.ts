// PhysicsWorld2D: Orchestrates the simulation step, manages soft bodies, applies forces and constraints, and enforces sync policy.
// Integrates with HexSoftBody, force generators, and constraints.

import { HexSoftBody } from './HexSoftBody';
import { Gravity2D } from './forces/Gravity2D';
import { PressureForce2D } from './forces/PressureForce2D';
import { Integrator2D } from './Integrator2D';
import { VolumeConstraint2D } from './constraints/VolumeConstraint2D';
import { GroundConstraint2D } from './constraints/GroundConstraint2D';
import { UserConstraint2D } from './constraints/UserConstraint2D';
import { SimulationStepper } from './SimulationStepper';
import { SIM_CONFIG } from '../config';
import { DebugLogger } from '../infrastructure/DebugLogger';

export class PhysicsWorld2D {
  // All soft bodies in the world
  bodies: HexSoftBody[] = [];

  // Constraints for all bodies
  volumeConstraints: VolumeConstraint2D[] = [];
  groundConstraints: GroundConstraint2D[] = [];

  // User-defined constraints
  userConstraints: UserConstraint2D[] = [];

  // Post-interaction momentum dissipation
  recentlyReleasedNodes: Map<any, number> = new Map(); // node -> release timestamp
  postReleaseDamping: number = 0.95; // Damping factor for recently released nodes
  postReleaseDuration: number = 1.0; // Duration in seconds to apply post-release damping

  // Simulation parameters
  gravity: { x: number; y: number } = SIM_CONFIG.gravity;
  globalPressure: number = SIM_CONFIG.globalPressure;
  maxDt: number = SIM_CONFIG.maxTimestep || 0.033;
  iterationBudget: number = 15; // (Optionally: expose in config if needed)

  // Modular force generators
  gravityForce: Gravity2D = new Gravity2D();
  pressureForce: PressureForce2D = new PressureForce2D();

  // Ground level
  groundY: number = 0;

  // Enable or disable ground constraint
  enableGround: boolean = SIM_CONFIG.enableGround;

  // Add a soft body to the world and register its constraints
  addBody(body: HexSoftBody): void {
    this.bodies.push(body);
    // Register volume constraints for each cell
    for (const cell of body.cells) {
      this.volumeConstraints.push(new VolumeConstraint2D(cell));
    }
    // Note: Springs are handled directly via body.applySpringForces(), not as constraints
    // Register ground constraint for this body if enabled
    if (this.enableGround) {
      this.groundConstraints.push(new GroundConstraint2D(body, this.groundY));
    }
  }

  // Register a node as recently released for post-interaction damping
  addRecentlyReleasedNode(node: any): void {
    this.recentlyReleasedNodes.set(node, performance.now());
    DebugLogger.log('system-event', 'Registered node for post-release damping', { node });
  }

  // Apply post-release damping to recently released nodes
  private applyPostReleaseDamping(): void {
    const now = performance.now();
    const nodesToRemove: any[] = [];
    
    for (const [node, releaseTime] of this.recentlyReleasedNodes) {
      const timeSinceRelease = (now - releaseTime) / 1000; // Convert to seconds
      
      if (timeSinceRelease > this.postReleaseDuration) {
        nodesToRemove.push(node);
      } else {
        // Apply progressive damping (stronger right after release, weaker over time)
        const dampingStrength = 1 - (timeSinceRelease / this.postReleaseDuration);
        const dampingFactor = 1 - (this.postReleaseDamping - 1) * dampingStrength;
        
        node.velocity.x *= dampingFactor;
        node.velocity.y *= dampingFactor;
      }
    }
    
    // Clean up expired nodes
    for (const node of nodesToRemove) {
      this.recentlyReleasedNodes.delete(node);
    }
  }

  // FPS logging state
  private _lastFpsLogTime: number = 0;
  private _frameCount: number = 0;
  private _lastDt: number = 0;

  // Main simulation step (multi-stage solver)
  simulateStep(dt: number, uiController?: { applyInteractionForces: () => { extraVolumeConstraints?: any[] } }): void {
    // FPS and dt logging, once per second - only when debug logging is enabled
    if (SIM_CONFIG.enableDebugLogging) {
      this._frameCount++;
      this._lastDt = dt;
      const now = performance.now();
      if (now - this._lastFpsLogTime >= 1000) {
        const fps = this._frameCount / ((now - this._lastFpsLogTime) / 1000);
        DebugLogger.log('performance', 'FPS and dt', { fps: fps.toFixed(1), dt: this._lastDt });
        this._lastFpsLogTime = now;
        this._frameCount = 0;
      }
    }

    // Sync globalPressure to PressureForce2D before each step
    this.pressureForce.pressure = this.globalPressure;

    // Apply post-release damping before physics step
    this.applyPostReleaseDamping();

    SimulationStepper.step({
      bodies: this.bodies,
      gravityForce: this.gravityForce,
      pressureForce: this.pressureForce,
      volumeConstraints: this.volumeConstraints,
      userConstraints: this.userConstraints,
      groundConstraints: this.groundConstraints,
      enableGround: this.enableGround,
      iterationBudget: this.iterationBudget,
      maxDt: this.maxDt,
      worldGravity: this.gravity,
      uiController
    }, dt);
  }
}
