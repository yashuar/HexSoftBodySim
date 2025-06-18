// PhysicsWorld2D: Orchestrates the simulation step, manages soft bodies, applies forces and constraints, and enforces sync policy.
// Integrates with HexSoftBody, force generators, and constraints.

import { HexSoftBody } from './HexSoftBody';
import { Gravity2D } from './forces/Gravity2D';
import { PressureForce2D } from './forces/PressureForce2D';
import { Integrator2D } from './Integrator2D';
import { VolumeConstraint2D } from './constraints/VolumeConstraint2D';
import { SpringConstraint2D } from './constraints/SpringConstraint2D';
import { GroundConstraint2D } from './constraints/GroundConstraint2D';
import { UserConstraint2D } from './constraints/UserConstraint2D';
import { SimulationStepper } from './SimulationStepper';

export class PhysicsWorld2D {
  // All soft bodies in the world
  bodies: HexSoftBody[] = [];

  // Constraints for all bodies
  volumeConstraints: VolumeConstraint2D[] = [];
  springConstraints: SpringConstraint2D[] = [];
  groundConstraints: GroundConstraint2D[] = [];

  // User-defined constraints
  userConstraints: UserConstraint2D[] = [];

  // Simulation parameters
  gravity: { x: number; y: number } = { x: 0, y: 0 };
  globalPressure: number = 0;
  maxDt: number = 0.033; // 30 FPS default
  iterationBudget: number = 5;

  // Modular force generators
  gravityForce: Gravity2D = new Gravity2D();
  pressureForce: PressureForce2D = new PressureForce2D();

  // Ground level
  groundY: number = 0;

  // Enable or disable ground constraint
  enableGround: boolean = true;

  // Add a soft body to the world and register its constraints
  addBody(body: HexSoftBody): void {
    this.bodies.push(body);
    // Register volume constraints for each cell
    for (const cell of body.cells) {
      this.volumeConstraints.push(new VolumeConstraint2D(cell));
    }
    // Register spring constraints for each spring
    for (const spring of body.springs) {
      this.springConstraints.push(new SpringConstraint2D(spring));
    }
    // Register ground constraint for this body if enabled
    if (this.enableGround) {
      this.groundConstraints.push(new GroundConstraint2D(body, this.groundY));
    }
  }

  // FPS logging state
  private _lastFpsLogTime: number = 0;
  private _frameCount: number = 0;
  private _lastDt: number = 0;

  // Main simulation step (multi-stage solver)
  simulateStep(dt: number): void {
    // FPS and dt logging, once per second
    this._frameCount++;
    this._lastDt = dt;
    const now = performance.now();
    if (now - this._lastFpsLogTime >= 1000) {
      const fps = this._frameCount / ((now - this._lastFpsLogTime) / 1000);
      console.log(`[DEBUG][PhysicsWorld2D] FPS: ${fps.toFixed(1)}, dt: ${this._lastDt}`);
      this._lastFpsLogTime = now;
      this._frameCount = 0;
    }
    SimulationStepper.step({
      bodies: this.bodies,
      gravityForce: this.gravityForce,
      pressureForce: this.pressureForce,
      volumeConstraints: this.volumeConstraints,
      springConstraints: this.springConstraints,
      userConstraints: this.userConstraints,
      groundConstraints: this.groundConstraints,
      enableGround: this.enableGround,
      iterationBudget: this.iterationBudget,
      maxDt: this.maxDt,
    }, dt);
  }
}
