// Gravity2D: Modular gravity force generator for the simulation engine.
// Can be attached to any set of nodes.

import { PointMass2D } from '../PointMass2D';
import { SIM_CONFIG } from '../../config';
import { DebugLogger } from '../../infrastructure/DebugLogger';

export class Gravity2D {
  gravity: { x: number; y: number };

  constructor(gravity: { x: number; y: number } = { x: 0, y: 1 }) {
    this.gravity = gravity;
  }

  // Apply gravity to a set of nodes
  apply(nodes: PointMass2D[], worldGravity?: { x: number; y: number }): void {
    // Use world gravity if provided, otherwise fall back to instance gravity, then config
    const gravity = worldGravity || this.gravity || SIM_CONFIG.gravity;
    
    // Clamp gravity to safe range (increased for high-mass soft bodies)
    const safeGravity = {
      x: Math.max(-100, Math.min(gravity.x, 100)), // ±100 m/s² for high-mass systems
      y: Math.max(-100, Math.min(gravity.y, 100))
    };
    
    for (const node of nodes) {
      const fx = safeGravity.x * node.mass;
      const fy = safeGravity.y * node.mass;
      if (Math.abs(fx) > 1e3 || Math.abs(fy) > 1e3) {
        DebugLogger.log('gravity', 'Gravity force explosion', { fx, fy, gravity: safeGravity, mass: node.mass, node });
      }
      node.applyForce({ x: fx, y: fy });
    }
  }
}
