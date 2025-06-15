// Spring2D: Represents a spring constraint between two PointMass2D objects in the simulation engine.
// Responsible for applying spring force (Hooke's law) and optional damping between the two masses.
// Used to connect nodes in the hexagonal mesh for elastic behavior.

import { PointMass2D } from './PointMass2D';

export class Spring2D {
  // The two point masses connected by this spring
  a: PointMass2D;
  b: PointMass2D;

  // Rest length of the spring (distance at equilibrium)
  restLength: number;

  // Spring stiffness (Hooke's constant)
  stiffness: number;

  // Damping factor for relative velocity along the spring
  damping: number;

  // Apply spring force and damping to the connected point masses
  // Supports non-Hookean (cubic) force law if nonLinearCoeff is set
  nonLinearCoeff: number = 0; // k3 coefficient for cubic term (default 0 = linear)

  // Strain-stiffening parameters
  baseStiffness: number = 1.0; // k0: base (soft) stiffness
  stiffeningCoeff: number = 0.0; // k1: how much stiffness increases with strain
  stiffeningPower: number = 1.0; // p: exponent for strain-stiffening

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
    this.restLength = restLength;
    this.stiffness = stiffness;
    this.damping = damping;
    this.nonLinearCoeff = nonLinearCoeff;
    this.baseStiffness = baseStiffness;
    this.stiffeningCoeff = stiffeningCoeff;
    this.stiffeningPower = stiffeningPower;
  }

  // Apply spring force and damping to the connected point masses
  apply(): void {
    const dx = this.b.position.x - this.a.position.x;
    const dy = this.b.position.y - this.a.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1e-8; // Avoid division by zero
    const dirX = dx / dist;
    const dirY = dy / dist;

    // Displacement from rest length
    const displacement = dist - this.restLength;
    const absDisp = Math.abs(displacement);

    // Strain-stiffening: effective stiffness increases with strain
    const kEff = this.baseStiffness + this.stiffeningCoeff * Math.pow(absDisp, this.stiffeningPower);

    // Non-Hookean force: F = kEff * x + k3 * x^3
    const forceMag = kEff * displacement + this.nonLinearCoeff * Math.pow(displacement, 3);

    // Relative velocity along the spring direction
    const relVelX = this.b.velocity.x - this.a.velocity.x;
    const relVelY = this.b.velocity.y - this.a.velocity.y;
    const relVelAlongSpring = relVelX * dirX + relVelY * dirY;

    // Damping force
    const dampingForce = this.damping * relVelAlongSpring;

    // Total force to apply (spring + damping)
    const fx = (forceMag + dampingForce) * dirX;
    const fy = (forceMag + dampingForce) * dirY;

    // Apply equal and opposite forces
    this.a.applyForce({ x: fx, y: fy });
    this.b.applyForce({ x: -fx, y: -fy });
  }
}
