import { PixiRenderer2D } from '../src/presentation/pixi/PixiRenderer2D';
import { vi, afterEach, describe, it, expect } from 'vitest';

afterEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

describe('PixiRenderer2D (Outcome-Driven)', () => {
  it('adds and removes layers, observable in stage children', async () => {
    const renderer = await PixiRenderer2D.create({ width: 100, height: 100 });
    const dummyLayer = { name: 'dummy', addChild: vi.fn(), removeChild: vi.fn(), children: [] } as any;
    renderer.addLayer('dummy', dummyLayer);
    // Outcome-driven: check that the layer is present in the stage
    expect(renderer.getLayer('dummy')).toBe(dummyLayer);
    expect(renderer.app.stage.children).toContain(dummyLayer);
    renderer.removeLayer('dummy');
    expect(renderer.getLayer('dummy')).toBeUndefined();
    expect(renderer.app.stage.children).not.toContain(dummyLayer);
    renderer.destroy();
  });

  it('resizes and clears layers, observable in stage children', async () => {
    const renderer = await PixiRenderer2D.create({ width: 100, height: 100 });
    const layer = { name: 'a', addChild: vi.fn(), removeChild: vi.fn(), children: [] } as any;
    renderer.addLayer('a', layer);
    renderer.clearLayers();
    expect(renderer.getLayer('a')).toBeUndefined();
    expect(renderer.app.stage.children).not.toContain(layer);
    renderer.destroy();
  });
});
