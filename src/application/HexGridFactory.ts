// HexGridFactory: Builds HexSoftBody with initial parameters, initializes HexGridSpatialIndex.
// Responsible for mesh/grid construction and setup.

import { PointMass2D } from '../domain/PointMass2D';
import { Spring2D } from '../domain/Spring2D';
import { HexCell } from '../domain/HexCell';
import { HexSoftBody } from '../domain/HexSoftBody';

export class HexGridFactory {
  // Create a regular hexagonal grid and return a HexSoftBody
  static createHexSoftBody(rows: number, cols: number, spacing: number, defaultParams: { mass: number; stiffness: number; damping: number }): HexSoftBody {
    // Add a border of 1 cell around the grid
    const border = 1;
    const paddedRows = rows + 2 * border;
    const paddedCols = cols + 2 * border;
    const nodes: PointMass2D[] = [];
    const nodeMap: Map<string, PointMass2D> = new Map();
    const springs: Spring2D[] = [];
    const cells: HexCell[] = [];
    const sqrt3 = Math.sqrt(3);
    // Create all nodes for the padded grid
    for (let r = 0; r < paddedRows; r++) {
      for (let q = 0; q < paddedCols; q++) {
        const x = spacing * (q + r / 2 - border - border / 2);
        const y = spacing * (r - border) * sqrt3 / 2;
        const key = `${q},${r}`;
        if (!nodeMap.has(key)) {
          const node = new PointMass2D({ x, y }, defaultParams.mass, defaultParams.damping);
          nodes.push(node);
          nodeMap.set(key, node);
        }
      }
    }
    // Create all cells for the padded grid
    const cellOffsets = [
      [0, 0], [1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1]
    ];
    for (let r = 0; r < paddedRows; r++) {
      for (let q = 0; q < paddedCols; q++) {
        // Only keep cells whose (q, r) are within the target area (excluding border)
        if (q < border || q >= paddedCols - border || r < border || r >= paddedRows - border) continue;
        const cellNodes: PointMass2D[] = [];
        for (const [dq, dr] of cellOffsets) {
          const key = `${q + dq},${r + dr}`;
          const node = nodeMap.get(key);
          if (node) cellNodes.push(node);
        }
        if (cellNodes.length !== 6) {
          // Should not happen with border padding, but keep for safety
          console.warn('[DEBUG] Skipping cell at', {q, r}, 'with', cellNodes.length, 'nodes:', cellNodes.map(n => n.position));
          continue;
        }
        const uniqueNodes = new Set(cellNodes);
        if (uniqueNodes.size !== 6) {
          console.error('[DEBUG] Duplicate nodes in cell at', {q, r}, cellNodes);
          continue;
        }
        const center = cellNodes.reduce((acc, n) => ({ x: acc.x + n.position.x, y: acc.y + n.position.y }), { x: 0, y: 0 });
        center.x /= 6; center.y /= 6;
        // Store the cell's (q, r) relative to the original grid (0-based)
        const cell = new HexCell(cellNodes, center, defaultParams.mass, defaultParams.stiffness, defaultParams.damping, { q: q - border, r: r - border });
        cells.push(cell);
        // Add springs for each edge (avoid duplicates)
        for (let i = 0; i < 6; i++) {
          const a = cellNodes[i];
          const b = cellNodes[(i + 1) % 6];
          if (!springs.some(s => (s.a === a && s.b === b) || (s.a === b && s.b === a))) {
            const restLength = Math.sqrt(
              Math.pow(a.position.x - b.position.x, 2) +
              Math.pow(a.position.y - b.position.y, 2)
            );
            springs.push(new Spring2D(a, b, restLength, defaultParams.stiffness, defaultParams.damping));
          }
        }
      }
    }
    // Optionally, remove unused nodes (not referenced by any cell)
    const usedNodes = new Set<PointMass2D>();
    for (const cell of cells) for (const n of cell.nodes) usedNodes.add(n);
    const filteredNodes = nodes.filter(n => usedNodes.has(n));
    // Log summary after construction
    console.info('[DEBUG] Total valid hex cells:', cells.length);
    return new HexSoftBody(filteredNodes, springs, cells);
  }
}
