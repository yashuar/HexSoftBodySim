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

    // Cached unique nodes list for performance optimization
    private cachedNodes: PointMass2D[] = [];
    private lastCellCount: number = 0;

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
        // Use efficient node collection method
        const nodes = this.getUniqueNodes(hexCells);
        nodes.forEach((node) => {
            const circle = new PIXI.Graphics();
            circle.interactive = true;
            circle.eventMode = 'static';
            circle.cursor = 'pointer';
            circle.hitArea = new PIXI.Circle(0, 0, 20); // Larger for debug
            
            // Create the visual circle once during initialization
            circle.fill({ color: 0xff4444, alpha: 0.8 });
            circle.circle(0, 0, 10);
            circle.fill();
            circle.position.set(node.position.x, node.position.y);
            
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

    // Efficiently get unique nodes, using cache when possible
    private getUniqueNodes(hexCells: any[]): PointMass2D[] {
        // Only rebuild cache if cell count changed (indicates grid structure change)
        if (hexCells.length !== this.lastCellCount) {
            const nodeSet = new Set<PointMass2D>();
            for (const cell of hexCells) {
                for (const node of cell.nodes) {
                    nodeSet.add(node);
                }
            }
            this.cachedNodes = Array.from(nodeSet);
            this.lastCellCount = hexCells.length;
        }
        return this.cachedNodes;
    }

    update(hexCells: any[]) {
        // Optimized: batch hexagon drawing to reduce clear/fill/stroke calls
        for (let i = 0; i < hexCells.length; i++) {
            const cell = hexCells[i];
            const g = this.hexGraphics[i];
            const nodes = cell.nodes;
            if (nodes.length === 6) {
                g.clear();
                // Set style once, then draw path
                g.fill({ color: 0x3399ff, alpha: 0.25 });
                g.setStrokeStyle({ width: 2, color: 0x003366 });
                g.moveTo(nodes[0].position.x, nodes[0].position.y);
                for (let j = 1; j < 6; j++) {
                    g.lineTo(nodes[j].position.x, nodes[j].position.y);
                }
                g.closePath();
                // Single fill and stroke operation
                g.fill();
                g.stroke();
            }
        }
        
        // Optimized: batch node circle updates to reduce clear/fill calls
        const nodes = this.getUniqueNodes(hexCells);
        nodes.forEach((node) => {
            const circle = this.nodeCircles.get(node);
            if (circle) {
                // Only update position if the node has moved significantly
                const newX = node.position.x;
                const newY = node.position.y;
                const currentX = circle.position.x;
                const currentY = circle.position.y;
                
                if (Math.abs(newX - currentX) > 0.1 || Math.abs(newY - currentY) > 0.1) {
                    circle.position.set(newX, newY);
                }
                
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