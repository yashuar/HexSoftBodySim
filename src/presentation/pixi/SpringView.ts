import * as PIXI from 'pixi.js';

export class SpringView extends PIXI.Container {
    private springGraphics: PIXI.Graphics[] = [];

    constructor(springs: any[]) {
        super();
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
        // Only update positions, do not recreate graphics
        for (let i = 0; i < springs.length; i++) {
            const g = this.springGraphics[i];
            const spring = springs[i];
            g.clear();
            g.setStrokeStyle({ width: 2, color: 0xff00ff });
            const a = spring.a;
            const b = spring.b;
            if (a && b) {
                g.moveTo(a.position.x, a.position.y);
                g.lineTo(b.position.x, b.position.y);
                g.stroke();
            }
        }
    }
}
