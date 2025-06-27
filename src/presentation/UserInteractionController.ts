import { HexSoftBody } from '../domain/HexSoftBody';
import { UserConstraint2D } from '../domain/constraints/UserConstraint2D';
import { PhysicsWorld2D } from '../domain/PhysicsWorld2D';

export class UserInteractionController {
  private getBody: () => HexSoftBody;
  private getWorld: () => PhysicsWorld2D;
  private draggingConstraint: UserConstraint2D | null = null;

  constructor(
    getBody: () => HexSoftBody,
    getWorld: () => PhysicsWorld2D
  ) {
    this.getBody = getBody;
    this.getWorld = getWorld;
  }

  // Called by HexGridView when a node drag starts
  public startDrag(node: any, pos: { x: number; y: number }) {
    console.debug('[DEBUG][UserInteractionController] startDrag', node, pos);
    this.draggingConstraint = new UserConstraint2D(node, pos, 5000); // Much gentler - prevents extreme deformation
    this.getWorld().userConstraints = [this.draggingConstraint];
  }

  // Called by HexGridView when a node is dragged
  public moveDrag(pos: { x: number; y: number }) {
    if (this.draggingConstraint) {
      console.debug('[DEBUG][UserInteractionController] moveDrag', pos);
      this.draggingConstraint.setTarget(pos);
    }
  }

  // Called by HexGridView when a node drag ends
  public endDrag() {
    console.debug('[DEBUG][UserInteractionController] endDrag');
    this.draggingConstraint = null;
    this.getWorld().userConstraints = [];
  }
}