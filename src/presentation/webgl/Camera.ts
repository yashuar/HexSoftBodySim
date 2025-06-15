// Camera: Encapsulates pan, zoom, and world-to-NDC transforms for 2D scenes.

export class Camera {
  public center: { x: number; y: number } = { x: 0, y: 0 };
  public zoom: number = 1;
  private width: number;
  private height: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  resize(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  // Convert world coordinates to NDC
  worldToNDC(x: number, y: number): [number, number] {
    const sx = (x - this.center.x) * this.zoom + this.width / 2;
    const sy = (y - this.center.y) * this.zoom + this.height / 2;
    return [
      (sx / this.width) * 2 - 1,
      1 - (sy / this.height) * 2
    ];
  }
}
