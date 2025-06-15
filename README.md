# 🧠 Soft-Body Hexagonal Simulation Engine

A **2D soft-body simulator** using a **hexagonal mesh** with **volume preservation** and **dynamic cell parameterization** via user-defined masks. The engine emphasizes visual quality and high performance on the web, leveraging modern technologies (Web Workers, WebGPU/WebGL2).

---

## 🌟 Goals & Motivation

* Develop a modular, extensible engine for simulating soft, elastic bodies on a hexagonal node network.
* Empower users to visually specify cell parameters (**mass**, **stiffness**, **damping**) via masks—without code changes.
* Utilize high-performance web technologies (Web Workers, GPU computing, WebGL) for smooth interactivity.
* Achieve organic, artifact-free deformations for soft-body elements (e.g., “jelly,” biological tissues).

---

## 🖥️ Demo & Rendering Pipeline

The included demo showcases the full simulation and rendering pipeline:

- **Mask Loading & Editing:** Users can load or draw masks to define regions with different physical properties.
- **Parameterization:** The engine samples mask data and assigns per-cell parameters (mass, stiffness, damping) to the hexagonal mesh.
- **Simulation:** The simulation runs in a Web Worker for responsiveness, applying forces, constraints, and integration steps to update the mesh state in real time.
- **Rendering Pipeline:**
  - The simulation state is synchronized to the main thread using a double-buffered `SharedArrayBuffer`.
  - The `WebGLRenderer2D` and its submodules (in `presentation/webgl/`) render the mesh using instanced drawing, custom shaders, and visual effects (e.g., normals, subsurface scattering).
  - The UI overlays (parameter panel, mask editor, etc.) allow real-time interaction and visualization of simulation parameters and results.
- **Performance:** GPU acceleration (WebGL2/WebGPU) ensures smooth, interactive frame rates even for large meshes.

To run the demo:
1. Install dependencies: `npm install`
2. Build and start: `npm run build && npm start`
3. Open the provided URL in your browser to interact with the simulation and UI.

---

## 🧩 Core Features & Design Improvements

1. **Hexagonal Mesh**: Regular 2D hexagonal grid with six neighbors per node for isotropic behavior.
2. **Data-Driven Cell Parameterization**: Cell parameters sampled by averaging mask pixels within each hexagon boundary.
3. **Conflict Resolution**: For overlapping masks, parameters blend by weighted averaging; transparent regions defer to default values.
4. **Volume Preservation**: Local `VolumeConstraint2D` per cell combined with optional global pressure pass.
5. **Parameter Update Protocol**: Mask changes queued and applied at the next `simulateStep` boundary with smoothing over N frames to avoid instability.
6. **Spatial Indexing**: `HexGridSpatialIndex` accelerates cell lookup (axial coordinates + bounding boxes).
7. **Flexible Material Models**: Supports linear (Hookean), non-linear (cubic, Mooney-Rivlin), and strain-stiffening elasticity. Springs can use a non-Hookean force law, parameterized strain-stiffening, and cells can apply Mooney-Rivlin hyperelastic forces for rubber-like behavior.
8. **Solver Sequencing**: Multi-stage constraint solving—global volume check, local cell corrections, final damping pass.
9. **Synchronization Policy**: Double-buffered `SharedArrayBuffer`; if worker lags, skip frame push but continue simulation.
10. **Capability Manager**: Runtime feature detection for WebGPU, WebGL2 compute, transform feedback, CPU fallback.
11. **Time-Step Stability**: Enforce max `dt` or adaptive stepping when constraint error exceeds threshold.
12. **Testing Strategy**: Unit, integration, and visual regression/snapshot tests for area/pressure computation, CPU-GPU comparison suite, and deformation validation.

---

## 📦 Architecture Overview

| Layer              | Components                                                                                    |
| ------------------ | --------------------------------------------------------------------------------------------- |
| **Presentation**   | MaskLoader, UIController, MaskEditor, ParameterPanel                                          |
| **Application**    | MaskParser, RegionPropertiesProvider, HexGridFactory, SimulationCoordinator                   |
| **Domain**         | PhysicsWorld2D, HexSoftBody, PointMass2D, Spring2D, HexCell, HexGridSpatialIndex              |
| **Infrastructure** | WebWorkerManager, GPUComputeManager, WebGLRenderer2D, TimerService, FileIO, CapabilityManager |

---

## 📁 Component Documentation

### 🎨 Presentation Layer

* **MaskLoader**: Loads and decodes image/polygon masks.
* **MaskEditor**: (Optional) UI for drawing/editing masks.
* **UIController**: Manages controls, parameter panels, and triggers mask updates.

### 🧭 Application Layer

* **MaskParser**: Samples mask per hex cell (averaging algorithm), resolves overlaps.
* **RegionPropertiesProvider**: Holds current cell parameters, applies update protocol.
* **HexGridFactory**: Builds `HexSoftBody` with initial parameters, initializes `HexGridSpatialIndex`.
* **SimulationCoordinator**: Orchestrates initialization, worker setup, and mask-change events.

### 🧠 Domain Layer

* **HexGridSpatialIndex**: Provides fast cell lookup given world coordinates, uses axial + bounding-box filter.
* **PhysicsWorld2D**: `simulateStep(dt)` executes multi-stage solver and enforces sync policy.
* **HexSoftBody**: Stores `nodes`, `edges`, `cells`; methods for area, pressure, and density modulation.
* **Spring2D**: Connects two point masses; supports Hookean (linear), non-Hookean (cubic), and strain-stiffening force laws for flexible elastic behavior. All options are parameterized for custom material response.
* **HexCell**: Represents a hexagonal element; can apply Mooney-Rivlin hyperelastic forces for advanced soft-body simulation.
* **ForceGenerator2D**: Implements `Gravity2D`, `PressureForce2D` applied in force phase.
* **Constraint2D**: Implements `SpringConstraint2D`, `VolumeConstraint2D`; solved per sequence stage.
* **Integrator2D**: Semi-implicit Euler with adaptive stepping; enforces max `dt`.

### 🛠 Infrastructure Layer

* **CapabilityManager**: Detects GPU compute, WebGL2 features, transform feedback, SharedArrayBuffer support.
* **WebWorkerManager**: Runs simulation in worker, handles double-buffered position sync.
* **GPUComputeManager**: Dispatches constraint passes via WebGPU or WebGL2 compute/transform-feedback.
* **WebGLRenderer2D**: Renders shell mesh with instanced draws, applies normals and SSS shaders.
* **TimerService**: Measures durations for each phase and triggers adaptive adjustments.
* **FileIO**: Loads mask files and configuration JSON.

---

## ⚡️ Physics: Parametrized Ground Constraint

- The simulation enforces a configurable lower boundary (ground) using a dedicated `GroundConstraint2D` class.
- The ground level is set via the `groundY` property of `PhysicsWorld2D` (see `main.ts`).
- The ground constraint can be enabled or disabled via the `enableGround` property (see `ENABLE_GROUND` in `main.ts`).
- Nodes cannot fall below the ground; their vertical velocity is zeroed on contact, but horizontal velocity is preserved (allowing sliding).
- The ground constraint is applied after all other constraints and integration for robust, stable behavior.
- The ground is not visualized by default, but the grid will rest and slide on the invisible ground if enabled.
- To change the ground level or toggle the ground constraint, set the `GROUND_Y` and `ENABLE_GROUND` constants in `main.ts` before simulation starts.

---

## ⚙️ Project Structure

```plaintext
src/
├── presentation/
│   ├── MaskLoader.ts
│   ├── MaskEditor.ts
│   ├── UIController.ts
├── application/
│   ├── MaskParser.ts
│   ├── RegionPropertiesProvider.ts
│   ├── HexGridFactory.ts
│   ├── SimulationCoordinator.ts
├── domain/
│   ├── HexGridSpatialIndex.ts
│   ├── PhysicsWorld2D.ts
│   ├── HexSoftBody.ts
│   ├── PointMass2D.ts
│   ├── Spring2D.ts
│   ├── HexCell.ts
│   ├── forces/
│   └── constraints/
├── infrastructure/
│   ├── CapabilityManager.ts
│   ├── WebWorkerManager.ts
│   ├── GPUComputeManager.ts
│   ├── WebGLRenderer2D.ts
│   ├── TimerService.ts
│   └── FileIO.ts
└── docs/
    ├── ARCHITECTURE.md
    └── TESTING.md
```

---

## 🧵 simulateStep Flow Diagram

```mermaid
flowchart TD
    A[Start simulateStep(dt)] --> B[Force Phase: applyForces()]
    B --> C[Collision Phase: detectAndResolveCollisions()]
    C --> D[Constraint Phase 1: global volume check]
    D --> E[Constraint Phase 2: local cell corrections]
    E --> H[Constraint Phase 3: final damping pass]
    H --> I[Integration: integrate(dt)]
    I --> J[Sync Policy: double-buffer positions]
    J --> K[Renderer consumes SharedArrayBuffer]
    K --> L[End simulateStep]
```

---

## ✅ Acceptance Criteria & QA

* [ ] Mesh initializes with correct cell parameters sampled by averaging mask values.
* [ ] Overlapping mask regions blend parameters correctly.
* [ ] Mask updates applied at step boundary; parameter transitions smooth over defined frames.
* [ ] Volume constraints converge within iteration budget; no global collapse.
* [ ] Frame sync maintains UI responsiveness; worker lag leads to frame skip, not jank.
* [ ] CPU-only fallback and GPU-accelerated paths produce matching results within epsilon.
* [ ] Visual snapshot tests validate expected deformation shapes.
* [ ] Performance metrics: main thread <50% CPU, GPU path reduces CPU time by ≥25%, consistent 60 FPS.
* [ ] Unit tests validate mask sampling, constraint satisfaction, integration stability.
* [ ] Integration tests verify communication between application and domain layers.
* [ ] Performance benchmarks compare GPU and CPU simulation steps under various mesh sizes.

---

## 🚀 Future Roadmap

### Short-Term
- WebGPU support for even faster simulation.
- Advanced mask editing tools (brush, lasso, import/export).
- More material models (viscoelasticity, plasticity).
- Improved UI/UX for parameter tuning and real-time feedback.

### Medium-Term
- 3D extension (extruded hex grids or layered 2D).
- Networked/multiplayer simulation (collaborative mask editing).
- Plugin system for user-defined forces, constraints, or renderers.
- Scripting API for custom simulation scenarios.

### Long-Term
- Integration with scientific/educational platforms.
- Export to standard formats (SVG, glTF, JSON).
- AI-assisted mask generation and parameter tuning.
- Mobile and VR/AR support.

---

## 🤖 AI-Agent Integration

This specification now includes:

1. **Explicit mask sampling rules** and blending logic.
2. **Parameter update protocol** for runtime stability.
3. **Spatial index** for efficient mapping.
4. **Multi-stage solver sequencing** with iteration budget.
5. **Synchronization policy** for worker-renderer data flow.
6. **Capability detection** categories and fallback.
7. **Time-step constraints** and adaptive stepping guidance.
8. **Testing strategy** with unit and snapshot tests.

These detailed guidelines will help the AI agent generate robust, performant code aligned with the design intent.

---

## 📚 References & Further Reading

* Mask-to-grid sampling strategies and anti-aliasing techniques.
* Patterns for web worker synchronization using SharedArrayBuffer.
* Implementing adaptive time-stepping in physics simulations.
* Snapshot testing with headless WebGL contexts.

---

## 📜 License

MIT © yashuar
