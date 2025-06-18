# Architecture

## Overview

PhysicsEngine2D is a modular, extensible 2D soft-body simulation engine built on a hexagonal mesh. The architecture is designed for maintainability, testability, and extensibility, using PixiJS for all rendering, a plugin system for custom extensions, and a modern, responsive UI.

- **Rendering:** All rendering is handled by PixiJS (`PixiRenderer2D` and modular view classes). No legacy WebGL or shader code remains.
- **Simulation:** Orchestrated by `PhysicsWorld2D`, with modular stepping (`SimulationStepper`), parameter blending (`MaskBlender`), and state management (`StateManager`).
- **State Management:** All simulation and UI state flows through a central `StateManager` for reactivity and maintainability.
- **Plugin System:** The `PluginSystem` allows for easy extension of simulation and rendering logic without modifying core code.
- **UI/UX:** Responsive, touch-friendly UI with a collapsible parameter panel and robust pointer/mouse/touch support.
- **Single Responsibility:** Each module/class is focused and minimal, following the Single Responsibility Principle.

## Key Modules

- `PixiRenderer2D` – Modular, robust PixiJS renderer.
- `HexGridView`, `SpringView` – Modular view layers for grid and springs.
- `SimulationStepper` – Modular simulation step logic.
- `MaskBlender` – Centralized mask blending and parameter logic.
- `CellParameterUtils` – Utilities for parameter blending and smoothing.
- `StateManager` – Centralized, reactive state management for simulation and UI.
- `PluginSystem` – Register and run custom simulation/rendering plugins.
- `UIController` – Manages UI state, parameter panel, and user events.

## Parameter & State Management

- All simulation and UI parameters are centralized in the StateManager and controlled via the ParameterPanel.
- The UIController ensures that:
  - Live-updatable parameters (gravity, Mooney-Rivlin, speed, max FPS) are applied instantly.
  - Grid/structure and physical parameters (cell spacing, rows, cols, margin, mass, stiffness, damping) are only applied on reset, using the current StateManager values.
- The Reset Simulation button always rebuilds the simulation/grid with the current parameter values.
- The Restore Defaults button resets the panel and StateManager, but does not affect the simulation until reset.

## Performance Features

- Object pooling for physics objects.
- Dirty flag batching for efficient updates.
- Adaptive FPS in the animation loop.

## Extension Points

- **Plugins:** Add custom simulation or rendering logic by registering plugins with `PluginSystem`.
- **Views:** Add new PixiJS view layers by extending and registering with `PixiRenderer2D`.
- **Parameters:** All cell parameter logic is centralized and type-safe.
- **UI:** Extend or customize the parameter panel and UIController for new controls or features.

## User Interaction Flow

1. **Pointer/touch/mouse event** on a node (via `HexGridView`).
2. **UserInteractionController** creates a `UserConstraint2D` and updates the simulation state.
3. **PhysicsWorld2D** applies all constraints and steps the simulation.
4. **PixiRenderer2D** and view layers update the visual state.

## Testing

See `TESTING.md` for strategies and coverage.

---

This architecture ensures the project is future-proof, easy to maintain, and ready for advanced features or community contributions.
