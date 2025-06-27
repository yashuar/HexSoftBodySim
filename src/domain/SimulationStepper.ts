// SimulationStepper.ts
// Modularizes the simulation step logic for PhysicsWorld2D

import { HexSoftBody } from '../domain/HexSoftBody';
import { Gravity2D } from '../domain/forces/Gravity2D';
import { PressureForce2D } from '../domain/forces/PressureForce2D';
import { Integrator2D } from '../domain/Integrator2D';
import { VolumeConstraint2D } from '../domain/constraints/VolumeConstraint2D';
import { SpringConstraint2D } from '../domain/constraints/SpringConstraint2D';
import { GroundConstraint2D } from '../domain/constraints/GroundConstraint2D';
import { UserConstraint2D } from '../domain/constraints/UserConstraint2D';

export interface SimulationStepContext {
  bodies: HexSoftBody[];
  gravityForce: Gravity2D;
  pressureForce: PressureForce2D;
  volumeConstraints: VolumeConstraint2D[];
  springConstraints: SpringConstraint2D[];
  userConstraints: UserConstraint2D[];
  groundConstraints: GroundConstraint2D[];
  enableGround: boolean;
  iterationBudget: number;
  maxDt: number;
}

export class SimulationStepper {
  static step(ctx: SimulationStepContext, dt: number) {
    dt = Math.min(dt, ctx.maxDt);
    // 1. Force Phase (updated to pass timestep to springs)
    for (const body of ctx.bodies) {
      ctx.gravityForce.apply(body.nodes);
      body.applyMooneyRivlinForces();
      body.applySpringForces(dt); // Pass timestep for improved stability
      for (const cell of body.cells) {
        ctx.pressureForce.apply(cell);
      }
    }
    // 2. Constraint Phase
    for (let iter = 0; iter < ctx.iterationBudget; iter++) {
      for (const vConstraint of ctx.volumeConstraints) vConstraint.apply();
      for (const sConstraint of ctx.springConstraints) sConstraint.apply();
    }
    // Only log user constraints if present, and only once per second
    if (ctx.userConstraints && ctx.userConstraints.length > 0) {
      const now = performance.now();
      if (!SimulationStepper._lastUserConstraintLogTime || now - SimulationStepper._lastUserConstraintLogTime > 1000) {
        console.log(`[SimulationStepper] Applying ${ctx.userConstraints.length} user constraint(s)`);
        SimulationStepper._lastUserConstraintLogTime = now;
      }
    }
    for (const uConstraint of ctx.userConstraints) uConstraint.apply();
    // 3. Integration
    for (const body of ctx.bodies) Integrator2D.semiImplicitEuler(body.nodes, dt);
    // 4. Ground Constraint
    if (ctx.enableGround) for (const gConstraint of ctx.groundConstraints) gConstraint.apply();
    // 5. Sync Policy: (not implemented)
  }

  // Track last log time for user constraint logging
  private static _lastUserConstraintLogTime: number = 0;
}
