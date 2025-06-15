// PhysicsWorld2D: Orchestrates the simulation step, manages soft bodies, applies forces and constraints, and enforces sync policy.
// Integrates with HexSoftBody, force generators, and constraints.

import { HexSoftBody } from './HexSoftBody';
import { Gravity2D } from './forces/Gravity2D';
import { PressureForce2D } from './forces/PressureForce2D';
import { Integrator2D } from './Integrator2D';
import { VolumeConstraint2D } from './constraints/VolumeConstraint2D';
import { SpringConstraint2D } from './constraints/SpringConstraint2D';
import { GroundConstraint2D } from './constraints/GroundConstraint2D';

export class PhysicsWorld2D {
  // All soft bodies in the world
  bodies: HexSoftBody[] = [];

  // Constraints for all bodies
  volumeConstraints: VolumeConstraint2D[] = [];
  springConstraints: SpringConstraint2D[] = [];
  groundConstraints: GroundConstraint2D[] = [];

  // Simulation parameters
  gravity: { x: number; y: number } = { x: 0, y: 9.81 };
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

  // Main simulation step (multi-stage solver)
  simulateStep(dt: number): void {
    // Clamp dt for stability
    dt = Math.min(dt, this.maxDt);

    // 1. Force Phase: apply external and internal forces
    for (const body of this.bodies) {
      // Apply gravity using modular force generator
      this.gravityForce.apply(body.nodes);
      // Apply Mooney-Rivlin (hyperelastic) forces at cell level
      body.applyMooneyRivlinForces();
      // Apply spring forces (linear, non-linear, strain-stiffening)
      body.applySpringForces();
      // Apply pressure force to each cell
      for (const cell of body.cells) {
        this.pressureForce.apply(cell);
      }
    }

    // 2. Constraint Phase: enforce constraints (e.g., volume, springs)
    for (let iter = 0; iter < this.iterationBudget; iter++) {
      for (const vConstraint of this.volumeConstraints) {
        vConstraint.apply();
      }
      for (const sConstraint of this.springConstraints) {
        sConstraint.apply();
      }
    }
    // 3. Integration Phase: update positions and velocities using Integrator2D
    for (const body of this.bodies) {
      Integrator2D.semiImplicitEuler(body.nodes, dt);
    }
    // 4. Ground Constraint Phase: enforce ground after all other constraints and integration
    if (this.enableGround) {
      for (const gConstraint of this.groundConstraints) {
        gConstraint.apply();
      }
    }

    // 5. Sync Policy: (not implemented) - double-buffer, worker sync, etc.
  }
}
