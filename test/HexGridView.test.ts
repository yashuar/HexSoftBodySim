import { HexGridView } from '../src/presentation/pixi/HexGridView';
import { vi, afterEach, describe, it, expect } from 'vitest';

afterEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

describe('HexGridView (Outcome-Driven)', () => {
  it('adds a graphic for each cell (observable outcome)', () => {
    const cells = [
      { centroid: { x: 0, y: 0 }, area: 1 },
      { centroid: { x: 1, y: 1 }, area: 1 }
    ];
    const view = new HexGridView(cells as any);
    // Outcome-driven: check number of children (graphics objects)
    expect(view.children.length).toBe(cells.length);
    // Update with new cells
    const newCells = [
      { centroid: { x: 2, y: 2 }, area: 1 }
    ];
    view.update(newCells as any);
    expect(view.children.length).toBe(newCells.length);
  });
});
