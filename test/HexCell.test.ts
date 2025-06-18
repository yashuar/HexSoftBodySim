import { HexCell } from '../src/domain/HexCell';
import { PointMass2D } from '../src/domain/PointMass2D';

describe('HexCell (Outcome-Driven)', () => {
  it('creates a cell with 6 unique nodes, observable via Set', () => {
    const nodes = Array.from({ length: 6 }, (_, i) => new PointMass2D({ x: i, y: i }, 1, 0.01));
    const cell = new HexCell(nodes, { x: 0, y: 0 });
    // Outcome-driven: check observable property (unique nodes)
    const unique = new Set(cell.nodes);
    expect(unique.size).toBe(6);
  });

  it('computes centroid as average of node positions, observable via output', () => {
    const nodes = [
      new PointMass2D({ x: 0, y: 0 }, 1, 0.01),
      new PointMass2D({ x: 2, y: 0 }, 1, 0.01),
      new PointMass2D({ x: 2, y: 2 }, 1, 0.01),
      new PointMass2D({ x: 0, y: 2 }, 1, 0.01),
      new PointMass2D({ x: 1, y: 3 }, 1, 0.01),
      new PointMass2D({ x: 1, y: -1 }, 1, 0.01)
    ];
    const cell = new HexCell(nodes, { x: 0, y: 0 });
    const centroid = cell.getCentroid();
    const avgX = nodes.reduce((sum, n) => sum + n.position.x, 0) / 6;
    const avgY = nodes.reduce((sum, n) => sum + n.position.y, 0) / 6;
    expect(centroid.x).toBeCloseTo(avgX);
    expect(centroid.y).toBeCloseTo(avgY);
  });

  it('computes area > 0 for a valid hex, observable via output', () => {
    const nodes = [
      new PointMass2D({ x: 0, y: 0 }, 1, 0.01),
      new PointMass2D({ x: 2, y: 0 }, 1, 0.01),
      new PointMass2D({ x: 2, y: 2 }, 1, 0.01),
      new PointMass2D({ x: 0, y: 2 }, 1, 0.01),
      new PointMass2D({ x: 1, y: 3 }, 1, 0.01),
      new PointMass2D({ x: 1, y: -1 }, 1, 0.01)
    ];
    const cell = new HexCell(nodes, { x: 0, y: 0 });
    expect(cell.getArea()).toBeGreaterThan(0);
  });
});
