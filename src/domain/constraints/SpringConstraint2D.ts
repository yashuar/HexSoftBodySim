// SpringConstraint2D: Enforces the rest length of a spring between two nodes.
// Used for position-based or force-based spring correction.

import { Spring2D } from '../Spring2D';

export class SpringConstraint2D {
  spring: Spring2D;
  stiffness: number;

  constructor(spring: Spring2D, stiffness: number = 1.0) {
    this.spring = spring;
    this.stiffness = stiffness;
  }

  // Apply a position-based correction to enforce the rest length
  apply(): void {
    const a = this.spring.a;
    const b = this.spring.b;
    const dx = b.position.x - a.position.x;
    const dy = b.position.y - a.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1e-8;
    const diff = (dist - this.spring.restLength) / dist;
    // Move each node half the correction (if both are movable)
    const correction = 0.5 * this.stiffness * diff;
    a.position.x += correction * dx;
    a.position.y += correction * dy;
    b.position.x -= correction * dx;
    b.position.y -= correction * dy;
  }
}
