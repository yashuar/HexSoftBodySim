// HexGridFactory: Builds HexSoftBody with initial parameters, initializes HexGridSpatialIndex.
// Refactored to use axial coordinates and trigonometric corner generation (Red Blob Games approach).

import { PointMass2D } from '../domain/PointMass2D';
import { Spring2D } from '../domain/Spring2D';
import { HexCell } from '../domain/HexCell';
import { HexSoftBody } from '../domain/HexSoftBody';
import { CellParameters } from '../domain/CellParameters';

function axialToPixel(q: number, r: number, size: number) {
  const x = size * Math.sqrt(3) * (q + r / 2);
  const y = size * 1.5 * r;
  return { x, y };
}

function hexCorner(center: { x: number; y: number }, size: number, i: number) {
  const angle_deg = 60 * i - 30;
  const angle_rad = Math.PI / 180 * angle_deg;
  return {
    x: center.x + size * Math.cos(angle_rad),
    y: center.y + size * Math.sin(angle_rad),
  };
}

export class HexGridFactory {
  // Create a regular hexagonal grid and return a HexSoftBody
  static createHexSoftBody(rows: number, cols: number, size: number, defaultParams: CellParameters): HexSoftBody {
    const nodes: PointMass2D[] = [];
    const nodeMap: Map<string, PointMass2D> = new Map();
    const springs: Spring2D[] = [];
    const cells: HexCell[] = [];
    // Build grid using axial coordinates
    for (let r = 0; r < rows; r++) {
      for (let q = 0; q < cols; q++) {
        const center = axialToPixel(q, r, size);
        // Compute 6 corners
        const corners = Array.from({ length: 6 }, (_, i) => hexCorner(center, size, i));
        // For mesh: use or create shared nodes at each corner
        const cellNodes: PointMass2D[] = [];
        for (const corner of corners) {
          const key = `${corner.x.toFixed(6)},${corner.y.toFixed(6)}`;
          let node = nodeMap.get(key);
          if (!node) {
            node = PointMass2D.fromParams({ x: corner.x, y: corner.y }, defaultParams);
            (node as any).gridIndex = { q, r };
            nodeMap.set(key, node);
            nodes.push(node);
          }
          cellNodes.push(node);
        }
        const cell = new HexCell(cellNodes, center, defaultParams, { q, r });
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
            springs.push(Spring2D.fromParams(a, b, restLength, defaultParams));
          }
        }
      }
    }
    // Log summary after construction
    console.info('[DEBUG] Total valid hex cells:', cells.length);
    return new HexSoftBody(nodes, springs, cells);
  }

  // Create a rectangular hex grid (offset layout), centered in the canvas
  static createHexSoftBodyToFitCanvas(width: number, height: number, spacing: number, defaultParams: CellParameters, margin: number = 0, numCols?: number, numRows?: number): HexSoftBody {
    // Compute max cols/rows that fit within the canvas, accounting for margin
    const usableWidth = width - 2 * margin;
    const usableHeight = height - 2 * margin;
    // Hex width = sqrt(3) * spacing, height = 2 * spacing
    const hexWidth = Math.sqrt(3) * spacing;
    const hexHeight = 2 * spacing;
    const vertSpacing = 0.75 * hexHeight; // vertical distance between centers
    const cols = numCols ?? Math.floor(usableWidth / hexWidth);
    const rows = numRows ?? Math.floor(usableHeight / vertSpacing);
    // Compute total grid size in pixels
    const gridWidth = cols * hexWidth + hexWidth / 2;
    const gridHeight = rows * vertSpacing + hexHeight / 2;
    // Center offset
    const offsetX = margin + (usableWidth - gridWidth) / 2 + hexWidth / 2;
    const offsetY = margin + (usableHeight - gridHeight) / 2 + hexHeight / 2;
    // Offset layout: even-q (staggered columns)
    function offsetToPixel(col: number, row: number, size: number) {
      const x = col * hexWidth + (row % 2) * (hexWidth / 2) + offsetX;
      const y = row * vertSpacing + offsetY;
      return { x, y };
    }
    const nodes: PointMass2D[] = [];
    const nodeMap: Map<string, PointMass2D> = new Map();
    const springs: Spring2D[] = [];
    const cells: HexCell[] = [];
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const center = offsetToPixel(col, row, spacing);
        const corners = Array.from({ length: 6 }, (_, i) => hexCorner(center, spacing, i));
        const cellNodes: PointMass2D[] = [];
        for (const corner of corners) {
          const key = `${corner.x.toFixed(6)},${corner.y.toFixed(6)}`;
          let node = nodeMap.get(key);
          if (!node) {
            node = PointMass2D.fromParams({ x: corner.x, y: corner.y }, defaultParams);
            (node as any).gridIndex = { q: col, r: row };
            nodeMap.set(key, node);
            nodes.push(node);
          }
          cellNodes.push(node);
        }
        // Use {q: col, r: row} for compatibility with HexCell
        const cell = new HexCell(cellNodes, center, defaultParams, { q: col, r: row });
        cells.push(cell);
        for (let i = 0; i < 6; i++) {
          const a = cellNodes[i];
          const b = cellNodes[(i + 1) % 6];
          if (!springs.some(s => (s.a === a && s.b === b) || (s.a === b && s.b === a))) {
            const restLength = Math.sqrt(
              Math.pow(a.position.x - b.position.x, 2) +
              Math.pow(a.position.y - b.position.y, 2)
            );
            springs.push(Spring2D.fromParams(a, b, restLength, defaultParams));
          }
        }
      }
    }
    console.info('[DEBUG] Total valid hex cells:', cells.length);
    return new HexSoftBody(nodes, springs, cells);
  }
}
