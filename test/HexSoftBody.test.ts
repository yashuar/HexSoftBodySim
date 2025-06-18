import { HexSoftBody } from '../src/domain/HexSoftBody';
import { PointMass2D } from '../src/domain/PointMass2D';
import { Spring2D } from '../src/domain/Spring2D';
import { HexCell } from '../src/domain/HexCell';

describe('HexSoftBody (Outcome-Driven)', () => {
  it('initializes with correct nodes, springs, and cells, observable via array lengths', () => {
    const nodes = [
      new PointMass2D({ x: 0, y: 0 }, 1, 0),
      new PointMass2D({ x: 1, y: 0 }, 1, 0),
      new PointMass2D({ x: 1, y: 1 }, 1, 0),
      new PointMass2D({ x: 0, y: 1 }, 1, 0),
      new PointMass2D({ x: 0.5, y: 1.5 }, 1, 0),
      new PointMass2D({ x: 0.5, y: -0.5 }, 1, 0),
    ];
    const springs = [
      new Spring2D(nodes[0], nodes[1], 1, 1, 0.1),
    ];
    const cell = new HexCell(nodes, { x: 0.5, y: 0.5 });
    const softBody = new HexSoftBody(nodes, springs, [cell]);
    expect(softBody.nodes.length).toBe(6);
    expect(softBody.springs.length).toBe(1);
    expect(softBody.cells.length).toBe(1);
  });

  it('computes total area > 0 for a valid body, observable via output', () => {
    const nodes = [
      new PointMass2D({ x: 0, y: 0 }, 1, 0),
      new PointMass2D({ x: 1, y: 0 }, 1, 0),
      new PointMass2D({ x: 1, y: 1 }, 1, 0),
      new PointMass2D({ x: 0, y: 1 }, 1, 0),
      new PointMass2D({ x: 0.5, y: 1.5 }, 1, 0),
      new PointMass2D({ x: 0.5, y: -0.5 }, 1, 0),
    ];
    const cell = new HexCell(nodes, { x: 0.5, y: 0.5 });
    const softBody = new HexSoftBody(nodes, [], [cell]);
    expect(softBody.getTotalArea()).toBeGreaterThan(0);
  });
});
