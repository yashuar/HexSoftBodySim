// CoordinateTransform.ts
// Handles transformation between screen pixel coordinates and physics world coordinates
// Physics world uses normalized units (e.g., 0-20 units wide) for better numerical stability

export class CoordinateTransform {
  private screenWidth: number;
  private screenHeight: number;
  private physicsWidth: number;
  private physicsHeight: number;
  private scaleX: number;
  private scaleY: number;
  private offsetX: number;
  private offsetY: number;

  constructor(screenWidth: number, screenHeight: number, physicsWidth: number = 20) {
    this.screenWidth = screenWidth;
    this.screenHeight = screenHeight;
    this.physicsWidth = physicsWidth;
    
    // Maintain aspect ratio
    this.physicsHeight = (physicsWidth * screenHeight) / screenWidth;
    
    // Calculate scaling factors
    this.scaleX = screenWidth / physicsWidth;
    this.scaleY = screenHeight / this.physicsHeight;
    
    // Center the physics world in screen space
    this.offsetX = 0;
    this.offsetY = 0;
    
    console.log(`[CoordinateTransform] Initialized:
      Screen: ${screenWidth}x${screenHeight}
      Physics: ${physicsWidth.toFixed(2)}x${this.physicsHeight.toFixed(2)}
      Scale: ${this.scaleX.toFixed(2)}x${this.scaleY.toFixed(2)}`);
  }

  // Convert screen pixel coordinates to physics world coordinates
  screenToPhysics(screenX: number, screenY: number): { x: number; y: number } {
    return {
      x: (screenX - this.offsetX) / this.scaleX,
      y: (screenY - this.offsetY) / this.scaleY
    };
  }

  // Convert physics world coordinates to screen pixel coordinates
  physicsToScreen(physicsX: number, physicsY: number): { x: number; y: number } {
    return {
      x: physicsX * this.scaleX + this.offsetX,
      y: physicsY * this.scaleY + this.offsetY
    };
  }

  // Convert physics velocity to screen velocity (for visualization)
  physicsVelocityToScreen(vx: number, vy: number): { x: number; y: number } {
    return {
      x: vx * this.scaleX,
      y: vy * this.scaleY
    };
  }

  // Convert screen velocity to physics velocity (for input)
  screenVelocityToPhysics(vx: number, vy: number): { x: number; y: number } {
    return {
      x: vx / this.scaleX,
      y: vy / this.scaleY
    };
  }

  // Convert physics force to screen force (for visualization)
  physicsForceToScreen(fx: number, fy: number): { x: number; y: number } {
    return {
      x: fx * this.scaleX,
      y: fy * this.scaleY
    };
  }

  // Convert screen distance to physics distance
  screenDistanceToPhysics(distance: number): number {
    // Use average scale factor for distance conversion
    return distance / ((this.scaleX + this.scaleY) / 2);
  }

  // Convert physics distance to screen distance
  physicsDistanceToScreen(distance: number): number {
    // Use average scale factor for distance conversion
    return distance * ((this.scaleX + this.scaleY) / 2);
  }

  // Update when window resizes
  updateScreenSize(screenWidth: number, screenHeight: number): void {
    this.screenWidth = screenWidth;
    this.screenHeight = screenHeight;
    this.physicsHeight = (this.physicsWidth * screenHeight) / screenWidth;
    this.scaleX = screenWidth / this.physicsWidth;
    this.scaleY = screenHeight / this.physicsHeight;
    
    console.log(`[CoordinateTransform] Updated for resize:
      Screen: ${screenWidth}x${screenHeight}
      Physics: ${this.physicsWidth.toFixed(2)}x${this.physicsHeight.toFixed(2)}
      Scale: ${this.scaleX.toFixed(2)}x${this.scaleY.toFixed(2)}`);
  }

  // Get physics world bounds
  getPhysicsBounds(): { width: number; height: number } {
    return {
      width: this.physicsWidth,
      height: this.physicsHeight
    };
  }

  // Get scaling factors for debugging
  getScaling(): { scaleX: number; scaleY: number } {
    return {
      scaleX: this.scaleX,
      scaleY: this.scaleY
    };
  }
}
