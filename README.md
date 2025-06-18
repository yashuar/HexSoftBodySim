# 🧠 PhysicsEngine2D: Modular 2D Soft-Body Hexagonal Simulation

A **modern, extensible 2D soft-body simulator** using a **hexagonal mesh** with volume preservation, dynamic cell parameterization, and robust interactive user constraints. Built on PixiJS for all rendering, with a fully adaptive, resolution-aware grid, a plugin system, and a responsive, user-friendly UI.

---

## ✨ Features

- **PixiJS-Only Rendering:** All rendering is handled by PixiJS (`PixiRenderer2D` and modular view classes). No legacy WebGL or shader code remains.
- **Modular Architecture:** Each module/class is focused and minimal, following the Single Responsibility Principle.
- **Plugin System:** Easily extend simulation or rendering with plugins.
- **User Interaction:** Robust pointer/touch/mouse support for direct manipulation of the simulation.
- **Responsive UI:** Collapsible parameter panel, adaptive canvas, and Material-inspired controls.
- **Centralized State:** All simulation and UI state flows through a central `StateManager` for reactivity and maintainability.
- **TypeScript:** Strict typing and modern best practices throughout.

---

## 🏗️ Project Structure

```plaintext
src/
├── presentation/
│   ├── pixi/
│   │   ├── PixiRenderer2D.ts
│   │   ├── HexGridView.ts
│   │   └── SpringView.ts
│   ├── MaskLoader.ts
│   ├── MaskEditor.ts
│   ├── UIController.ts
├── application/
│   ├── MaskParser.ts
│   ├── MaskBlender.ts
│   ├── RegionPropertiesProvider.ts
│   ├── HexGridFactory.ts
│   ├── HexGridLayout.ts
│   ├── SimulationCoordinator.ts
├── domain/
│   ├── HexGridSpatialIndex.ts
│   ├── PhysicsWorld2D.ts
│   ├── SimulationStepper.ts
│   ├── HexSoftBody.ts
│   ├── PointMass2D.ts
│   ├── Spring2D.ts
│   ├── HexCell.ts
│   ├── CellParameters.ts
│   ├── CellParameterUtils.ts
│   ├── forces/
│   └── constraints/
├── infrastructure/
│   ├── StateManager.ts
│   ├── PluginSystem.ts
│   ├── CapabilityManager.ts
│   └── WebWorkerManager.ts
```

---

## 🖱️ UI & User Experience

- **Collapsible Parameter Panel:** Easily hide/show the UI to maximize simulation space.
- **Touch & Pointer Support:** Interact with the simulation on desktop and mobile.
- **No Scrollbars:** The canvas always fits the viewport, and scrolling is blocked.
- **Debug Logging:** Condensed, toggleable logs for development and troubleshooting.

---

# 🧠 Parameter Panel & State Management

- All simulation and UI parameters are controlled via a dynamic Material-inspired parameter panel.
- **Live-updatable parameters** (e.g., gravity, Mooney-Rivlin, speed, max FPS) are applied instantly to the running simulation.
- **Grid/structure and physical parameters** (cell spacing, rows, cols, margin, mass, stiffness, damping) are only applied when you press **Reset Simulation**. The new simulation/grid always uses the current values from the panel.
- The **Restore Defaults** button resets all parameters in the panel to their defaults, but does not affect the simulation until you press Reset.
- All parameter changes update the StateManager, which is the single source of truth for simulation and UI state.

# ⚡ Performance Features

- **Object pooling** for physics objects to reduce GC and memory churn.
- **Dirty flag batching**: Only changed objects are updated each frame.
- **Adaptive FPS**: The simulation loop automatically lowers or raises FPS based on frame time for optimal performance.

# 🛠️ Robustness & Extensibility

- Robust error handling and deduplicated debug logging.
- Plugin system for custom simulation or rendering logic.

# 🧪 Testing

- See `docs/TESTING.md` for parameter panel, reset, and performance test strategies.

---

## 📚 Architecture

See `docs/ARCHITECTURE.md` for a detailed overview of the modular structure, UI, and extension points.

---

## 🚀 Quick Start

1. Install dependencies: `npm install`
2. Build and start: `npm run build && npm start`
3. Open the provided URL in your browser and interact with the simulation!

---

## License

MIT © yashuar
