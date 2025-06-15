// WebGLRenderer2D: Abstract Design for a Sophisticated WebGL2 Renderer
//
// High-Level Architecture:
// - Modular, extensible, and testable WebGL2 renderer for 2D physics/soft-body simulation.
// - Clean separation of concerns: initialization, resource management, scene graph, and rendering passes.
//
// Core Responsibilities:
// 1. WebGL Context & Resource Management
//    - Initialize and manage WebGL2 context.
//    - Compile, link, and manage shader programs.
//    - Create and manage GPU buffers (VBOs, VAOs, etc.).
//    - Handle texture and framebuffer resources if needed.
//
// 2. Scene Data Abstraction
//    - Accepts simulation data (bodies, cells, springs, nodes) in a structured format.
//    - Converts simulation data to GPU-friendly buffers (positions, colors, indices).
//    - Supports dynamic updates for real-time simulation.
//
// 3. Rendering Pipeline
//    - Implements multiple rendering passes (e.g., mesh, springs, nodes, overlays).
//    - Uses efficient draw calls (instancing, batching where possible).
//    - Supports parameter-based coloring, selection highlighting, and debug overlays.
//
// 4. Shader Management
//    - Modular shader sources for different passes (hexes, lines, points, overlays).
//    - Uniform and attribute management for passing simulation parameters and camera transforms.
//
// 5. Camera & Viewport
//    - Abstracts camera (pan, zoom, fit-to-view) and viewport resizing.
//    - Handles world-to-NDC (normalized device coordinates) transforms.
//
// 6. Extensibility & Maintainability
//    - Clear API for adding new visual effects (e.g., heatmaps, stress visualization).
//    - Well-documented, with utility methods for common WebGL tasks.
//    - Error handling and resource cleanup.
//
// Example Class Structure (not code, just conceptual):
//
// class WebGLRenderer2D {
//   // Initialization & context
//   constructor(canvas: HTMLCanvasElement) { ... }
//
//   // Resource management
//   private initShaders(): void { ... }
//   private initBuffers(): void { ... }
//   private resizeViewport(): void { ... }
//
//   // Scene data upload
//   public updateScene(simulationData: SimulationScene): void { ... }
//
//   // Rendering passes
//   public render(): void { ... }
//   private renderHexCells(): void { ... }
//   private renderSprings(): void { ... }
//   private renderNodes(): void { ... }
//   private renderOverlays(): void { ... }
//
//   // Camera & transforms
//   public setCamera(params: CameraParams): void { ... }
//
//   // Cleanup
//   public dispose(): void { ... }
// }
//
// // Types for clarity
// type SimulationScene = { bodies: ..., cells: ..., springs: ..., nodes: ... };
// type CameraParams = { center: {x, y}, zoom: number, ... };
//
// // Extensibility: add new passes, overlays, or effects by subclassing or composition.
//
// -----------------------------------------------------------------------------
// This design ensures the renderer is:
// - Modular: Each responsibility is encapsulated in a method or submodule.
// - Extensible: New features can be added without modifying core logic.
// - Maintainable: Clear separation of concerns and well-documented API.
// - Performant: Uses modern WebGL2 features and efficient data flows.
// -----------------------------------------------------------------------------
import { HexSoftBody } from '../domain/HexSoftBody';
import { Camera } from './webgl/Camera';
import { ShaderProgram } from './webgl/ShaderProgram';
import { HexCellRenderer } from './webgl/HexCellRenderer';
import { SpringRenderer } from './webgl/SpringRenderer';
import { NodeRenderer } from './webgl/NodeRenderer';

// Updated vertex and fragment shaders for instancing and camera uniform
const VERT_SHADER = `#version 300 es
precision highp float;
layout(location = 0) in vec2 a_position;
layout(location = 1) in vec2 a_instancePos;
layout(location = 2) in float a_instanceScale;
layout(location = 3) in vec4 a_instanceColor;

uniform vec2 u_cameraCenter;
uniform float u_cameraZoom;
uniform vec2 u_viewport;

out vec4 v_color;

void main() {
  // Scale and translate unit hex to world position
  float scale = a_instanceScale;
  vec2 world = a_instancePos + a_position * scale;
  // Camera transform (world to NDC)
  float sx = (world.x - u_cameraCenter.x) * u_cameraZoom + u_viewport.x / 2.0;
  float sy = (world.y - u_cameraCenter.y) * u_cameraZoom + u_viewport.y / 2.0;
  float ndc_x = (sx / u_viewport.x) * 2.0 - 1.0;
  float ndc_y = 1.0 - (sy / u_viewport.y) * 2.0;
  gl_Position = vec4(ndc_x, ndc_y, 0, 1);
  v_color = a_instanceColor;
}`;
const FRAG_SHADER = `#version 300 es
precision mediump float;
in vec4 v_color;
out vec4 outColor;
void main() {
  outColor = v_color;
}`;

// Simple shader for lines/points (springs/nodes)
const SIMPLE_VERT_SHADER = `#version 300 es
precision highp float;
layout(location = 0) in vec2 a_position;
layout(location = 1) in vec4 a_color;

uniform vec2 u_cameraCenter;
uniform float u_cameraZoom;
uniform vec2 u_viewport;
out vec4 v_color;
void main() {
  float sx = (a_position.x - u_cameraCenter.x) * u_cameraZoom + u_viewport.x / 2.0;
  float sy = (a_position.y - u_cameraCenter.y) * u_cameraZoom + u_viewport.y / 2.0;
  float ndc_x = (sx / u_viewport.x) * 2.0 - 1.0;
  float ndc_y = 1.0 - (sy / u_viewport.y) * 2.0;
  gl_Position = vec4(ndc_x, ndc_y, 0, 1);
  v_color = a_color;
}`;
const SIMPLE_FRAG_SHADER = `#version 300 es
precision mediump float;
in vec4 v_color;
out vec4 outColor;
void main() {
  outColor = v_color;
}`;

export class WebGLRenderer2D {
  private canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext;
  private camera: Camera;
  private hexShader: ShaderProgram;
  private simpleShader: ShaderProgram;
  private hexCellRenderer: HexCellRenderer;
  private springRenderer: SpringRenderer;
  private nodeRenderer: NodeRenderer;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2');
    if (!gl) throw new Error('WebGL2 not supported');
    this.gl = gl;
    this.camera = new Camera(canvas.width, canvas.height);
    this.hexShader = new ShaderProgram(gl, VERT_SHADER, FRAG_SHADER);
    this.simpleShader = new ShaderProgram(gl, SIMPLE_VERT_SHADER, SIMPLE_FRAG_SHADER);
    this.hexCellRenderer = new HexCellRenderer(gl, this.hexShader);
    this.springRenderer = new SpringRenderer(gl, this.simpleShader);
    this.nodeRenderer = new NodeRenderer(gl, this.simpleShader);
  }

  resize(width: number, height: number) {
    this.canvas.width = width;
    this.canvas.height = height;
    this.gl.viewport(0, 0, width, height);
    this.camera.resize(width, height);
  }

  setCamera(center: { x: number; y: number }, zoom: number) {
    this.camera.center = center;
    this.camera.zoom = zoom;
  }

  render(body: HexSoftBody) {
    this.gl.clearColor(1, 1, 1, 1);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    // Set camera uniforms for both shaders
    for (const shader of [this.hexShader, this.simpleShader]) {
      shader.use();
      const u_cameraCenter = shader.getUniformLocation('u_cameraCenter');
      const u_cameraZoom = shader.getUniformLocation('u_cameraZoom');
      const u_viewport = shader.getUniformLocation('u_viewport');
      if (u_cameraCenter && u_cameraZoom && u_viewport) {
        this.gl.uniform2f(u_cameraCenter, this.camera.center.x, this.camera.center.y);
        this.gl.uniform1f(u_cameraZoom, this.camera.zoom);
        this.gl.uniform2f(u_viewport, this.canvas.width, this.canvas.height);
      }
    }
    this.hexCellRenderer.render(body, this.camera);
    this.springRenderer.render(body, this.camera);
    this.nodeRenderer.render(body, this.camera);
  }

  // Cleanup resources
  dispose() {
    this.hexShader.dispose();
    this.simpleShader.dispose();
    this.hexCellRenderer.dispose();
    this.springRenderer.dispose();
    this.nodeRenderer.dispose();
  }
}
