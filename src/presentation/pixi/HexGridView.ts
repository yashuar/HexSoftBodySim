import * as PIXI from 'pixi.js';
import { PointMass2D } from '../../domain/PointMass2D';
import { UserInteractionController } from '../UserInteractionController';
import { DebugLogger } from '../../infrastructure/DebugLogger';
import { CoordinateTransform } from '../../application/CoordinateTransform';

const DEBUG_LOG_INTERVAL = 30; // frames

export class HexGridView extends PIXI.Container {
    private hexGraphics: PIXI.Graphics[] = [];
    private nodeCircles: Map<PointMass2D, PIXI.Graphics> = new Map();
    private dragData: { node: PointMass2D | null, pointerId: number | null } = { node: null, pointerId: null };
    private debugFrameCount = 0;
    private lastPointerLogTime = 0;
    private coordinateTransform: CoordinateTransform;

    // Cached unique nodes list for performance optimization
    private cachedNodes: PointMass2D[] = [];
    private lastCellCount: number = 0;

    private hexCells: any[];
    constructor(hexCells: any[], private userInteraction: UserInteractionController, coordinateTransform: CoordinateTransform) {
        super();
        this.hexCells = hexCells;
        this.coordinateTransform = coordinateTransform;
        this.initHexagons(hexCells);
        this.initNodeCircles(hexCells);
        // Listen for pointerdown on the whole container for robust node selection
        this.eventMode = 'static';
        this.interactive = true;
        this.on('pointerdown', this.onGlobalPointerDown);
        // Debug: log children order
        DebugLogger.log('system-event', '[HexGridView] container children', { children: this.children.map(c => c.constructor.name) });
        DebugLogger.log('system-event', '[HexGridView] Constructed', { cellCount: hexCells.length });
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
            
            // COORDINATE SYSTEM FIX: Convert physics position to screen position for rendering
            const screenPos = this.coordinateTransform.physicsToScreen(node.position.x, node.position.y);
            circle.position.set(screenPos.x, screenPos.y);
            
            this.addChild(circle); // Add after hexagons, so on top
            this.nodeCircles.set(node, circle);
        });
    }

    /**
     * Listen for pointerdown anywhere on the container, and select the nearest node within a threshold.
     */
    private onGlobalPointerDown = (e: PIXI.FederatedPointerEvent) => {
        // LOUD DEBUG: Make sure this handler is actually called
        DebugLogger.log('user-interaction', '[HexGridView] onGlobalPointerDown called', { global: e.global });
        DebugLogger.log('user-interaction', 'HEXGRIDVIEW POINTER DOWN HANDLER CALLED', {
            globalCoords: { x: e.global.x, y: e.global.y }
        });
        
        // CRITICAL FIX: Convert global screen coordinates to local container coordinates
        const localPoint = this.toLocal(e.global);
        const screenPointer = { x: localPoint.x, y: localPoint.y };
        
        // COORDINATE SYSTEM FIX: Convert screen coordinates to physics coordinates
        const physicsPointer = this.coordinateTransform.screenToPhysics(screenPointer.x, screenPointer.y);
        
        // ENHANCED COORDINATE LOGGING: Track coordinate transformation
        DebugLogger.log('system-event', 'Coordinate transformation analysis', {
          type: 'pointer_down_coordinates',
          globalCoords: { x: e.global.x, y: e.global.y },
          localScreenCoords: screenPointer,
          physicsCoords: physicsPointer,
          containerTransform: {
            position: { x: this.position.x, y: this.position.y },
            scale: { x: this.scale.x, y: this.scale.y },
            rotation: this.rotation,
            worldTransform: this.worldTransform ? {
              a: this.worldTransform.a, b: this.worldTransform.b,
              c: this.worldTransform.c, d: this.worldTransform.d,
              tx: this.worldTransform.tx, ty: this.worldTransform.ty
            } : null
          },
          windowSize: { width: window.innerWidth, height: window.innerHeight },
          coordinateTransformScaling: this.coordinateTransform.getScaling()
        });
        
        const nodes = this.getUniqueNodes(this.hexCells);
        let minDist = Infinity;
        let nearest: PointMass2D | null = null;
        
        // ENHANCED NODE PROXIMITY LOGGING: Track all nearby nodes (in physics coordinates)
        const proximityData: any[] = [];
        for (const node of nodes) {
            // Node positions are already in physics coordinates
            const dx = node.position.x - physicsPointer.x;
            const dy = node.position.y - physicsPointer.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            // Convert physics distance to screen distance for threshold comparison
            const screenDist = this.coordinateTransform.physicsDistanceToScreen(dist);
            
            // Log details for nearby nodes
            if (screenDist < 100) { // Within 100px in screen space
              proximityData.push({
                nodePhysicsPos: { x: node.position.x, y: node.position.y },
                pointerPhysicsPos: physicsPointer,
                deltaPhysics: { dx, dy },
                distancePhysics: dist,
                distanceScreen: screenDist
              });
            }
            
            if (dist < minDist) {
                minDist = dist;
                nearest = node;
            }
        }
        
        // Log proximity analysis
        if (proximityData.length > 0) {
          DebugLogger.log('system-event', 'Node proximity analysis', {
            type: 'node_proximity',
            pointerScreenCoords: screenPointer,
            pointerPhysicsCoords: physicsPointer,
            nearbyNodes: proximityData.slice(0, 5), // Top 5 closest
            closestDistancePhysics: minDist,
            closestDistanceScreen: this.coordinateTransform.physicsDistanceToScreen(minDist),
            totalNearbyNodes: proximityData.length
          });
        }
        
        // Use physics distance for threshold (converted to screen for threshold comparison)
        const SCREEN_THRESHOLD = 50; // px in screen space - increased for easier clicking
        const PHYSICS_THRESHOLD = this.coordinateTransform.screenDistanceToPhysics(SCREEN_THRESHOLD);
        
        // LOUD DEBUG: Log threshold check details
        DebugLogger.log('user-interaction', '[HexGridView] Threshold check', {
            nearest: !!nearest,
            minDist: minDist,
            PHYSICS_THRESHOLD: PHYSICS_THRESHOLD,
            SCREEN_THRESHOLD: SCREEN_THRESHOLD,
            withinThreshold: nearest && minDist < PHYSICS_THRESHOLD
        });
        DebugLogger.log('user-interaction', 'THRESHOLD CHECK DETAILS', {
            hasNearestNode: !!nearest,
            nearestNodePosition: nearest ? { x: nearest.position.x, y: nearest.position.y } : null,
            minDistancePhysics: minDist,
            physicsThreshold: PHYSICS_THRESHOLD,
            screenThreshold: SCREEN_THRESHOLD,
            totalNodesChecked: nodes.length,
            withinThreshold: nearest && minDist < PHYSICS_THRESHOLD
        });
        
        if (nearest && minDist < PHYSICS_THRESHOLD) {
            DebugLogger.log('user-interaction', `STARTDRAG CALLED - THRESHOLD PASSED at ${Date.now()}`, {
                nearestNode: !!nearest,
                distancePhysics: minDist,
                thresholdPhysics: PHYSICS_THRESHOLD,
                thresholdScreen: SCREEN_THRESHOLD
            });
            DebugLogger.log('user-interaction', '[HexGridView] startDrag - threshold passed', {
                nearest,
                physicsPointer: { x: physicsPointer.x.toFixed(3), y: physicsPointer.y.toFixed(3) },
                physicsDist: minDist.toFixed(3),
                pointerId: e.pointerId
            });
            this.dragData.node = nearest;
            this.dragData.pointerId = e.pointerId;
            // CRITICAL FIX: Pass screen coordinates to UserInteractionController, not physics coordinates!
            this.userInteraction.startDrag(nearest, screenPointer);
            // Listen for pointermove/up on the root stage (PixiRenderer2D.app.stage)
            let stage = this.getRootStage();
            if (stage) {
                stage.on('pointermove', this.onPointerMove);
                stage.on('pointerup', this.onPointerUp);
                stage.on('pointerupoutside', this.onPointerUp);
            }
        } else {
          // Log failed interaction attempts
          DebugLogger.log('user-interaction', `Interaction attempt failed at ${Date.now()}`, {
            type: 'interaction_failed',
            reason: nearest ? 'distance_too_far' : 'no_node_found',
            distancePhysics: minDist,
            distanceScreen: this.coordinateTransform.physicsDistanceToScreen(minDist),
            thresholdPhysics: PHYSICS_THRESHOLD,
            thresholdScreen: SCREEN_THRESHOLD,
            pointerScreenCoords: screenPointer,
            pointerPhysicsCoords: physicsPointer,
            nearestNodePhysicsPos: nearest ? { x: nearest.position.x, y: nearest.position.y } : null
          });
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
                
                // COORDINATE SYSTEM FIX: Convert physics positions to screen positions for rendering
                const firstNodeScreen = this.coordinateTransform.physicsToScreen(nodes[0].position.x, nodes[0].position.y);
                g.moveTo(firstNodeScreen.x, firstNodeScreen.y);
                
                for (let j = 1; j < 6; j++) {
                    const nodeScreen = this.coordinateTransform.physicsToScreen(nodes[j].position.x, nodes[j].position.y);
                    g.lineTo(nodeScreen.x, nodeScreen.y);
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
                // COORDINATE SYSTEM FIX: Convert physics position to screen position for rendering
                const screenPos = this.coordinateTransform.physicsToScreen(node.position.x, node.position.y);
                
                // Only update position if the node has moved significantly (in screen space)
                const currentX = circle.position.x;
                const currentY = circle.position.y;
                
                if (Math.abs(screenPos.x - currentX) > 0.1 || Math.abs(screenPos.y - currentY) > 0.1) {
                    circle.position.set(screenPos.x, screenPos.y);
                }
                
                // Condensed: log node[0] position every 30 frames
                if (node === nodes[0]) {
                    this.debugFrameCount++;
                    if (this.debugFrameCount % DEBUG_LOG_INTERVAL === 0) {
                        console.debug('[DEBUG][HexGridView] Node[0] physics position:', node.position, 'screen position:', screenPos);
                    }
                }
            }
        });
    }

    private onPointerMove = (e: PIXI.FederatedPointerEvent) => {
        if (this.dragData.node && this.dragData.pointerId === e.pointerId) {
            // CRITICAL FIX: Convert global screen coordinates to local container coordinates
            const localPoint = this.toLocal(e.global);
            const screenPointer = { x: localPoint.x, y: localPoint.y };
            
            // CRITICAL FIX: Pass screen coordinates to UserInteractionController, not physics coordinates!
            this.userInteraction.moveDrag(screenPointer);
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