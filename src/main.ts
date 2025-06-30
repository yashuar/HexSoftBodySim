// main.ts: Entry point for the PhysicsEngine2D demo (PixiJS version)

import { HexGridFactory } from './application/HexGridFactory';
import { PhysicsWorld2D } from './domain/PhysicsWorld2D';
import { SimulationCoordinator } from './application/SimulationCoordinator';
import { MaskOverlay } from './presentation/MaskOverlay';
import { UIController } from './presentation/UIController';
import { MaskRegion } from './application/MaskParser';
import { HexSoftBody } from './domain/HexSoftBody';
import { UserConstraint2D } from './domain/constraints/UserConstraint2D';
import { UserInteractionController } from './presentation/UserInteractionController';
import { computeCellSpacingForGrid } from './application/HexGridUtils';
import { PixiRenderer2D } from './presentation/pixi/PixiRenderer2D';
import { HexGridView } from './presentation/pixi/HexGridView';
import { SpringView } from './presentation/pixi/SpringView';
import { PluginSystem } from './infrastructure/PluginSystem';
import { StateManager } from './infrastructure/StateManager';
import { CellParameters } from './domain/CellParameters';
import { EventBus } from './infrastructure/EventBus';
import { SIM_CONFIG } from './config';
import { registerGlobalDebugListeners } from './debugListeners';
import { DebugLogger } from './infrastructure/DebugLogger';
import { SimulationStepper } from './domain/SimulationStepper';
import { CoordinateTransform } from './application/CoordinateTransform';
import { ParameterDrawer } from './presentation/ParameterDrawer';

// Type augmentation for globalThis to allow 'world' property
declare global {
  // eslint-disable-next-line no-var
  var world: PhysicsWorld2D | undefined;
  // eslint-disable-next-line no-var
  var physicsWorld: PhysicsWorld2D | undefined;
  // eslint-disable-next-line no-var
  var forceCoordinator: any | undefined;
  // eslint-disable-next-line no-var
  var constraintSolver: any | undefined;
  // eslint-disable-next-line no-var
  var robustnessManager: any | undefined;
  // eslint-disable-next-line no-var
  var boundaryStabilizer: any | undefined;
  // eslint-disable-next-line no-var
  var coordinateTransform: CoordinateTransform | undefined;
}

// === PIXIJS RENDERER SETUP ===
import * as PIXI from 'pixi.js';

DebugLogger.log('system-event', '[main.ts] script loaded', {});

// Initialize debugLogger IMMEDIATELY for browser console access
DebugLogger.enableFileLogging(true);
DebugLogger.setLevel('info');
DebugLogger.initializeBrowserLogging();
DebugLogger.log('system-event', '[main.ts] DebugLogger initialized - try typing "debugLogger.test()" in console', {});

// === STATE MANAGEMENT ===
export interface SimulationState {
  maskRegions: MaskRegion[];
  defaultParams: CellParameters;
  smoothingFrames: number;
  desiredCellSpacing: number;
  desiredNumCols: number;
  desiredNumRows: number;
  margin: number;
  // Physics parameters
  springFrequency?: number;
  dampingRatio?: number;
  globalMass?: number;
  globalRestLength?: number;
  globalInteractionStrength?: number;
  gravity?: { x: number; y: number };
  gravityX?: number;
  gravityY?: number;
  // Simulation settings
  speed?: number;
  maxFps?: number;
  enableMooneyRivlin?: boolean;
  mooneyDamping?: number;
  mooneyMaxForce?: number;
  enableForceCoordination?: boolean;
  materialModelMode?: 'springs-primary' | 'mooney-primary' | 'hybrid';
  energyBudgetLimit?: number;
  forceRealismScale?: number;
}
const simState = new StateManager<SimulationState>({
  maskRegions: [],
  defaultParams: { mass: SIM_CONFIG.globalMass, springFrequency: SIM_CONFIG.springFrequency, dampingRatio: SIM_CONFIG.dampingRatio },
  smoothingFrames: 5,
  desiredCellSpacing: SIM_CONFIG.desiredCellSpacing,
  desiredNumCols: SIM_CONFIG.desiredNumCols,
  desiredNumRows: SIM_CONFIG.desiredNumRows,
  margin: SIM_CONFIG.margin,
  // Initialize with config defaults
  springFrequency: SIM_CONFIG.springFrequency,
  dampingRatio: SIM_CONFIG.dampingRatio,
  globalMass: SIM_CONFIG.globalMass,
  globalRestLength: SIM_CONFIG.globalRestLength,
  globalInteractionStrength: SIM_CONFIG.globalInteractionStrength,
  gravity: SIM_CONFIG.gravity,
  gravityX: SIM_CONFIG.gravity.x,
  gravityY: SIM_CONFIG.gravity.y,
  speed: 1,
  maxFps: SIM_CONFIG.maxFps,
  enableMooneyRivlin: SIM_CONFIG.enableMooneyRivlin,
  mooneyDamping: SIM_CONFIG.mooneyDamping,
  mooneyMaxForce: SIM_CONFIG.mooneyMaxForce,
  enableForceCoordination: SIM_CONFIG.enableForceCoordination,
  materialModelMode: SIM_CONFIG.materialModelMode,
  energyBudgetLimit: SIM_CONFIG.energyBudgetLimit,
  forceRealismScale: SIM_CONFIG.forceRealismScale,
});

// === MAIN APP SETUP ===
async function setupRenderer(): Promise<PixiRenderer2D> {
  try {
    const mainCanvas = document.getElementById('main-canvas') as HTMLCanvasElement | null;
    if (!mainCanvas) {
      throw new Error('main-canvas element not found');
    }
    const renderer = await PixiRenderer2D.create({ width: window.innerWidth, height: window.innerHeight, view: mainCanvas, resizeTo: window });
    // Debug: log which canvas is being used
    const pixiCanvas = renderer.getCanvas();
    console.debug('[DEBUG][setupRenderer] PixiRenderer2D using canvas:', pixiCanvas, 'id:', pixiCanvas?.id);
    return renderer;
  } catch (err) {
    console.error('[main.ts] Renderer creation failed:', err);
    throw err;
  }
}

function buildGridToFitWindow() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const spacing = computeCellSpacingForGrid(width, height, SIM_CONFIG.desiredNumCols, SIM_CONFIG.desiredNumRows, SIM_CONFIG.margin);
  return HexGridFactory.createHexSoftBodyToFitCanvas(width, height, spacing, SIM_CONFIG.defaultParams, SIM_CONFIG.margin);
}

function setupEventBus(): EventBus {
  return new EventBus();
}

function setupPluginSystem(): PluginSystem {
  return new PluginSystem();
}

function setupUIController(coordinator: SimulationCoordinator, simState: StateManager<SimulationState>, eventBus: EventBus): UIController {
  // Remove legacy panel mount if present
  // Mount the new parameter drawer with state and eventBus
  const drawer = document.getElementById('parameter-panel-mount');
  if (drawer) {
    new ParameterDrawer(drawer, simState, eventBus);
    // Force overlay style for the parameter drawer
    drawer.style.position = 'fixed';
    drawer.style.top = '0';
    drawer.style.right = '0';
    drawer.style.width = '420px';
    drawer.style.maxWidth = '90vw';
    drawer.style.height = '100vh';
    drawer.style.zIndex = '10010';
    drawer.style.pointerEvents = 'auto';
    drawer.style.overflowY = 'auto';
    drawer.style.background = 'rgba(255,255,255,0.96)';
    drawer.style.borderLeft = '1.5px solid #e0b97d';
    drawer.style.boxShadow = '-8px 0 32px 0 rgba(60,60,60,0.13)';
    drawer.style.borderRadius = '12px 0 0 12px';
    drawer.style.backdropFilter = 'blur(2px)';
    drawer.style.padding = '0 0 0 0';
  }
  return new UIController(coordinator, undefined, simState, eventBus);
}

function setupUserInteractionController(canvas: HTMLCanvasElement | null | undefined, body: HexSoftBody, world: PhysicsWorld2D, coordinateTransform: CoordinateTransform): UserInteractionController | null {
  if (canvas) {
    return new UserInteractionController(
      () => body,
      () => world,
      coordinateTransform
    );
  } else {
    console.warn('[UserInteractionController] Could not find canvas for interaction.');
    return null;
  }
}

let isSimulationCrashed = false;

let current = {
  renderer: null as PixiRenderer2D | null,
  body: null as HexSoftBody | null,
  world: null as PhysicsWorld2D | null,
  hexGridView: null as HexGridView | null,
  springView: null as SpringView | null,
  pluginSystem: null as PluginSystem | null,
  coordinator: null as SimulationCoordinator | null,
  uiController: null as UIController | null,
  userInteractionController: null as UserInteractionController | null,
  animationId: 0 as number,
  eventBus: null as EventBus | null,
  coordinateTransform: null as CoordinateTransform | null,
};

function destroySimulation() {
  if (current.animationId) cancelAnimationFrame(current.animationId);
  if (current.renderer) {
    current.renderer.removeLayer('hexGrid');
    current.renderer.removeLayer('springs');
  }
  // Release pooled objects
  if (current.body) HexSoftBody.releaseAllToPool(current.body);
  // Optionally destroy Pixi objects, clear event listeners, etc.
  current.body = null;
  current.world = null;
  current.hexGridView = null;
  current.springView = null;
  current.pluginSystem = null;
  current.coordinator = null;
  current.uiController = null;
  current.userInteractionController = null;
}

export async function initSimulation(params?: Partial<SimulationState>) {
  destroySimulation();
  const renderer = current.renderer ?? await setupRenderer();
  current.renderer = renderer;
  const canvas = renderer.getCanvas();
  const eventBus = current.eventBus ?? setupEventBus();
  current.eventBus = eventBus;
  // Always get the latest state from simState, then override with any params
  const state = { ...simState.get(), ...params };
  const spacing = state.desiredCellSpacing;
  const numCols = state.desiredNumCols;
  const numRows = state.desiredNumRows;
  const margin = state.margin;
  // Use only defaultParams for cell/grid creation
  const cellParams = {
    mass: state.defaultParams.mass ?? SIM_CONFIG.globalMass,
    springFrequency: state.defaultParams.springFrequency ?? SIM_CONFIG.springFrequency,
    dampingRatio: state.defaultParams.dampingRatio ?? SIM_CONFIG.dampingRatio
  };
  const width = window.innerWidth;
  const height = window.innerHeight;
  
  // COORDINATE SYSTEM FIX: Initialize coordinate transform BEFORE creating the grid
  const coordinateTransform = new CoordinateTransform(width, height, 20); // 20 units wide physics world
  current.coordinateTransform = coordinateTransform;
  globalThis.coordinateTransform = coordinateTransform;
  
  DebugLogger.log('system-event', 'Coordinate system initialized', {
    type: 'coordinate_system_init',
    screenSize: { width, height },
    physicsSize: coordinateTransform.getPhysicsBounds(),
    scaling: coordinateTransform.getScaling()
  });
  
  // Create the grid in normalized physics coordinates
  const body = HexGridFactory.createHexSoftBodyWithTransform(coordinateTransform, spacing, cellParams, margin, numCols, numRows);
  current.body = body;
  if (body.nodes && body.nodes.length > 0) (globalThis as any)._debugFirstNode = body.nodes[0];
  const world = new PhysicsWorld2D();
  
  // COORDINATE SYSTEM FIX: Convert gravity to physics coordinates
  const screenGravity = { 
    x: state.gravityX ?? state.gravity?.x ?? SIM_CONFIG.gravity.x, 
    y: state.gravityY ?? state.gravity?.y ?? SIM_CONFIG.gravity.y 
  };
  
  // Convert gravity from screen coordinates to physics coordinates
  const physicsGravity = coordinateTransform.screenVelocityToPhysics(screenGravity.x, screenGravity.y);
  world.gravity = physicsGravity;
  
  // Set ground level in physics coordinates (bottom of physics world)
  const physicsBounds = coordinateTransform.getPhysicsBounds();
  world.groundY = physicsBounds.height * 0.95; // 95% down from top
  
  DebugLogger.log('system-event', 'Physics world initialized', {
    type: 'physics_world_init',
    screenGravity,
    physicsGravity,
    physicsGroundY: world.groundY,
    physicsBounds
  });
  current.world = world;
  const userInteractionController = setupUserInteractionController(canvas, body, world, coordinateTransform);
  current.userInteractionController = userInteractionController;
  const hexGridView = new HexGridView(body.cells, userInteractionController!, coordinateTransform);
  const springView = new SpringView(body.springs, coordinateTransform);
  renderer.addLayer('hexGrid', hexGridView);
  renderer.addLayer('springs', springView);
  current.hexGridView = hexGridView;
  current.springView = springView;
  const pluginSystem = setupPluginSystem();
  current.pluginSystem = pluginSystem;
  const coordinator = new SimulationCoordinator(world, body, pluginSystem, eventBus);
  current.coordinator = coordinator;
  const uiController = setupUIController(coordinator, simState, eventBus);
  // --- Attach the user interaction controller to the UI controller ---
  if (userInteractionController && uiController.setUserInteractionController) {
    uiController.setUserInteractionController(userInteractionController);
  }
  current.uiController = uiController;
  
  // Apply all preserved parameters to the new simulation
  if (state.globalMass !== undefined) {
    for (const node of body.nodes) {
      node.mass = state.globalMass;
    }
  }
  if (state.springFrequency !== undefined) {
    for (const spring of body.springs) {
      spring.springFrequency = state.springFrequency;
    }
  }
  if (state.dampingRatio !== undefined) {
    for (const spring of body.springs) {
      spring.dampingRatio = state.dampingRatio;
    }
  }
  // Apply globalRestLength as a scale factor to all spring rest lengths
  // This allows dynamic adjustment while preserving the relative proportions
  if (state.globalRestLength !== undefined && state.globalRestLength !== 1.0) {
    for (const spring of body.springs) {
      // Scale the existing rest length rather than overriding it completely
      spring.restLength *= state.globalRestLength;
    }
  }
  if (state.globalInteractionStrength !== undefined && typeof body.setGlobalInteractionStrength === 'function') {
    body.setGlobalInteractionStrength(state.globalInteractionStrength);
  }
  if (state.enableMooneyRivlin !== undefined) {
    for (const cell of body.cells) {
      cell.mooneyC1 = state.enableMooneyRivlin ? 1.0 : 0.0;
      cell.mooneyC2 = state.enableMooneyRivlin ? 0.2 : 0.0;
    }
  }
  if (state.mooneyDamping !== undefined) {
    for (const cell of body.cells) {
      cell.mooneyDamping = state.mooneyDamping;
    }
  }
  if (state.mooneyMaxForce !== undefined) {
    for (const cell of body.cells) {
      cell.mooneyMaxForce = state.mooneyMaxForce;
    }
  }
  
  // The speed and maxFps will be applied through the parameter change event system
  // when the UIController processes the current state
  
  // Re-emit current state to ensure all parameters are properly applied
  // This will trigger the UIController's parameter change handlers
  eventBus.emit('parameterChange', {
    speed: state.speed,
    maxFps: state.maxFps,
    // Add any other parameters that need to be re-applied through the event system
  });
  
  if (state.enableForceCoordination !== undefined || 
      state.materialModelMode !== undefined || 
      state.energyBudgetLimit !== undefined) {
    SimulationStepper.updateForceCoordinationConfig({
      enableCoordination: state.enableForceCoordination,
      materialModelMode: state.materialModelMode,
      energyBudgetLimit: state.energyBudgetLimit
    });
  }
  
  // Animation loop
  isSimulationCrashed = false;
  let lastFrameTime = 0;
  let adaptiveFps = current.uiController?.simulationMaxFps ?? (SIM_CONFIG.maxFps ?? 60);
  let slowFrameCount = 0;
  let fastFrameCount = 0;
  // Performance tracking for real-world feedback
  let lastFpsLog = performance.now();
  let frameCount = 0;

  function animate(now?: number) {
    if (isSimulationCrashed) return;
    const maxFps = adaptiveFps;
    const minFrameTime = 1000 / maxFps;
    const time = now ?? performance.now();
    const isPaused = current.uiController?.['isPaused'] ?? false;
    let frameTime = time - lastFrameTime;
    // Harden: If frameTime is too large (e.g. after tab switch or DevTools open), skip this frame to avoid simulation explosion
    const maxAllowedFrameTime = 100; // ms (0.1s)
    if (frameTime > maxAllowedFrameTime) {
      if (SIM_CONFIG.enableDebugLogging) {
        console.warn(`[main.ts] Skipping simulation step: large frameTime (${frameTime.toFixed(2)} ms)`);
      }
      lastFrameTime = time;
      current.animationId = requestAnimationFrame(animate);
      return;
    }
    if (frameTime >= minFrameTime) {
      if (!isPaused) {
        // Update user interaction controller for gradual release
        if (current.userInteractionController) {
          current.userInteractionController.update(1/60);
        }
        // Only update views when simulation is running
        hexGridView.update(body.cells);
        springView.update(body.springs);
        uiController.step(1/60);
      }
      // Always render plugins (they may have their own pause handling)
      pluginSystem.render(1/60);
      // Adaptive FPS logic
      if (frameTime > minFrameTime * 1.5 && adaptiveFps > 20) {
        slowFrameCount++;
        fastFrameCount = 0;
        if (slowFrameCount > 10) { adaptiveFps = Math.max(20, adaptiveFps - 10); slowFrameCount = 0; }
      } else if (frameTime < minFrameTime * 0.7 && adaptiveFps < 120) {
        fastFrameCount++;
        slowFrameCount = 0;
        if (fastFrameCount > 30) { adaptiveFps = Math.min(120, adaptiveFps + 10); fastFrameCount = 0; }
      } else {
        slowFrameCount = 0;
        fastFrameCount = 0;
      }
      lastFrameTime = time;
    }
    
    // Log performance metrics every 2 seconds for analysis
    if (time - lastFpsLog > 2000) {
      const fps = frameCount / ((time - lastFpsLog) / 1000);
      
      DebugLogger.log('performance', 'Frame rate metrics', {
        timestamp: time,
        frameTime: frameTime,
        fps: fps,
        nodeCount: current.body?.nodes.length || 0,
        springCount: current.body?.springs.length || 0,
        interactionActive: current.userInteractionController?.hasActiveInteraction() || false
      });
      
      frameCount = 0;
      lastFpsLog = time;
    }
    
    frameCount++;
    current.animationId = requestAnimationFrame(animate);
  }
  animate();
}

// Expose for UIController
(window as any).resetSimulation = () => initSimulation();
(window as any).resetSimulationWithParams = (params: Partial<SimulationState>) => initSimulation(params);

// Expose mesh stabilizer and shape enforcer for debugging
(window as any).SimulationStepper = SimulationStepper;
(window as any).getMeshStabilizationStats = () => {
  return SimulationStepper.getPublicMeshStabilizer().getMeshStabilizationStats();
};
(window as any).getShapeEnforcementStats = () => {
  return SimulationStepper.getPublicShapeEnforcer().getEnforcementStats(current.world?.bodies || []);
};

// For integration tests: export an initApp function
export async function initApp({ canvas, overlay, uiPanel }: { canvas: HTMLCanvasElement, overlay: HTMLCanvasElement, uiPanel: HTMLElement }) {
  // Minimal headless setup for integration tests
  const renderer = await PixiRenderer2D.create({ width: canvas.width, height: canvas.height, view: canvas });
  const defaultParams = { mass: 0.01, springFrequency: 8.0, dampingRatio: 0.02 };
  const margin = 40;
  const spacing = computeCellSpacingForGrid(canvas.width, canvas.height, 20, 15, margin);
  
  // COORDINATE SYSTEM FIX: Use coordinate transform for tests too
  const coordinateTransform = new CoordinateTransform(canvas.width, canvas.height, 20);
  const body = HexGridFactory.createHexSoftBodyWithTransform(coordinateTransform, spacing, defaultParams, margin, 20, 15);
  
  globalThis.world = new PhysicsWorld2D();
  // Convert gravity to physics coordinates
  const screenGravity = { x: SIM_CONFIG.gravity.x, y: SIM_CONFIG.gravity.y };
  const physicsGravity = coordinateTransform.screenVelocityToPhysics(screenGravity.x, screenGravity.y);
  globalThis.world.gravity = physicsGravity;
  
  const userInteractionController = new UserInteractionController(() => body, () => globalThis.world!, coordinateTransform);
  const hexGridView = new HexGridView(body.cells, userInteractionController, coordinateTransform);
  const springView = new SpringView(body.springs, coordinateTransform);
  renderer.addLayer('hexGrid', hexGridView);
  renderer.addLayer('springs', springView);
  return { renderer, hexGridView, springView, body, coordinateTransform };
}

// Add robust error logging and step-by-step debug output
(async () => {
  console.debug('[DEBUG] main.ts: Invoking start()');
  try {
    await initSimulation();
    console.debug('[DEBUG] main.ts: start() completed successfully');
  } catch (err) {
    console.error('[ERROR] main.ts: start() failed:', err);
  }
})();

export async function start() {
  DebugLogger.log('system-event', '[main.ts] Invoking start()', {});
  
  // Debug logging is already initialized at the top of main.ts

  try {
    await initSimulation();
    DebugLogger.log('system-event', '[main.ts] Simulation initialized successfully', {});
  } catch (err) {
    DebugLogger.log('system-event', '[main.ts] Simulation initialization failed', { error: err });
  }
}

