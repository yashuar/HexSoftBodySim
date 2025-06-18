// vitest.setup.js: Mocks for PixiJS and browser APIs to improve test reliability

// Mock PixiJS Application and Container for headless testing
const PIXI_MOCK = {
  Application: vi.fn().mockImplementation(() => {
    const canvas = globalThis.document.createElement('canvas');
    return {
      stage: { addChild: vi.fn(), removeChild: vi.fn(), children: [] },
      renderer: { resize: vi.fn(), view: canvas, destroy: vi.fn() },
      ticker: { add: vi.fn(), remove: vi.fn() },
      destroy: vi.fn(),
      canvas,
      // PixiJS v8+ async init stub
      init: vi.fn().mockResolvedValue(undefined),
    };
  }),
  Container: vi.fn().mockImplementation(() => ({
    addChild: vi.fn(),
    removeChild: vi.fn(),
    children: [],
  })),
  Graphics: vi.fn().mockImplementation(() => ({
    lineStyle: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    beginFill: vi.fn(),
    endFill: vi.fn(),
    drawCircle: vi.fn(),
    clear: vi.fn(),
  })),
  // Mock autoDetectRenderer and CanvasRenderer for headless
  autoDetectRenderer: vi.fn().mockImplementation(() => {
    const canvas = globalThis.document.createElement('canvas');
    return {
      resize: vi.fn(),
      view: canvas,
      destroy: vi.fn(),
    };
  }),
  CanvasRenderer: vi.fn().mockImplementation(() => {
    const canvas = globalThis.document.createElement('canvas');
    return {
      resize: vi.fn(),
      view: canvas,
      destroy: vi.fn(),
    };
  }),
};

vi.mock('pixi.js', async () => {
  const actual = await vi.importActual('pixi.js');
  return {
    ...actual,
    ...PIXI_MOCK,
  };
});

globalThis.PIXI = await import('pixi.js');
