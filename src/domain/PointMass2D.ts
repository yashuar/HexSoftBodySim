// PointMass2D: Represents a point mass in 2D space for the simulation engine.
// Core properties: position, velocity, mass, force accumulator, and damping.

export class PointMass2D {
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

  constructor(
    position: { x: number; y: number },
    mass: number = 1.0,
    damping: number = 0.01
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
    // Acceleration = F / m
    const ax = this.force.x / this.mass;
    const ay = this.force.y / this.mass;
    // Update velocity
    this.velocity.x += ax * dt;
    this.velocity.y += ay * dt;
    // Apply damping
    this.velocity.x *= 1 - this.damping;
    this.velocity.y *= 1 - this.damping;
    // Update position
    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;
    // Reset force accumulator
    this.resetForce();
  }

  // Reset the force accumulator
  resetForce(): void {
    this.force.x = 0;
    this.force.y = 0;
  }
}
