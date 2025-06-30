// Example: How to integrate DirectInteractionManager into existing UI system
// This shows the clean, simple approach without coordinate scaling complexity

import { DirectInteractionManager } from './DirectInteractionManager';
import { CoordinateTransform } from '../../application/CoordinateTransform';
import { PointMass2D } from '../PointMass2D';

export class SimpleUIController {
  private interactionManager: DirectInteractionManager;
  private coordinateTransform: CoordinateTransform;
  private nodes: PointMass2D[] = [];

  constructor(coordinateTransform: CoordinateTransform, nodes: PointMass2D[]) {
    this.coordinateTransform = coordinateTransform;
    this.interactionManager = new DirectInteractionManager(coordinateTransform);
    this.nodes = nodes;
  }

  // Handle mouse/touch down - find nearest node and start interaction
  handlePointerDown(screenX: number, screenY: number): boolean {
    const physicsPos = this.coordinateTransform.screenToPhysics(screenX, screenY);
    const nearestNode = this.findNearestNode(physicsPos, 0.5); // 0.5 physics units radius
    
    if (nearestNode) {
      return this.interactionManager.startInteraction(nearestNode, { x: screenX, y: screenY });
    }
    return false;
  }

  // Handle mouse/touch move - update interaction target
  handlePointerMove(screenX: number, screenY: number): void {
    this.interactionManager.updateInteraction({ x: screenX, y: screenY });
  }

  // Handle mouse/touch up - end interaction
  handlePointerUp(): void {
    this.interactionManager.endInteraction();
  }

  // Update interactions (called each frame)
  update(dt: number): void {
    this.interactionManager.update(dt);
  }

  // Helper: find nearest node in physics space
  private findNearestNode(physicsPos: { x: number; y: number }, maxDistance: number): PointMass2D | null {
    let nearest: PointMass2D | null = null;
    let nearestDistance = maxDistance;

    for (const node of this.nodes) {
      const dx = node.getPositionX() - physicsPos.x;
      const dy = node.getPositionY() - physicsPos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < nearestDistance) {
        nearest = node;
        nearestDistance = distance;
      }
    }

    return nearest;
  }

  // Query methods
  hasActiveInteraction(): boolean {
    return this.interactionManager.hasActiveInteraction();
  }

  getInteractedNode(): PointMass2D | null {
    return this.interactionManager.getTargetNode();
  }
}

/*
BENEFITS OF THIS APPROACH:

1. **No coordinate scaling complexity** - convert screen→physics ONCE, then work in physics space
2. **Simple, direct physics** - standard spring-damper equations with clear parameters  
3. **No competing force systems** - one clear interaction force calculation
4. **Easy to tune** - stiffness and damping have clear physical meaning
5. **Predictable behavior** - no hidden scaling factors or coordinate dependencies
6. **Maintainable** - clear separation of concerns, simple interfaces

INTEGRATION STEPS:

1. Replace SimpleUserInteraction with DirectUserInteraction
2. Replace existing interaction manager with DirectInteractionManager  
3. Update UI event handlers to use the simple interface above
4. Remove all coordinate scaling from force calculations
5. Use direct physics parameters in configuration
6. Test and tune the simple stiffness/damping parameters

This removes ALL the scaling complexity that has been causing problems!
*/
