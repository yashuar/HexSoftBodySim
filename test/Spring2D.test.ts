import { Spring2D } from '../src/domain/Spring2D';
import { PointMass2D } from '../src/domain/PointMass2D';

describe('Spring2D (Outcome-Driven)', () => {
  it('connects two distinct PointMass2D objects, observable via references', () => {
    const a = new PointMass2D({ x: 0, y: 0 }, 1, 0.1);
    const b = new PointMass2D({ x: 1, y: 0 }, 1, 0.1);
    const spring = new Spring2D(a, b, 1, 2, 0.1);
    expect(spring.a).toBe(a);
    expect(spring.b).toBe(b);
  });

  it('computes current length correctly, observable via output', () => {
    const a = new PointMass2D({ x: 0, y: 0 }, 1, 0.1);
    const b = new PointMass2D({ x: 3, y: 4 }, 1, 0.1);
    const spring = new Spring2D(a, b, 5, 1, 0.1);
    expect(spring.getCurrentLength()).toBeCloseTo(5);
  });

  it('applies spring force to both masses (Hookean), observable via velocity', () => {
    const a = new PointMass2D({ x: 0, y: 0 }, 1, 0.1);
    const b = new PointMass2D({ x: 2, y: 0 }, 1, 0.1);
    const spring = new Spring2D(a, b, 1, 1, 0.1);
    spring.applyForce();
    a.integrate(1);
    b.integrate(1);
    expect(a.velocity.x).toBeGreaterThan(0);
    expect(b.velocity.x).toBeLessThan(0);
  });
});
