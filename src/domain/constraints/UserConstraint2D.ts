import { PointMass2D } from '../PointMass2D';

// UserConstraint2D: Pins or drags a node to a user-specified position (e.g., mouse/touch)
export class UserConstraint2D {
  node: PointMass2D;
  target: { x: number; y: number };
  strength: number; // 0 = no effect, higher = stiffer
  enabled: boolean;

  constructor(node: PointMass2D, target: { x: number; y: number }, strength = 200, enabled = true) {
    this.node = node;
    this.target = { ...target };
    this.strength = strength;
    this.enabled = enabled;
    console.debug('[DEBUG][UserConstraint2D] Created for node', node, 'target', target, 'strength', strength);
  }

  setTarget(target: { x: number; y: number }) {
    const oldTarget = this.target ? { ...this.target } : undefined;
    this.target = { ...target };
    if (!oldTarget || oldTarget.x !== target.x || oldTarget.y !== target.y) {
      console.log(`[UserConstraint2D] Drag target changed:`, oldTarget, '->', target);
    }
    console.debug('[DEBUG][UserConstraint2D] setTarget', target);
  }

  apply() {
    if (!this.enabled) return;
    // Apply a spring-like force to pull node to target
    const dx = this.target.x - this.node.position.x;
    const dy = this.target.y - this.node.position.y;
    let fx = dx * this.strength;
    let fy = dy * this.strength;
    // Clamp the force to a reasonable maximum to prevent runaway drift
    const maxForce = 100; // You can tune this value
    const mag = Math.sqrt(fx * fx + fy * fy);
    if (mag > maxForce) {
      fx = (fx / mag) * maxForce;
      fy = (fy / mag) * maxForce;
    }
    console.log(`[UserConstraint2D] Applying force: (${fx.toFixed(2)}, ${fy.toFixed(2)}) to node at (${this.node.position.x.toFixed(2)}, ${this.node.position.y.toFixed(2)}) target: (${this.target.x.toFixed(2)}, ${this.target.y.toFixed(2)})`);
    this.node.applyForce({ x: fx, y: fy });
    console.debug('[DEBUG][UserConstraint2D] apply force', { fx, fy, node: this.node });
  }
}
