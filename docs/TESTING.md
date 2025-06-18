# Testing

All tests are focused on the new modular PixiJS-based architecture and UI.

- **Unit tests:** Cover all core modules (parameter blending, simulation stepping, state management, plugin system).
- **Integration tests:** Validate end-to-end simulation and rendering flows using PixiJS and the UI.
- **Snapshot/Visual tests:** (Recommended) Use for visual regression of rendered output (e.g., with jest-image-snapshot).
- **Accessibility tests:** (Recommended) Use tools like axe-core to ensure the UI is accessible.
- **Performance tests:** (Optional) Add benchmarks or assertions for simulation step/render time to catch regressions early.

Legacy WebGL tests have been removed. All new tests should focus on user-centric, state-driven, and modular code.

## Recommendations

- Add tests for new UI features (collapsible panel, pointer/touch interaction).
- Add tests for plugin registration and extension points.
- Integrate accessibility and user-centric UI tests.
- Document test strategies and workflows for contributors.

## Parameter Panel & Reset Checklist

- Changing any parameter updates StateManager and UI.
- Reset always uses current values from the panel.
- Live-updatable parameters (gravity, Mooney-Rivlin, speed, max FPS) are applied instantly.
- Grid/structure and physical parameters (cell spacing, rows, cols, margin, mass, stiffness, damping) only take effect on reset.
- Restore Defaults resets the panel, but not the simulation until reset is pressed.

## Performance

- Test object pooling: No memory leaks or excessive allocations on repeated resets.
- Test dirty flag batching: Only changed objects are updated each frame.
- Test adaptive FPS: Simulation lowers/raises FPS based on frame time.
