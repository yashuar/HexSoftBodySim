// DirectUserInteraction.ts
// CLEAN, DIRECT USER INTERACTION SYSTEM
// No complex scaling - direct physics space manipulation

import { PointMass2D } from '../PointMass2D';
import { SIM_CONFIG } from '../../config';
import { DebugLogger } from '../../infrastructure/DebugLogger';
import { DIRECT_INTERACTION_CONFIG } from './DirectInteractionConfig';

export class DirectUserInteraction {
  private targetNode: PointMass2D;
  private targetPosition: { x: number; y: number }; // Already in physics coordinates
  private isActive: boolean = false;
  private isDragging: boolean = false;

  // SIMPLE, DIRECT PARAMETERS - no scaling complexity
  private readonly dragStiffness: number = DIRECT_INTERACTION_CONFIG.dragStiffness;
  private readonly dragDamping: number = DIRECT_INTERACTION_CONFIG.dragDamping;
  private readonly maxForce: number = DIRECT_INTERACTION_CONFIG.maxInteractionForce;

  // Force realism scaling
  private _forceRealismScale: number = SIM_CONFIG.forceRealismScale;
  setForceRealismScale(val: number) { this._forceRealismScale = val; }
  getForceRealismScale() { return this._forceRealismScale; }

  // State tracking
  private interactionStartTime: number = 0;
  private lastForce: { x: number; y: number } = { x: 0, y: 0 };

  constructor(node: PointMass2D, targetPhysicsPosition: { x: number; y: number }) {
    this.targetNode = node;
    this.targetPosition = { ...targetPhysicsPosition };
    this.isActive = true;
    this.isDragging = true;
    this.interactionStartTime = Date.now();
    this._forceRealismScale = SIM_CONFIG.forceRealismScale;

    // LOUD DEBUGGING - make sure this constructor is called
    DebugLogger.log('user-interaction', `DIRECT USER INTERACTION CONSTRUCTOR CALLED ${Math.random()}`, {
      nodePosition: this.getNodePosition(),
      targetPosition: this.targetPosition,
      displacement: {
        dx: this.targetPosition.x - this.getNodePosition().x,
        dy: this.targetPosition.y - this.getNodePosition().y
      }
    });

    DebugLogger.log('user-interaction', `Direct interaction started ${Math.random()}`, {
      nodeId: this.getNodeId(),
      physicsPosition: this.getNodePosition(),
      targetPosition: this.targetPosition
    });
  }

  // Update target position (already in physics coordinates)
  updateTarget(newPhysicsTarget: { x: number; y: number }): void {
    this.targetPosition = { ...newPhysicsTarget };
  }

  // Start release (no complex release animation - just stop dragging)
  startRelease(): void {
    this.isDragging = false;
    
    DebugLogger.log('user-interaction', `Direct interaction released at ${Date.now()}`, {
      nodeId: this.getNodeId(),
      finalPosition: this.getNodePosition(),
      finalVelocity: this.getNodeVelocity(),
      duration: Date.now() - this.interactionStartTime
    });
  }

  // Update the interaction - apply simple spring force
  update(dt: number): boolean {
    if (!this.isActive) return false;

    if (this.isDragging) {
      this.applyDragForce();
    } else {
      // Stop interaction immediately when released - let physics take over
      this.isActive = false;
    }

    return this.isActive;
  }

  private applyDragForce(): void {
    // Calculate displacement (simple vector from current to target)
    const nodePos = this.getNodePosition();
    let dx = this.targetPosition.x - nodePos.x;
    let dy = this.targetPosition.y - nodePos.y;

    // CRITICAL FIX: Prevent extreme displacement values that cause NaN
    const MAX_DISPLACEMENT = 5.0; // Maximum 5 physics units displacement
    const dispMagnitude = Math.sqrt(dx*dx + dy*dy);
    if (dispMagnitude > MAX_DISPLACEMENT) {
      const scale = MAX_DISPLACEMENT / dispMagnitude;
      dx *= scale;
      dy *= scale;
    }

    // Safety check for NaN/Infinity
    if (!isFinite(dx) || !isFinite(dy)) {
      console.error('[DirectUserInteraction] Invalid displacement:', { dx, dy, nodePos, targetPos: this.targetPosition });
      return; // Skip this frame
    }

    // Calculate velocity for damping
    const nodeVel = this.getNodeVelocity();

    // Safety check for velocity
    if (!isFinite(nodeVel.x) || !isFinite(nodeVel.y)) {
      console.error('[DirectUserInteraction] Invalid velocity:', nodeVel);
      return; // Skip this frame
    }

    // Apply simple spring-damper force: F = k*displacement - c*velocity
    // This is the standard physics formula - no complex scaling
    const springForceX = this.dragStiffness * dx;
    const springForceY = this.dragStiffness * dy;
    const dampingForceX = -this.dragDamping * nodeVel.x;
    const dampingForceY = -this.dragDamping * nodeVel.y;

    // Total force
    let totalForceX = springForceX + dampingForceX;
    let totalForceY = springForceY + dampingForceY;

    // Apply force realism scaling
    totalForceX *= this._forceRealismScale;
    totalForceY *= this._forceRealismScale;

    // Clamp to prevent explosions (simple magnitude clamp)
    const forceMagnitude = Math.sqrt(totalForceX * totalForceX + totalForceY * totalForceY);
    if (forceMagnitude > this.maxForce) {
      const scale = this.maxForce / forceMagnitude;
      totalForceX *= scale;
      totalForceY *= scale;
    }

    // Recalculate magnitude after clamping
    const finalForceMagnitude = Math.sqrt(totalForceX * totalForceX + totalForceY * totalForceY);

    // CRITICAL SAFETY: Final NaN check before applying force
    if (!isFinite(totalForceX) || !isFinite(totalForceY)) {
      console.error('[DirectUserInteraction] Invalid force about to be applied:', { 
        totalForceX, totalForceY, springForceX, springForceY, dampingForceX, dampingForceY 
      });
      return; // Skip this frame
    }

    // LOUD DEBUGGING - see what forces are being applied
    DebugLogger.log('user-interaction', `DIRECT FORCE APPLIED at ${Date.now()}`, {
      displacement: { dx, dy, magnitude: Math.sqrt(dx*dx + dy*dy) },
      springForce: { x: springForceX, y: springForceY },
      dampingForce: { x: dampingForceX, y: dampingForceY },
      totalForce: { x: totalForceX, y: totalForceY, magnitude: finalForceMagnitude },
      originalMagnitude: forceMagnitude, // Show both original and clamped
      stiffness: this.dragStiffness,
      damping: this.dragDamping,
      maxForce: this.maxForce,
      nodePosition: nodePos,
      nodeVelocity: nodeVel,
      targetPosition: this.targetPosition,
      forceRealismScale: this._forceRealismScale
    });

    // Apply force directly
    this.targetNode.applyForce({ x: totalForceX, y: totalForceY });

    // Store for logging
    this.lastForce = { x: totalForceX, y: totalForceY };

    // ALWAYS log for debugging (removed force magnitude threshold)
    DebugLogger.log('user-interaction', 'Direct force applied', {
      nodeId: this.getNodeId(),
      displacement: { dx, dy, magnitude: Math.sqrt(dx*dx + dy*dy) },
      springForce: { x: springForceX, y: springForceY },
      dampingForce: { x: dampingForceX, y: dampingForceY },
      totalForce: { x: totalForceX, y: totalForceY, magnitude: forceMagnitude },
      nodePosition: nodePos,
      nodeVelocity: nodeVel,
      targetPosition: this.targetPosition,
      forceRealismScale: this._forceRealismScale
    });
  }

  // Helper methods
  private getNodePosition(): { x: number; y: number } {
    return {
      x: this.targetNode.getPositionX(),
      y: this.targetNode.getPositionY()
    };
  }

  private getNodeVelocity(): { x: number; y: number } {
    return {
      x: this.targetNode.getVelocityX(),
      y: this.targetNode.getVelocityY()
    };
  }

  private getNodeId(): string {
    return (this.targetNode as any)._nodeId || (this.targetNode as any)._id || 'unknown';
  }

  // Public interface
  isActiveInteraction(): boolean {
    return this.isActive;
  }

  getTargetNode(): PointMass2D {
    return this.targetNode;
  }

  getLastForce(): { x: number; y: number } {
    return { ...this.lastForce };
  }
}
