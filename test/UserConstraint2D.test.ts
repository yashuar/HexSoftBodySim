import { PointMass2D } from '../src/domain/PointMass2D';
import { UserConstraint2D } from '../src/domain/constraints/UserConstraint2D';

describe('UserConstraint2D (Outcome-Driven)', () => {
  it('pulls node toward the target position, observable via force', () => {
    const node = new PointMass2D({ x: 0, y: 0 }, 1, 0);
    const constraint = new UserConstraint2D(node, { x: 10, y: 0 }, 0.5);
    constraint.apply();
    expect(node.force.x).toBeCloseTo(5);
    expect(node.force.y).toBeCloseTo(0);
  });

  it('updates the target position, observable via force', () => {
    const node = new PointMass2D({ x: 0, y: 0 }, 1, 0);
    const constraint = new UserConstraint2D(node, { x: 0, y: 0 }, 1);
    constraint.setTarget({ x: 0, y: 5 });
    constraint.apply();
    expect(node.force.x).toBeCloseTo(0);
    expect(node.force.y).toBeCloseTo(5);
  });

  it('does not apply force if disabled, observable via force', () => {
    const node = new PointMass2D({ x: 0, y: 0 }, 1, 0);
    const constraint = new UserConstraint2D(node, { x: 10, y: 0 }, 1, false);
    constraint.apply();
    expect(node.force.x).toBe(0);
    expect(node.force.y).toBe(0);
  });
});
