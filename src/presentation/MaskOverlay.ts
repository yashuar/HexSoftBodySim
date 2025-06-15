// MaskOverlay: Visualizes mask regions and parameter transitions on top of the mesh.

import { MaskRegion } from '../application/MaskParser';

export class MaskOverlay {
  private ctx: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D context not supported');
    this.ctx = ctx;
  }

  render(maskRegions: MaskRegion[]): void {
    this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
    for (const region of maskRegions) {
      this.ctx.save();
      this.ctx.globalAlpha = 0.3;
      this.ctx.beginPath();
      region.polygon.forEach((pt, i) => {
        if (i === 0) this.ctx.moveTo(pt.x, pt.y);
        else this.ctx.lineTo(pt.x, pt.y);
      });
      this.ctx.closePath();
      this.ctx.fillStyle = 'blue'; // TODO: Color by parameter
      this.ctx.fill();
      this.ctx.restore();
    }
  }
}
