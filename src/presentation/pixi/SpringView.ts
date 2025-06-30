import * as PIXI from 'pixi.js';
import { CoordinateTransform } from '../../application/CoordinateTransform';

export class SpringView extends PIXI.Container {
    private springGraphics: PIXI.Graphics[] = [];
    private coordinateTransform: CoordinateTransform;

    constructor(springs: any[], coordinateTransform: CoordinateTransform) {
        super();
        this.coordinateTransform = coordinateTransform;
        this.initSprings(springs);
    }

    initSprings(springs: any[]) {
        // Create graphics objects only once
        this.removeChildren();
        this.springGraphics = [];
        for (const spring of springs) {
            const g = new PIXI.Graphics();
            g.setStrokeStyle({ width: 2, color: 0xff00ff });
            this.addChild(g);
            this.springGraphics.push(g);
        }
    }

    update(springs: any[]) {
        // Optimized: batch all spring drawing into a single graphics object
        // Clear all graphics once and rebuild in a single operation
        if (this.springGraphics.length > 0) {
            const mainGraphics = this.springGraphics[0];
            mainGraphics.clear();
            mainGraphics.setStrokeStyle({ width: 2, color: 0xff00ff });
            
            // Draw all springs as connected line segments
            for (let i = 0; i < springs.length; i++) {
                const spring = springs[i];
                const a = spring.a;
                const b = spring.b;
                if (a && b) {
                    // COORDINATE SYSTEM FIX: Convert physics positions to screen positions for rendering
                    const screenPosA = this.coordinateTransform.physicsToScreen(a.position.x, a.position.y);
                    const screenPosB = this.coordinateTransform.physicsToScreen(b.position.x, b.position.y);
                    mainGraphics.moveTo(screenPosA.x, screenPosA.y);
                    mainGraphics.lineTo(screenPosB.x, screenPosB.y);
                }
            }
            
            // Single stroke call for all springs
            mainGraphics.stroke();
            
            // Hide unused graphics objects
            for (let i = 1; i < this.springGraphics.length; i++) {
                this.springGraphics[i].visible = false;
            }
        }
    }
}
