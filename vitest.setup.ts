// vitest.setup.ts: Global setup for Vitest (2025 best practices)
import { vi } from 'vitest';

// PixiJS global mock for all tests (headless, outcome-driven)
vi.mock('pixi.js', async () => {
  // Use actual for types, but override core classes
  const actual = await vi.importActual<any>('pixi.js');
  // Patch: Use a class to allow subclassing and custom methods
  class MockContainer {
    children: any[] = [];
    addChild(child: any) { this.children.push(child); return child; }
    removeChild(child: any) {
      const i = this.children.indexOf(child);
      if (i !== -1) this.children.splice(i, 1);
      return child;
    }
    removeChildren() {
      this.children.length = 0;
    }
  }
  // Patch Application to fully stub out all rendering logic for headless tests
  class MockApplication {
    stage: any;
    ticker: any;
    renderer: any;
    canvas: any;
    destroy: any;
    constructor() {
      this.stage = new MockContainer();
      this.ticker = { add: vi.fn(), remove: vi.fn() };
      this.renderer = { resize: vi.fn(), view: globalThis.document.createElement('canvas'), destroy: vi.fn() };
      this.canvas = this.renderer.view;
      this.destroy = vi.fn();
    }
    async init() { /* no-op */ }
  }
  return {
    ...actual,
    Application: MockApplication,
    Container: MockContainer,
    Graphics: actual.Graphics,
    autoDetectRenderer: vi.fn().mockImplementation(() => ({
      resize: vi.fn(),
      view: globalThis.document.createElement('canvas'),
      destroy: vi.fn(),
    })),
    CanvasRenderer: vi.fn().mockImplementation(() => ({
      resize: vi.fn(),
      view: globalThis.document.createElement('canvas'),
      destroy: vi.fn(),
    })),
  };
});

// Optionally, add more global/browser API mocks here
// Example: vi.stubGlobal('fetch', vi.fn());
