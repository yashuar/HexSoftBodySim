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

// Type augmentation for globalThis to allow 'world' property
declare global {
  // eslint-disable-next-line no-var
  var world: PhysicsWorld2D | undefined;
}

// === PIXIJS RENDERER SETUP ===
import * as PIXI from 'pixi.js';

console.log('[DEBUG] main.ts script loaded');

// === STATE MANAGEMENT ===
export interface SimulationState {
  maskRegions: MaskRegion[];
  defaultParams: CellParameters;
  smoothingFrames: number;
  desiredCellSpacing: number;
  desiredNumCols: number;
  desiredNumRows: number;
  margin: number;
}
const simState = new StateManager<SimulationState>({
  maskRegions: [],
  defaultParams: { mass: 1, springFrequency: 2.0, dampingRatio: 0.1 }, // Use config values for consistency
  smoothingFrames: 5,
  desiredCellSpacing: SIM_CONFIG.desiredCellSpacing,
  desiredNumCols: SIM_CONFIG.desiredNumCols,
  desiredNumRows: SIM_CONFIG.desiredNumRows,
  margin: SIM_CONFIG.margin,
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
  return new UIController(coordinator, 'ui-panel', simState, eventBus);
}

function setupUserInteractionController(canvas: HTMLCanvasElement | null | undefined, body: HexSoftBody, world: PhysicsWorld2D): UserInteractionController | null {
  if (canvas) {
    return new UserInteractionController(
      () => body,
      () => world
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
  const body = HexGridFactory.createHexSoftBodyToFitCanvas(width, height, spacing, cellParams, margin, numCols, numRows);
  current.body = body;
  if (body.nodes && body.nodes.length > 0) (globalThis as any)._debugFirstNode = body.nodes[0];
  const world = new PhysicsWorld2D();
  world.gravity = { x: SIM_CONFIG.gravity.x, y: SIM_CONFIG.gravity.y };
  current.world = world;
  const userInteractionController = setupUserInteractionController(canvas, body, world);
  current.userInteractionController = userInteractionController;
  const hexGridView = new HexGridView(body.cells, userInteractionController!);
  const springView = new SpringView(body.springs);
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
  // Animation loop
  isSimulationCrashed = false;
  let lastFrameTime = 0;
  let adaptiveFps = current.uiController?.simulationMaxFps ?? (SIM_CONFIG.maxFps ?? 60);
  let slowFrameCount = 0;
  let fastFrameCount = 0;
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
    current.animationId = requestAnimationFrame(animate);
  }
  animate();
}

// Expose for UIController
(window as any).resetSimulation = () => initSimulation();
(window as any).resetSimulationWithParams = (params: Partial<SimulationState>) => initSimulation(params);

// For integration tests: export an initApp function
export async function initApp({ canvas, overlay, uiPanel }: { canvas: HTMLCanvasElement, overlay: HTMLCanvasElement, uiPanel: HTMLElement }) {
  // Minimal headless setup for integration tests
  const renderer = await PixiRenderer2D.create({ width: canvas.width, height: canvas.height, view: canvas });
  const defaultParams = { mass: 0.01, springFrequency: 8.0, dampingRatio: 0.02 };
  const margin = 40;
  const spacing = computeCellSpacingForGrid(canvas.width, canvas.height, 20, 15, margin);
  const body = HexGridFactory.createHexSoftBodyToFitCanvas(canvas.width, canvas.height, spacing, defaultParams, margin);
  globalThis.world = new PhysicsWorld2D();
  globalThis.world.gravity = { x: SIM_CONFIG.gravity.x, y: SIM_CONFIG.gravity.y };
  const userInteractionController = new UserInteractionController(() => body, () => globalThis.world!);
  const hexGridView = new HexGridView(body.cells, userInteractionController);
  const springView = new SpringView(body.springs);
  renderer.addLayer('hexGrid', hexGridView);
  renderer.addLayer('springs', springView);
  return { renderer, hexGridView, springView, body };
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

