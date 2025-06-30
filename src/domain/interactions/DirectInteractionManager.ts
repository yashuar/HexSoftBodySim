// DirectInteractionManager.ts
// SIMPLIFIED INTERACTION MANAGER - NO COORDINATE SCALING COMPLEXITY
// Works directly in physics space

import { PointMass2D } from '../PointMass2D';
import { DirectUserInteraction } from './DirectUserInteraction';
import { CoordinateTransform } from '../../application/CoordinateTransform';
import { DebugLogger } from '../../infrastructure/DebugLogger';

export class DirectInteractionManager {
  private currentInteraction: DirectUserInteraction | null = null;
  private coordinateTransform: CoordinateTransform;

  constructor(coordinateTransform: CoordinateTransform) {
    this.coordinateTransform = coordinateTransform;
  }

  // Start interaction - convert screen to physics ONCE and work in physics space
  startInteraction(node: PointMass2D, screenPosition: { x: number; y: number }): boolean {
    // Convert screen position to physics position ONCE
    const physicsPosition = this.coordinateTransform.screenToPhysics(screenPosition.x, screenPosition.y);
    
    // Create direct interaction in physics space
    this.currentInteraction = new DirectUserInteraction(node, physicsPosition);
    
    DebugLogger.log('user-interaction', 'Interaction started', {
      nodeId: this.getNodeId(node),
      screenPosition,
      physicsPosition,
      nodePhysicsPosition: {
        x: node.getPositionX(),
        y: node.getPositionY()
      }
    });

    return true;
  }

  // Update interaction - screen position converted to physics ONCE
  updateInteraction(screenPosition: { x: number; y: number }): void {
    if (!this.currentInteraction) return;

    // Convert screen to physics ONCE
    const physicsPosition = this.coordinateTransform.screenToPhysics(screenPosition.x, screenPosition.y);
    
    // Update target in physics space
    this.currentInteraction.updateTarget(physicsPosition);
  }

  // End interaction - simple and direct
  endInteraction(): void {
    if (this.currentInteraction) {
      this.currentInteraction.startRelease();
      // Note: interaction will deactivate itself on next update
    }
  }

  // Update all interactions
  update(dt: number): void {
    if (this.currentInteraction) {
      const stillActive = this.currentInteraction.update(dt);
      if (!stillActive) {
        DebugLogger.log('user-interaction', 'Interaction completed', {
          nodeId: this.currentInteraction ? this.getNodeId(this.currentInteraction.getTargetNode()) : 'unknown'
        });
        this.currentInteraction = null;
      }
    }
  }

  // Query methods
  hasActiveInteraction(): boolean {
    return this.currentInteraction !== null && this.currentInteraction.isActiveInteraction();
  }

  getCurrentInteraction(): DirectUserInteraction | null {
    return this.currentInteraction;
  }

  getTargetNode(): PointMass2D | null {
    return this.currentInteraction ? this.currentInteraction.getTargetNode() : null;
  }

  // Helper
  private getNodeId(node: PointMass2D): string {
    return (node as any)._nodeId || (node as any)._id || 'unknown';
  }
}
