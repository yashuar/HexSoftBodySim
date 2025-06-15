// main.ts: Entry point for the PhysicsEngine2D demo
// This demo creates a hexagonal soft body, applies a mask region, and visualizes the simulation in real time.

import { HexGridFactory } from './application/HexGridFactory';
import { PhysicsWorld2D } from './domain/PhysicsWorld2D';
import { SimulationCoordinator } from './application/SimulationCoordinator';
import { WebGLRenderer2D } from './presentation/WebGLRenderer2D';
import { MaskOverlay } from './presentation/MaskOverlay';
import { UIController } from './presentation/UIController';
import { MaskRegion } from './application/MaskParser';
import { HexSoftBody } from './domain/HexSoftBody';

// Get canvas and UI elements
const canvas = document.getElementById('main-canvas') as HTMLCanvasElement;
const overlay = document.getElementById('overlay-canvas') as HTMLCanvasElement;
const uiPanel = document.getElementById('ui-panel') as HTMLElement;

// Create a hexagonal soft body (10x10 grid, 40px spacing)
const defaultParams = { mass: 1, stiffness: 1, damping: 0.01 };
const body = HexGridFactory.createHexSoftBody(10, 10, 40, defaultParams);

// Set the ground level (y coordinate) and enable/disable ground
const GROUND_Y = 0; // Change this value to move the ground up or down
const ENABLE_GROUND = true; // Set to false to disable the ground constraint

const world = new PhysicsWorld2D();
world.groundY = GROUND_Y;
world.enableGround = ENABLE_GROUND;
const coordinator = new SimulationCoordinator(world, body);

// Example mask region (centered polygon, higher stiffness)
// const maskRegion: MaskRegion = {
//   polygon: [
//     { x: 300, y: 200 }, { x: 500, y: 200 }, { x: 550, y: 350 },
//     { x: 400, y: 500 }, { x: 250, y: 350 }
//   ],
//   params: { mass: 1, stiffness: 5, damping: 0.01 },
//   weight: 1
// };

// Set up renderer and overlay
const renderer = new WebGLRenderer2D(canvas);
const overlayRenderer = new MaskOverlay(overlay);

// Set up UI controller
const ui = new UIController(coordinator, 'ui-panel');
// ui.addMaskRegion(maskRegion);

// Center and fit the grid into the canvas
function centerAndFitGrid(body: HexSoftBody, renderer: WebGLRenderer2D) {
  // Compute bounding box of all nodes
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const node of body.nodes) {
    if (node.position.x < minX) minX = node.position.x;
    if (node.position.x > maxX) maxX = node.position.x;
    if (node.position.y < minY) minY = node.position.y;
    if (node.position.y > maxY) maxY = node.position.y;
  }
  const center = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
  const gridWidth = maxX - minX;
  const gridHeight = maxY - minY;
  const margin = 40; // px
  const scaleX = (canvas.width - margin * 2) / gridWidth;
  const scaleY = (canvas.height - margin * 2) / gridHeight;
  const zoom = Math.min(scaleX, scaleY);
  // Debug logs
  console.log('[DEBUG] Grid bounding box:', { minX, minY, maxX, maxY });
  console.log('[DEBUG] Grid center:', center);
  console.log('[DEBUG] Grid size:', { gridWidth, gridHeight });
  console.log('[DEBUG] Canvas size:', { width: canvas.width, height: canvas.height });
  // Log CSS/display size and device pixel ratio for comparison
  console.log('[DEBUG] Canvas CSS/display size:', { width: canvas.style.width, height: canvas.style.height });
  console.log('[DEBUG] window.innerWidth/Height:', { width: window.innerWidth, height: window.innerHeight });
  console.log('[DEBUG] Device Pixel Ratio:', window.devicePixelRatio);
  console.log('[DEBUG] Calculated zoom:', zoom);
  renderer.setCamera(center, zoom);
}

// Animation loop with pause/resume support
let lastTime = performance.now();
function animate() {
  const now = performance.now();
  const dt = Math.min((now - lastTime) / 1000, 0.033); // Clamp to 30 FPS max step
  lastTime = now;
  if (!(ui as any).isPaused) {
    coordinator.step(dt * ui.simulationSpeed);
  }
  renderer.render(body);
  // overlayRenderer.render([maskRegion]);
  requestAnimationFrame(animate);
}
animate();

// Responsive canvas resizing
function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const width = Math.round(window.innerWidth * dpr);
  const height = Math.round(window.innerHeight * dpr);
  canvas.width = width;
  canvas.height = height;
  overlay.width = width;
  overlay.height = height;
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
  overlay.style.width = window.innerWidth + 'px';
  overlay.style.height = window.innerHeight + 'px';
  centerAndFitGrid(body, renderer);
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Ensure canvas always matches viewport size (CSS and attributes)
function setCanvasFullscreen() {
  canvas.style.position = 'absolute';
  canvas.style.left = '0';
  canvas.style.top = '0';
  canvas.style.width = '100vw';
  canvas.style.height = '100vh';
  overlay.style.position = 'absolute';
  overlay.style.left = '0';
  overlay.style.top = '0';
  overlay.style.width = '100vw';
  overlay.style.height = '100vh';
}
setCanvasFullscreen();

// If grid parameters change (e.g., body is recreated), call centerAndFitGrid again
// Example: after changing grid size or spacing
// body = HexGridFactory.createHexSoftBody(...);
// centerAndFitGrid(body, renderer);

// Optionally, add more UI controls and event listeners for mask editing, parameter adjustment, etc.
