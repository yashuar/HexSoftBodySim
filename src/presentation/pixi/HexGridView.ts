import * as PIXI from 'pixi.js';
import { PointMass2D } from '../../domain/PointMass2D';
import { UserInteractionController } from '../UserInteractionController';

const DEBUG_LOG_INTERVAL = 30; // frames

export class HexGridView extends PIXI.Container {
    private hexGraphics: PIXI.Graphics[] = [];
    private nodeCircles: Map<PointMass2D, PIXI.Graphics> = new Map();
    private dragData: { node: PointMass2D | null, pointerId: number | null } = { node: null, pointerId: null };
    private debugFrameCount = 0;
    private lastPointerLogTime = 0;

    constructor(hexCells: any[], private userInteraction: UserInteractionController) {
        super();
        this.initHexagons(hexCells);
        this.initNodeCircles(hexCells);
        // Debug: log children order
        console.debug('[DEBUG][HexGridView] container children:', this.children.map(c => c.constructor.name));
    }

    private initHexagons(hexCells: any[]) {
        this.hexGraphics = [];
        for (const cell of hexCells) {
            const g = new PIXI.Graphics();
            this.addChild(g);
            this.hexGraphics.push(g);
        }
    }

    private initNodeCircles(hexCells: any[]) {
        // Collect all unique nodes from all cells
        const nodeSet = new Set<PointMass2D>();
        for (const cell of hexCells) {
            for (const node of cell.nodes) {
                nodeSet.add(node);
            }
        }
        const nodes = Array.from(nodeSet);
        nodes.forEach((node) => {
            const circle = new PIXI.Graphics();
            circle.interactive = true;
            circle.eventMode = 'static';
            circle.cursor = 'pointer';
            circle.hitArea = new PIXI.Circle(0, 0, 20); // Larger for debug
            circle.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
                const now = Date.now();
                if (now - this.lastPointerLogTime > 1000) {
                    console.debug('[DEBUG][HexGridView] pointerdown on node', node, 'at', e.global.x, e.global.y);
                    this.lastPointerLogTime = now;
                }
                this.dragData.node = node;
                this.dragData.pointerId = e.pointerId;
                this.userInteraction.startDrag(node, { x: e.global.x, y: e.global.y });
                circle.on('pointermove', this.onPointerMove);
                circle.on('pointerup', this.onPointerUp);
                circle.on('pointerupoutside', this.onPointerUp);
            });
            this.addChild(circle); // Add after hexagons, so on top
            this.nodeCircles.set(node, circle);
        });
    }

    update(hexCells: any[]) {
        // Update hexagons
        for (let i = 0; i < hexCells.length; i++) {
            const cell = hexCells[i];
            const g = this.hexGraphics[i];
            g.clear();
            const nodes = cell.nodes;
            if (nodes.length === 6) {
                g.moveTo(nodes[0].position.x, nodes[0].position.y);
                for (let j = 1; j < 6; j++) {
                    g.lineTo(nodes[j].position.x, nodes[j].position.y);
                }
                g.closePath();
                g.fill({ color: 0x3399ff, alpha: 0.25 });
                g.setStrokeStyle({ width: 2, color: 0x003366 });
                g.stroke();
            }
        }
        // Update node circles
        const nodeSet = new Set<PointMass2D>();
        for (const cell of hexCells) {
            for (const node of cell.nodes) {
                nodeSet.add(node);
            }
        }
        const nodes = Array.from(nodeSet);
        nodes.forEach((node) => {
            const circle = this.nodeCircles.get(node);
            if (circle) {
                circle.clear();
                circle.fill({ color: 0xff4444, alpha: 0.8 });
                circle.circle(0, 0, 10);
                circle.fill();
                circle.position.set(node.position.x, node.position.y);
                // Condensed: log node[0] position every 30 frames
                if (node === nodes[0]) {
                    this.debugFrameCount++;
                    if (this.debugFrameCount % DEBUG_LOG_INTERVAL === 0) {
                        console.debug('[DEBUG][HexGridView] Node[0] position:', node.position);
                    }
                }
            }
        });
    }

    private onPointerMove = (e: PIXI.FederatedPointerEvent) => {
        // Only log first pointermove per second
        const now = Date.now();
        if (this.dragData.node && this.dragData.pointerId === e.pointerId && now - this.lastPointerLogTime > 1000) {
            console.debug('[DEBUG][HexGridView] pointermove on node', this.dragData.node, 'to', e.global.x, e.global.y);
            this.lastPointerLogTime = now;
        }
        if (this.dragData.node && this.dragData.pointerId === e.pointerId) {
            this.userInteraction.moveDrag({ x: e.global.x, y: e.global.y });
        }
    };

    private onPointerUp = (e: PIXI.FederatedPointerEvent) => {
        // Only log first pointerup per second
        const now = Date.now();
        if (this.dragData.node && this.dragData.pointerId === e.pointerId && now - this.lastPointerLogTime > 1000) {
            console.debug('[DEBUG][HexGridView] pointerup on node', this.dragData.node);
            this.lastPointerLogTime = now;
        }
        if (this.dragData.node && this.dragData.pointerId === e.pointerId) {
            this.userInteraction.endDrag();
            const circle = this.nodeCircles.get(this.dragData.node);
            if (circle) {
                circle.off('pointermove', this.onPointerMove);
                circle.off('pointerup', this.onPointerUp);
                circle.off('pointerupoutside', this.onPointerUp);
            }
            this.dragData.node = null;
            this.dragData.pointerId = null;
        }
    };
}