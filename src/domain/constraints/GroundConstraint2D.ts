// GroundConstraint2D: Enforces a lower boundary (ground) for all nodes in a soft body.
// Nodes cannot fall below groundY. Vertical velocity is zeroed on contact, horizontal velocity is preserved (allows sliding).

import { HexSoftBody } from '../HexSoftBody';
import { PointMass2D } from '../PointMass2D';

export class GroundConstraint2D {
  body: HexSoftBody;
  groundY: number;

  constructor(body: HexSoftBody, groundY: number = 0) {
    this.body = body;
    this.groundY = groundY;
  }

  apply(): void {
    for (const node of this.body.nodes) {
      if (node.position.y < this.groundY) {
        node.position.y = this.groundY;
        if (node.velocity.y < 0) node.velocity.y = 0;
        // Optionally, add friction here if you want to damp horizontal velocity
      }
    }
  }
}
