import { SpringView } from '../src/presentation/pixi/SpringView';
import { vi, afterEach, describe, it, expect } from 'vitest';

afterEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

describe('SpringView (Outcome-Driven)', () => {
  it('adds a graphic for each spring (observable outcome)', () => {
    const springs = [
      { a: 0, b: 1 },
      { a: 1, b: 2 }
    ];
    const nodes = [
      { position: { x: 0, y: 0 } },
      { position: { x: 1, y: 1 } },
      { position: { x: 2, y: 2 } }
    ];
    const view = new SpringView(springs as any, nodes as any);
    // Outcome-driven: check number of children (graphics objects)
    expect(view.children.length).toBe(springs.length);
    // Update with new springs
    const newSprings = [
      { a: 0, b: 2 }
    ];
    view.update(newSprings as any, nodes as any);
    expect(view.children.length).toBe(newSprings.length);
  });
});
