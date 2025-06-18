import { CellParameterUtils } from '../src/domain/CellParameterUtils';

describe('CellParameterUtils (Outcome-Driven)', () => {
  it('blends multiple parameter sets with weights, observable via output', () => {
    const defaultParams = { mass: 1, stiffness: 2, damping: 0.1 };
    const blendList = [
      { params: { mass: 2, stiffness: 4, damping: 0.2 }, weight: 2 },
      { params: { mass: 4, stiffness: 6, damping: 0.3 }, weight: 1 }
    ];
    const blended = CellParameterUtils.blend(blendList, defaultParams);
    // Outcome-driven: assert on output (observable result)
    expect(blended.mass).toBeCloseTo((2*2+4*1)/3 + 1/3);
    expect(blended.stiffness).toBeCloseTo((4*2+6*1)/3 + 2/3);
    expect(blended.damping).toBeCloseTo((0.2*2+0.3*1)/3 + 0.1/3);
  });

  it('returns defaultParams if blendList is empty, observable via output', () => {
    const defaultParams = { mass: 1, stiffness: 2, damping: 0.1 };
    const blended = CellParameterUtils.blend([], defaultParams);
    expect(blended).toEqual(defaultParams);
  });
});
