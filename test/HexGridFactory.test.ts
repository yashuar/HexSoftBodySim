import { HexGridFactory } from '../src/application/HexGridFactory';
import { HexSoftBody } from '../src/domain/HexSoftBody';

describe('HexGridFactory (Outcome-Driven)', () => {
  const defaultParams = { mass: 1, stiffness: 1, damping: 0.01 };

  it('creates a grid that fills the canvas, observable via node/cell coverage', () => {
    const canvasWidth = 800;
    const canvasHeight = 600;
    const numCols = 20;
    const numRows = 15;
    function computeCellSpacingForGrid(
      canvasWidth: number,
      canvasHeight: number,
      numCols: number,
      numRows: number,
      margin: number = 0
    ) {
      const usableWidth = canvasWidth - 2 * margin;
      const usableHeight = canvasHeight - 2 * margin;
      const spacingX = usableWidth / (numCols * 0.75 + 0.25);
      const spacingY = usableHeight / ((numRows - 1) * Math.sqrt(3) / 2 + 1);
      return Math.min(spacingX, spacingY);
    }
    const desiredCellSpacing = computeCellSpacingForGrid(canvasWidth, canvasHeight, numCols, numRows);
    const body = HexGridFactory.createHexSoftBodyToFitCanvas(canvasWidth, canvasHeight, desiredCellSpacing, defaultParams);
    // Outcome-driven: check node/cell coverage
    expect(body.cells.length).toBeGreaterThanOrEqual(numCols * numRows * 0.7);
    expect(body.cells.length).toBeLessThanOrEqual(numCols * numRows * 1.3);
    const minX = Math.min(...body.nodes.map(n => n.position.x));
    const maxX = Math.max(...body.nodes.map(n => n.position.x));
    const minY = Math.min(...body.nodes.map(n => n.position.y));
    const maxY = Math.max(...body.nodes.map(n => n.position.y));
    expect(maxX - minX).toBeGreaterThanOrEqual(canvasWidth * 0.7);
    expect(maxY - minY).toBeGreaterThanOrEqual(canvasHeight * 0.7);
  });

  it('creates a grid with no duplicate nodes or springs, observable via Set', () => {
    const body = HexGridFactory.createHexSoftBody(10, 10, 40, defaultParams);
    const nodeSet = new Set(body.nodes.map(n => `${n.position.x},${n.position.y}`));
    expect(nodeSet.size).toBe(body.nodes.length);
    const springSet = new Set(body.springs.map(s => [s.a, s.b].sort().map(n => `${n.position.x},${n.position.y}`).join('-')));
    expect(springSet.size).toBe(body.springs.length);
  });

  it('creates a minimal grid for small parameters, observable via output', () => {
    const body = HexGridFactory.createHexSoftBody(1, 1, 10, defaultParams);
    expect(body.nodes.length).toBeGreaterThan(0);
    expect(body.cells.length).toBeGreaterThan(0);
  });
});
