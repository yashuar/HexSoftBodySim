# Code Quality & Refactoring Recommendations

_Last updated: 2025-06-18_

## 1. Current Improvements

- Modularized all core logic (rendering, simulation, UI, plugins).
- Centralized parameter blending and state management.
- Debug logging is now condensed and toggleable.
- UI is responsive, accessible, and touch-friendly.
- PixiJS v8+ best practices are followed (async init, app.canvas, modular layers).
- All new code is TypeScript with strict typing.

## 2. Ongoing Recommendations

### a. Refactor for Modularity & Maintainability
- Continue splitting large classes into focused modules.
- Use design patterns such as Factory, Observer, and Strategy where appropriate ([see patterns.dev](https://www.patterns.dev/)).

### b. Centralize Parameter Logic
- All cell parameter logic is now centralized and type-safe.
- Continue to expand utilities for blending, smoothing, and validation.

### c. Improve UI & State Management
- Consider using a lightweight state management library or a more declarative UI approach for future UI complexity.
- Decouple UI updates from direct DOM manipulation where possible.

### d. Enhance Testing
- Add tests for PixiJS rendering logic (e.g., using [@testing-library/dom](https://testing-library.com/docs/)).
- Focus on user-centric tests that verify visual and interactive outcomes.

### e. Performance & Robustness
- Replace any remaining `setInterval` with `requestAnimationFrame` or main loop integration for parameter smoothing.
- Profile and optimize any bottlenecks in the simulation or rendering loop.
- Add FPS, simulation step time, and memory usage hooks (as a plugin or core feature).

### f. Documentation & Comments
- Add JSDoc comments for all public APIs.
- Document architectural decisions and extension points.
- Add onboarding docs and extension guides for contributors.

### g. Plugin/Extension System
- Continue to expand plugin architecture for custom forces, constraints, or renderers.
- Add tests for plugin registration, simulation, and rendering hooks.

### h. Visual Regression & Snapshot Testing
- Integrate snapshot/image diff testing (e.g., with [jest-image-snapshot](https://github.com/americanexpress/jest-image-snapshot)) for key rendering outputs. Document workflow in `TESTING.md`.

### i. Accessibility (a11y)
- Add ARIA labels, keyboard navigation, and color contrast checks. Document accessibility requirements and testing tools (e.g., [axe-core](https://github.com/dequelabs/axe-core)) in `README.md` and `TESTING.md`.

### j. Contributor Onboarding
- Create a `CONTRIBUTING.md` with setup, coding standards, and extension points. Reference in `README.md`.

### k. Performance Profiling
- Add FPS, simulation step time, and memory usage hooks (as a plugin or core feature). Document usage and interpretation in `README.md`.

### l. Parameter Blending & State Management Tests
- Expand unit tests for `CellParameterUtils` and `StateManager` to cover all edge cases and state transitions.

### m. User-Centric & Accessibility Testing
- Integrate [@testing-library/dom](https://testing-library.com/docs/) for user-centric UI tests and [axe-core](https://github.com/dequelabs/axe-core) for accessibility checks. Add ARIA roles and keyboard navigation tests.

### n. PixiJS Rendering & View Tests
- Add tests that mount these views, render to an offscreen canvas, and verify output (optionally with snapshot/image diff). Use [jest-image-snapshot](https://github.com/americanexpress/jest-image-snapshot) or similar tools.

### o. Performance & Profiling Tests
- (Optional) Add benchmarks or assertions for simulation step/render time to catch regressions early.

---

## 3. References & Further Reading

- [PixiJS v8+ Docs & Guides](https://pixijs.download/release/docs/index.html)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [Refactoring Guru: Code Smells](https://refactoring.guru/refactoring/smells)
- [Patterns.dev: Modern Web Patterns](https://www.patterns.dev/)
- [Testing Library: User-Centric Testing](https://testing-library.com/docs/)

---

This document should be reviewed and updated as the project evolves and improvements are implemented.

## Parameter Logic
- All parameter logic is now fully centralized and consistent for all controls.
- StateManager is the single source of truth for simulation and UI state.
- Reset always uses current parameter values; live-updatable parameters are applied instantly.

## Performance
- Object pooling, dirty flag batching, and adaptive FPS are implemented for robust performance.
