import { PointMass2D } from '../src/domain/PointMass2D';

describe('PointMass2D', () => {
  it('should initialize with correct position, mass, and damping', () => {
    const p = new PointMass2D({ x: 1, y: 2 }, 3, 0.5);
    expect(p.position.x).toBe(1);
    expect(p.position.y).toBe(2);
    expect(p.mass).toBe(3);
    expect(p.damping).toBe(0.5);
  });

  it('should update position and velocity', () => {
    const p = new PointMass2D({ x: 0, y: 0 }, 1, 0.1);
    p.position.x = 5;
    p.position.y = 6;
    p.velocity.x = 1;
    p.velocity.y = 2;
    expect(p.position.x).toBe(5);
    expect(p.position.y).toBe(6);
    expect(p.velocity.x).toBe(1);
    expect(p.velocity.y).toBe(2);
  });

  it('should apply forces and update velocity', () => {
    const p = new PointMass2D({ x: 0, y: 0 }, 2, 0); // Set damping to 0 for this test
    p.applyForce({ x: 4, y: 6 });
    p.integrate(1); // Integrate to update velocity
    expect(p.velocity.x).toBeCloseTo(2); // F=ma, a=F/m
    expect(p.velocity.y).toBeCloseTo(3);
  });

  it('should apply damping on integration', () => {
    const p = new PointMass2D({ x: 0, y: 0 }, 1, 0.5);
    p.velocity.x = 2;
    p.velocity.y = 0;
    p.integrate(1); // dt=1
    expect(p.velocity.x).toBeLessThan(2);
    expect(p.position.x).toBeGreaterThan(0);
  });
});
