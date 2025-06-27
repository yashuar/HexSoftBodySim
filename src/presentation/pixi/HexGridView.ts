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

    private hexCells: any[];
    constructor(hexCells: any[], private userInteraction: UserInteractionController) {
        super();
        this.hexCells = hexCells;
        this.initHexagons(hexCells);
        this.initNodeCircles(hexCells);
        // Listen for pointerdown on the whole container for robust node selection
        this.eventMode = 'static';
        this.interactive = true;
        this.on('pointerdown', this.onGlobalPointerDown);
        // Debug: log children order
        console.debug('[DEBUG][HexGridView] container children:', this.children.map(c => c.constructor.name));
        console.log('[INTERACTION-DEBUG][HexGridView] Constructed with', hexCells.length, 'cells');
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
            circle.interactive = false; // No longer handles pointerdown directly
            circle.eventMode = 'none';
            circle.cursor = 'pointer';
            circle.hitArea = new PIXI.Circle(0, 0, 20); // Larger for debug

            // Create the visual circle once during initialization
            circle.fill({ color: 0xff4444, alpha: 0.8 });
            circle.circle(0, 0, 10);
            circle.fill();
            circle.position.set(node.position.x, node.position.y);
            this.addChild(circle); // Add after hexagons, so on top
            this.nodeCircles.set(node, circle);
        });
    }

    /**
     * Listen for pointerdown anywhere on the container, and select the nearest node within a threshold.
     */
    private onGlobalPointerDown = (e: PIXI.FederatedPointerEvent) => {
        const pointer = { x: e.global.x, y: e.global.y };
        const nodes = this.getUniqueNodes(this.hexCells);
        let minDist = Infinity;
        let nearest: PointMass2D | null = null;
        for (const node of nodes) {
            const dx = node.position.x - pointer.x;
            const dy = node.position.y - pointer.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < minDist) {
                minDist = dist;
                nearest = node;
            }
        }
        const THRESHOLD = 30; // px, adjust for usability
        if (nearest && minDist < THRESHOLD) {
            console.log('[INTERACTION-DEBUG][HexGridView] pointerdown (global) nearest node', nearest, 'at', pointer.x, pointer.y, 'dist', minDist, 'pointerId:', e.pointerId);
            this.dragData.node = nearest;
            this.dragData.pointerId = e.pointerId;
            this.userInteraction.startDrag(nearest, pointer);
            // Listen for pointermove/up on the root stage (PixiRenderer2D.app.stage)
            let stage = this.getRootStage();
            if (stage) {
                stage.on('pointermove', this.onPointerMove);
                stage.on('pointerup', this.onPointerUp);
                stage.on('pointerupoutside', this.onPointerUp);
            }
        }
    };

    /**
     * Traverse up the parent chain to find the root stage (PIXI.Container with no parent).
     */
    private getRootStage(): PIXI.Container | null {
        let obj: PIXI.Container | null = this;
        while (obj.parent) {
            obj = obj.parent as PIXI.Container;
        }
        return obj;
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
        if (this.dragData.node && this.dragData.pointerId === e.pointerId) {
            this.userInteraction.moveDrag({ x: e.global.x, y: e.global.y });
        }
    };

    private onPointerUp = (e: PIXI.FederatedPointerEvent) => {
        if (this.dragData.node && this.dragData.pointerId === e.pointerId) {
            this.userInteraction.endDrag();
            // Remove global listeners
            let stage = this.getRootStage();
            if (stage) {
                stage.off('pointermove', this.onPointerMove);
                stage.off('pointerup', this.onPointerUp);
                stage.off('pointerupoutside', this.onPointerUp);
            }
            this.dragData.node = null;
            this.dragData.pointerId = null;
        }
    };
}