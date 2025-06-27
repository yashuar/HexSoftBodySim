import { HexSoftBody } from '../domain/HexSoftBody';
import { PhysicsWorld2D } from '../domain/PhysicsWorld2D';
import { DistributedUserInteraction } from './DistributedUserInteraction';
import { HexCell } from '../domain/HexCell';

export class UserInteractionController {
  private getBody: () => HexSoftBody;
  private getWorld: () => PhysicsWorld2D;
  private distributedInteraction: DistributedUserInteraction | null = null;

  constructor(
    getBody: () => HexSoftBody,
    getWorld: () => PhysicsWorld2D
  ) {
    this.getBody = getBody;
    this.getWorld = getWorld;
  }

  // Called by HexGridView when a node drag starts
  public startDrag(node: any, pos: { x: number; y: number }) {
    console.log('[INTERACTION-DEBUG][UserInteractionController] startDrag', node, pos);
    // Find the cell containing this node (first match)
    const body = this.getBody();
    let foundCell: HexCell | null = null;
    for (const cell of body.cells) {
      if (cell.nodes.includes(node)) {
        foundCell = cell;
        break;
      }
    }
    if (!foundCell) {
      console.warn('[UserInteractionController] Could not find cell for dragged node');
      return;
    }
    this.distributedInteraction = new DistributedUserInteraction(node, foundCell, pos, 500);
  }

  // Called by HexGridView when a node is dragged
  public moveDrag(pos: { x: number; y: number }) {
    if (this.distributedInteraction) {
      console.log('[INTERACTION-DEBUG][UserInteractionController] moveDrag', pos);
      this.distributedInteraction.setTarget(pos);
    }
  }

  // Called by HexGridView when a node drag ends
  public endDrag() {
    console.log('[INTERACTION-DEBUG][UserInteractionController] endDrag');
    if (this.distributedInteraction) {
      this.distributedInteraction.startRelease();
      console.log('[INTERACTION-DEBUG][UserInteractionController] Starting gradual distributed release');
    }
  }

  // Update method to handle gradual release - should be called each frame
  public update(dt: number) {
    if (this.distributedInteraction) {
      if (this.distributedInteraction.isReleasing) {
        const releaseComplete = this.distributedInteraction.updateRelease(dt);
        if (releaseComplete) {
          console.log('[UserInteractionController] Distributed interaction release completed');
          // Optionally, blend velocities/positions here for smooth finish
          this.distributedInteraction = null;
        }
      }
    }
  }

  // Called during the force phase of the simulation step
  /**
   * Applies interaction forces and returns any extra constraints (e.g., area constraints from distributed drag)
   */
  public applyInteractionForces(): { extraVolumeConstraints?: any[] } {
    if (this.distributedInteraction) {
      console.log('[INTERACTION-DEBUG][UserInteractionController] applyInteractionForces');
      this.distributedInteraction.applyForce();
      if (typeof this.distributedInteraction.getActiveAreaConstraints === 'function') {
        return { extraVolumeConstraints: this.distributedInteraction.getActiveAreaConstraints() };
      }
    }
    return {};
  }

  /**
   * Returns all active area constraints from the distributed interaction, if any
   */
  public getActiveAreaConstraints(): any[] {
    if (this.distributedInteraction && typeof this.distributedInteraction.getActiveAreaConstraints === 'function') {
      return this.distributedInteraction.getActiveAreaConstraints();
    }
    return [];
  }
}