import { PointMass2D } from '../PointMass2D';

// UserConstraint2D: Pins or drags a node to a user-specified position (e.g., mouse/touch)
export class UserConstraint2D {
  node: PointMass2D;
  target: { x: number; y: number };
  strength: number; // 0 = no effect, higher = stiffer
  enabled: boolean;
  isReleasing: boolean = false; // Flag for gradual release
  releaseTimer: number = 0; // Time since release started
  releaseDuration: number = 0.15; // Reduced from 0.3 to 0.15 seconds for faster momentum dissipation

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

  // Start gradual release instead of immediate removal
  startRelease() {
    this.isReleasing = true;
    this.releaseTimer = 0;
    console.log('[UserConstraint2D] Starting gradual release');
  }

  // Update release timer
  updateRelease(dt: number): boolean {
    if (!this.isReleasing) return false;
    
    this.releaseTimer += dt;
    if (this.releaseTimer >= this.releaseDuration) {
      this.enabled = false;
      return true; // Release complete
    }
    return false; // Still releasing
  }

  // Get the current effective strength during release
  getEffectiveStrength(): number {
    if (!this.isReleasing) return this.strength;
    
    // Gradually reduce strength during release
    const releaseProgress = this.releaseTimer / this.releaseDuration;
    const strengthMultiplier = 1 - releaseProgress;
    return this.strength * strengthMultiplier;
  }

  // Force-based application for use during force phase (before integration)
  applyForce() {
    if (!this.enabled) return;
    
    // Apply a strong spring-like force to pull node toward target
    let dx = this.target.x - this.node.getPositionX();
    let dy = this.target.y - this.node.getPositionY();
    let distance = Math.sqrt(dx * dx + dy * dy);
    
    // Prevent explosions from very large distances
    const maxDistance = 100; // Limit interaction distance
    if (distance > maxDistance) {
      console.warn(`[UserConstraint2D] Distance too large: ${distance.toFixed(2)}, clamping to ${maxDistance}`);
      const scale = maxDistance / distance;
      dx = dx * scale;
      dy = dy * scale;
      distance = maxDistance;
    }
    
    // Use effective strength (reduced during release)
    const effectiveStrength = Math.min(this.getEffectiveStrength(), 1000); // Cap at 1000 for safety
    let fx = dx * effectiveStrength;
    let fy = dy * effectiveStrength;
    
    // Clamp the force to prevent instability
    const maxForce = 5000; // Reduced from 1e5 for stability
    const mag = Math.sqrt(fx * fx + fy * fy);
    if (mag > maxForce) {
      console.warn(`[UserConstraint2D] Force too large: ${mag.toFixed(2)}, clamping to ${maxForce}`);
      fx = (fx / mag) * maxForce;
      fy = (fy / mag) * maxForce;
    }
    
    // Enhanced velocity damping during release to prevent momentum buildup
    let dampingFactor = Math.min(0.1, distance * 0.01); // Base damping
    if (this.isReleasing) {
      // AGGRESSIVE momentum dissipation during release
      const releaseProgress = this.releaseTimer / this.releaseDuration;
      // Start with heavy damping and maintain it throughout release
      const releaseDamping = 0.8 + 0.15 * releaseProgress; // 80% to 95% velocity reduction
      dampingFactor = Math.max(dampingFactor, releaseDamping);
      
      // Additional: apply counter-force to actively stop the node
      const velocityMag = Math.sqrt(this.node.getVelocityX() * this.node.getVelocityX() + this.node.getVelocityY() * this.node.getVelocityY());
      if (velocityMag > 0.1) { // If moving significantly
        const counterForceStrength = 500 * releaseProgress; // Increase counter-force over time
        const velDirX = this.node.getVelocityX() / velocityMag;
        const velDirY = this.node.getVelocityY() / velocityMag;
        this.node.addForce(-velDirX * counterForceStrength, -velDirY * counterForceStrength);
      }
    }
    
    this.node.scaleVelocity(1 - dampingFactor);
    
    this.node.addForce(fx, fy);
    
    if (this.isReleasing) {
      console.log(`[UserConstraint2D] Releasing - strength: ${effectiveStrength.toFixed(1)}, damping: ${dampingFactor.toFixed(3)}`);
    } else {
      console.log(`[UserConstraint2D] Force: (${fx.toFixed(2)}, ${fy.toFixed(2)}) at distance ${distance.toFixed(2)}`);
    }
    console.debug('[DEBUG][UserConstraint2D] applyForce', { fx, fy, distance, effectiveStrength, dampingFactor, node: this.node });
  }

  // Position-based application for use during constraint phase (after integration)
  // Only used for fine-tuning, not primary interaction
  apply() {
    if (!this.enabled) return;
    
    // Minimal position correction for very close targets only
    const dx = this.target.x - this.node.getPositionX();
    const dy = this.target.y - this.node.getPositionY();
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Only apply position correction for very precise targeting
    if (distance < 0.05) {
      const correctionFactor = 0.1; // Very light position correction
      this.node.translatePosition(dx * correctionFactor, dy * correctionFactor);
      
      console.log(`[UserConstraint2D] Fine position correction at distance ${distance.toFixed(3)}`);
    }
  }
}
