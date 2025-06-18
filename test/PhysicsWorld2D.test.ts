import { PhysicsWorld2D } from '../src/domain/PhysicsWorld2D';
import { HexSoftBody } from '../src/domain/HexSoftBody';
import { PointMass2D } from '../src/domain/PointMass2D';
import { HexCell } from '../src/domain/HexCell';

describe('PhysicsWorld2D (Outcome-Driven)', () => {
  it('adds and steps a soft body with no gravity, observable via node positions', () => {
    const world = new PhysicsWorld2D();
    world.gravity = { x: 0, y: 0 };
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
    world.addBody(softBody);
    expect(world.bodies.length).toBe(1);
    world.simulateStep(0.1);
    // Outcome-driven: node positions should remain nearly unchanged
    expect(Math.abs(nodes[0].position.x)).toBeLessThan(0.02);
    expect(Math.abs(nodes[0].position.y)).toBeLessThan(0.02);
  });

  it('applies gravity and updates node positions, observable via output', () => {
    const world = new PhysicsWorld2D();
    world.gravity = { x: 0, y: 9.8 };
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
    world.addBody(softBody);
    world.simulateStep(0.1);
    // Outcome-driven: node positions should increase in y
    expect(nodes[0].position.y).toBeGreaterThan(0);
  });
});
