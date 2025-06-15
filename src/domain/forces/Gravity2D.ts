// Gravity2D: Modular gravity force generator for the simulation engine.
// Can be attached to any set of nodes.

import { PointMass2D } from '../PointMass2D';

export class Gravity2D {
  gravity: { x: number; y: number };

  constructor(gravity: { x: number; y: number } = { x: 0, y: 9.81 }) {
    this.gravity = gravity;
  }

  // Apply gravity to a set of nodes
  apply(nodes: PointMass2D[]): void {
    for (const node of nodes) {
      node.applyForce({ x: this.gravity.x * node.mass, y: this.gravity.y * node.mass });
    }
  }
}
