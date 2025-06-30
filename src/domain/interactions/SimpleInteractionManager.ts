// DirectInteractionManager.ts - REWRITTEN FOR CLEAN PHYSICS
// SIMPLIFIED INTERACTION MANAGER - NO COORDINATE SCALING COMPLEXITY
// Manages all user interactions with direct physics approach

import { PointMass2D } from '../PointMass2D';
import { HexSoftBody } from '../HexSoftBody';
import { DirectUserInteraction } from './DirectUserInteraction';
import { DebugLogger } from '../../infrastructure/DebugLogger';
import { CoordinateTransform } from '../../application/CoordinateTransform';
import { DIRECT_INTERACTION_CONFIG } from './DirectInteractionConfig';

export class SimpleInteractionManager {
  private body: HexSoftBody;
  private activeInteraction: DirectUserInteraction | null = null;
  private coordinateTransform: CoordinateTransform;

  constructor(body: HexSoftBody, coordinateTransform: CoordinateTransform) {
    this.body = body;
    this.coordinateTransform = coordinateTransform;
  }

  // Start dragging a node - REWRITTEN FOR DIRECT PHYSICS
  startDrag(node: PointMass2D, screenPosition: { x: number; y: number }): void {
    // End any existing interaction first
    this.endDrag();
    
    // Convert screen position to physics ONCE and create direct interaction
    const physicsPosition = this.coordinateTransform.screenToPhysics(screenPosition.x, screenPosition.y);
    
    // LOUD DEBUGGING - see what coordinate conversion produces
    DebugLogger.log('user-interaction', `SIMPLE INTERACTION MANAGER START DRAG at ${Date.now()}`, {
      screenPosition,
      physicsPosition,
      nodePosition: {
        x: node.getPositionX(),
        y: node.getPositionY()
      }
    });
    
    this.activeInteraction = new DirectUserInteraction(node, physicsPosition);
    
    DebugLogger.log('user-interaction', `Direct drag started at ${Date.now()}`, {
      nodeId: this.getNodeId(node),
      screenPosition,
      physicsPosition,
      config: DIRECT_INTERACTION_CONFIG
    });
  }

  // Update drag target position - SIMPLIFIED
  updateDrag(screenPosition: { x: number; y: number }): void {
    if (this.activeInteraction) {
      // Convert screen to physics ONCE
      const physicsPosition = this.coordinateTransform.screenToPhysics(screenPosition.x, screenPosition.y);
      this.activeInteraction.updateTarget(physicsPosition);
    }
  }

  // End drag interaction
  endDrag(): void {
    if (this.activeInteraction) {
      this.activeInteraction.startRelease();
      console.log('[SimpleInteractionManager] Started interaction release');
    }
  }

  // Update all interactions (call each frame)
  update(dt: number): void {
    if (this.activeInteraction) {
      const stillActive = this.activeInteraction.update(dt);
      if (!stillActive) {
        console.log('[SimpleInteractionManager] Interaction completed');
        this.activeInteraction = null;
      }
    }
  }

  // Check if any interaction is active
  hasActiveInteraction(): boolean {
    return this.activeInteraction !== null;
  }

  // Get the currently interacting node (if any)
  getActiveNode(): PointMass2D | null {
    return this.activeInteraction ? this.activeInteraction.getTargetNode() : null;
  }

  // Apply global damping to help system return to rest state
  // This is called after all forces are applied but before integration
  applyGlobalRestoreDamping(): void {
    if (this.activeInteraction) {
      // Don't apply global damping during active interaction
      return;
    }

    // Apply very light global damping to help system settle to rest
    const globalDampingFactor = 0.02; // Very light - 2% velocity reduction per frame
    
    let totalKineticEnergy = 0;
    let nodesInMotion = 0;
    
    for (const node of this.body.nodes) {
      const vx = node.getVelocityX();
      const vy = node.getVelocityY();
      
      // Calculate kinetic energy
      const speed = Math.sqrt(vx * vx + vy * vy);
      totalKineticEnergy += 0.5 * node.mass * speed * speed;
      
      // Only apply damping if velocity is above threshold
      if (speed > 0.1) { // Only damp if moving significantly
        nodesInMotion++;
        const newVx = vx * (1 - globalDampingFactor);
        const newVy = vy * (1 - globalDampingFactor);
        node.setVelocity(newVx, newVy);
      }
    }
    
    // Log system state for analysis
    if (Math.random() < 0.01) { // 1% sample rate
      DebugLogger.log('system-event', 'System damping applied', {
        timestamp: Date.now(),
        totalKineticEnergy,
        nodesInMotion,
        totalNodes: this.body.nodes.length,
        averageEnergyPerNode: totalKineticEnergy / this.body.nodes.length,
        systemAtRest: nodesInMotion === 0
      });
    }
  }

  // Set force realism scale on the active interaction (if any)
  public setForceRealismScale(val: number): void {
    if (this.activeInteraction && typeof this.activeInteraction.setForceRealismScale === 'function') {
      this.activeInteraction.setForceRealismScale(val);
    }
  }

  // Helper method to get node ID for logging
  private getNodeId(node: PointMass2D): string {
    return (node as any)._nodeId || (node as any)._id || 'unknown';
  }
}
