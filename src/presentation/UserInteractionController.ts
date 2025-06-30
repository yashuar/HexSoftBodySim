import { HexSoftBody } from '../domain/HexSoftBody';
import { PhysicsWorld2D } from '../domain/PhysicsWorld2D';
import { SimpleInteractionManager } from '../domain/interactions/SimpleInteractionManager';
import { PointMass2D } from '../domain/PointMass2D';
import { CoordinateTransform } from '../application/CoordinateTransform';
import { DebugLogger } from '../infrastructure/DebugLogger';

export class UserInteractionController {
  private getBody: () => HexSoftBody;
  private getWorld: () => PhysicsWorld2D;
  private interactionManager: SimpleInteractionManager | null = null;
  private coordinateTransform: CoordinateTransform;

  constructor(
    getBody: () => HexSoftBody,
    getWorld: () => PhysicsWorld2D,
    coordinateTransform: CoordinateTransform
  ) {
    this.getBody = getBody;
    this.getWorld = getWorld;
    this.coordinateTransform = coordinateTransform;
  }

  // Initialize the interaction manager
  private ensureInteractionManager(): SimpleInteractionManager {
    if (!this.interactionManager) {
      this.interactionManager = new SimpleInteractionManager(this.getBody(), this.coordinateTransform);
    }
    return this.interactionManager;
  }

  // Called by HexGridView when a node drag starts
  public startDrag(node: PointMass2D, pos: { x: number; y: number }) {
    DebugLogger.log('user-interaction', '[UserInteractionController] Starting drag', { pos });
    const manager = this.ensureInteractionManager();
    manager.startDrag(node, pos);
  }

  // Called by HexGridView when a node is dragged
  public moveDrag(pos: { x: number; y: number }) {
    if (this.interactionManager) {
      this.interactionManager.updateDrag(pos);
    }
  }

  // Called by HexGridView when a node drag ends
  public endDrag() {
    DebugLogger.log('user-interaction', '[UserInteractionController] Ending drag', {});
    if (this.interactionManager) {
      this.interactionManager.endDrag();
    }
  }

  // Update method - called each frame during simulation step
  public update(dt: number) {
    if (this.interactionManager) {
      this.interactionManager.update(dt);
    }
  }

  // Called during the force phase of the simulation step
  /**
   * Applies interaction forces - now much simpler, no extra constraints needed
   */
  public applyInteractionForces(): { extraVolumeConstraints?: any[] } {
    // The new system handles forces internally during update()
    // No extra volume constraints needed - springs handle everything naturally
    return {};
  }

  // Apply global damping to help system return to rest state
  public applyGlobalRestoreDamping(): void {
    if (this.interactionManager) {
      this.interactionManager.applyGlobalRestoreDamping();
    }
  }

  // Check if any interaction is currently active
  public hasActiveInteraction(): boolean {
    return this.interactionManager ? this.interactionManager.hasActiveInteraction() : false;
  }

  // Propagate forceRealismScale to the interaction manager
  public setForceRealismScale(val: number): void {
    if (this.interactionManager && typeof this.interactionManager.setForceRealismScale === 'function') {
      this.interactionManager.setForceRealismScale(val);
    }
  }
}