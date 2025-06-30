// HexGridFactory: Builds HexSoftBody with initial parameters, initializes HexGridSpatialIndex.
// Refactored to use axial coordinates and trigonometric corner generation (Red Blob Games approach).

import { PointMass2D } from '../domain/PointMass2D';
import { Spring2D } from '../domain/Spring2D';
import { HexCell } from '../domain/HexCell';
import { HexSoftBody } from '../domain/HexSoftBody';
import { CellParameters } from '../domain/CellParameters';
import { CoordinateTransform } from './CoordinateTransform';

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
    const springSet: Set<string> = new Set(); // O(1) spring deduplication
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
            // Assign unique node ID for O(1) spring deduplication
            (node as any)._nodeId = nodes.length;
            nodeMap.set(key, node);
            nodes.push(node);
          }
          cellNodes.push(node);
        }
        const cell = new HexCell(cellNodes, center, defaultParams, { q, r });
        cells.push(cell);
        // Add springs for each edge using O(1) deduplication
        for (let i = 0; i < 6; i++) {
          const a = cellNodes[i];
          const b = cellNodes[(i + 1) % 6];
          // Create canonical spring key (smaller node ID first)
          const aId = (a as any)._nodeId;
          const bId = (b as any)._nodeId;
          const springKey = aId < bId ? `${aId}-${bId}` : `${bId}-${aId}`;
          
          if (!springSet.has(springKey)) {
            springSet.add(springKey);
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
    console.info(`[DEBUG] Total valid hex cells: ${cells.length}, unique springs: ${springs.length}, spring set size: ${springSet.size}`);
    return new HexSoftBody(nodes, springs, cells);
  }

  // Create a rectangular hex grid (offset layout), centered in the canvas
  static createHexSoftBodyToFitCanvas(width: number, height: number, spacing: number, defaultParams: CellParameters, margin: number = 0, numCols?: number, numRows?: number): HexSoftBody {
    // Use a moderate default margin if not specified
    margin = Math.max(margin, 40);
    // Hexagon geometry
    const hexWidth = Math.sqrt(3) * spacing;
    const hexHeight = 2 * spacing;
    const vertSpacing = 0.75 * hexHeight; // vertical distance between centers

    // Helper to get all 6 corners of a hex at a given center
    function getCorners(center: {x: number, y: number}, size: number) {
      return Array.from({ length: 6 }, (_, i) => hexCorner(center, size, i));
    }

    // Compute max cols/rows so that all corners of all cells are within bounds
    // Conservative: ensure even the outermost corners are inside the margin
    let maxCols = numCols ?? 1000;
    let maxRows = numRows ?? 1000;
    let found = false;
    let bestCols = 0, bestRows = 0, bestOffsetX = 0, bestOffsetY = 0;
    // Try decreasing grid sizes until one fits
    for (let tryRows = maxRows; tryRows >= 1 && !found; tryRows--) {
      for (let tryCols = maxCols; tryCols >= 1 && !found; tryCols--) {
        // Compute total grid size
        const gridWidth = tryCols * hexWidth + hexWidth / 2;
        const gridHeight = tryRows * vertSpacing + hexHeight / 2;
        const offsetX = margin + (width - 2 * margin - gridWidth) / 2 + hexWidth / 2;
        const offsetY = margin + (height - 2 * margin - gridHeight) / 2 + hexHeight / 2;
        let allInBounds = true;
        for (let row = 0; row < tryRows && allInBounds; row++) {
          for (let col = 0; col < tryCols && allInBounds; col++) {
            let x = col * hexWidth + (row % 2) * (hexWidth / 2) + offsetX;
            let y = row * vertSpacing + offsetY;
            const corners = getCorners({x, y}, spacing);
            for (const corner of corners) {
              if (
                corner.x < margin || corner.x > width - margin ||
                corner.y < margin || corner.y > height - margin
              ) {
                allInBounds = false;
                break;
              }
            }
          }
        }
        if (allInBounds) {
          bestCols = tryCols;
          bestRows = tryRows;
          bestOffsetX = offsetX;
          bestOffsetY = offsetY;
          found = true;
        }
      }
    }
    if (!found) {
      throw new Error('Could not fit any hex grid in the given area with the specified margin and spacing.');
    }

    // Now build the grid with the found size and offset
    const cols = bestCols;
    const rows = bestRows;
    const offsetX = bestOffsetX;
    const offsetY = bestOffsetY;
    // Offset layout: even-q (staggered columns)
    function offsetToPixel(col: number, row: number, size: number) {
      let x = col * hexWidth + (row % 2) * (hexWidth / 2) + offsetX;
      let y = row * vertSpacing + offsetY;
      return { x, y };
    }
    const nodes: PointMass2D[] = [];
    const nodeMap: Map<string, PointMass2D> = new Map();
    const springs: Spring2D[] = [];
    const springSet: Set<string> = new Set(); // O(1) spring deduplication
    const cells: HexCell[] = [];
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const center = offsetToPixel(col, row, spacing);
        const corners = getCorners(center, spacing);
        // Only create cells whose corners are all within bounds
        const allInBounds = corners.every(corner =>
          corner.x >= margin && corner.x <= width - margin &&
          corner.y >= margin && corner.y <= height - margin
        );
        if (!allInBounds) continue;
        const cellNodes: PointMass2D[] = [];
        for (const corner of corners) {
          const key = `${corner.x.toFixed(6)},${corner.y.toFixed(6)}`;
          let node = nodeMap.get(key);
          if (!node) {
            node = PointMass2D.fromParams({ x: corner.x, y: corner.y }, defaultParams);
            (node as any).gridIndex = { q: col, r: row };
            // Assign unique node ID for O(1) spring deduplication
            (node as any)._nodeId = nodes.length;
            nodeMap.set(key, node);
            nodes.push(node);
          }
          cellNodes.push(node);
        }
        // Use {q: col, r: row} for compatibility with HexCell
        const cell = new HexCell(cellNodes, center, defaultParams, { q: col, r: row });
        // Register this cell in each node's cellRefs
        for (const node of cellNodes) {
          if (!node.cellRefs) node.cellRefs = [];
          node.cellRefs.push(cell);
        }
        cells.push(cell);
        for (let i = 0; i < 6; i++) {
          const a = cellNodes[i];
          const b = cellNodes[(i + 1) % 6];
          // Create canonical spring key (smaller node ID first)
          const aId = (a as any)._nodeId;
          const bId = (b as any)._nodeId;
          const springKey = aId < bId ? `${aId}-${bId}` : `${bId}-${aId}`;
          
          if (!springSet.has(springKey)) {
            springSet.add(springKey);
            const restLength = Math.sqrt(
              Math.pow(a.position.x - b.position.x, 2) +
              Math.pow(a.position.y - b.position.y, 2)
            );
            console.log(`[HexGridFactory] Creating spring ${springKey}: restLength=${restLength.toFixed(2)}, springFreq=${defaultParams.springFrequency}`);
            springs.push(Spring2D.fromParams(a, b, restLength, defaultParams));
          }
        }
      }
    }
    console.info(`[DEBUG] Total valid hex cells: ${cells.length}, unique springs: ${springs.length}, spring set size: ${springSet.size}`);
    return new HexSoftBody(nodes, springs, cells);
  }

  // Create a hex grid using coordinate transformation (physics coordinates)
  static createHexSoftBodyWithTransform(
    coordinateTransform: CoordinateTransform, 
    spacing: number, 
    defaultParams: CellParameters, 
    margin: number = 0, 
    numCols?: number, 
    numRows?: number
  ): HexSoftBody {
    // Get physics world bounds
    const physicsBounds = coordinateTransform.getPhysicsBounds();
    
    // Use a moderate default margin in physics units
    const physicsMargin = coordinateTransform.screenDistanceToPhysics(Math.max(margin, 40));
    
    // Calculate available space in physics coordinates
    const availableWidth = physicsBounds.width - 2 * physicsMargin;
    const availableHeight = physicsBounds.height - 2 * physicsMargin;
    
    // Convert spacing from screen to physics coordinates
    const physicsSpacing = coordinateTransform.screenDistanceToPhysics(spacing);
    
    // Hexagon geometry in physics coordinates
    const hexWidth = Math.sqrt(3) * physicsSpacing;
    const hexHeight = 2 * physicsSpacing;
    const vertSpacing = 0.75 * hexHeight;
    
    // Calculate grid dimensions
    let maxCols = numCols ?? Math.floor(availableWidth / hexWidth);
    let maxRows = numRows ?? Math.floor(availableHeight / vertSpacing);
    
    // Ensure minimum grid size
    maxCols = Math.max(maxCols, 3);
    maxRows = Math.max(maxRows, 3);
    
    // Center the grid in physics space
    const totalGridWidth = maxCols * hexWidth;
    const totalGridHeight = maxRows * vertSpacing;
    const offsetX = (physicsBounds.width - totalGridWidth) / 2;
    const offsetY = (physicsBounds.height - totalGridHeight) / 2;
    
    console.log(`[HexGridFactory] Creating physics-coordinate grid:
      Physics bounds: ${physicsBounds.width.toFixed(2)} x ${physicsBounds.height.toFixed(2)}
      Grid size: ${maxCols} x ${maxRows} cells
      Physics spacing: ${physicsSpacing.toFixed(3)}
      Offset: ${offsetX.toFixed(2)}, ${offsetY.toFixed(2)}`);
    
    // Create grid using physics coordinates
    const nodes: PointMass2D[] = [];
    const nodeMap: Map<string, PointMass2D> = new Map();
    const springs: Spring2D[] = [];
    const springSet: Set<string> = new Set();
    const cells: HexCell[] = [];
    
    // Build grid using axial coordinates in physics space
    for (let r = 0; r < maxRows; r++) {
      for (let q = 0; q < maxCols; q++) {
        // Calculate center in physics coordinates
        const physicsCenter = {
          x: offsetX + physicsSpacing * Math.sqrt(3) * (q + r / 2),
          y: offsetY + physicsSpacing * 1.5 * r
        };
        
        // Compute 6 corners in physics coordinates
        const corners = Array.from({ length: 6 }, (_, i) => {
          const angle_deg = 60 * i - 30;
          const angle_rad = Math.PI / 180 * angle_deg;
          return {
            x: physicsCenter.x + physicsSpacing * Math.cos(angle_rad),
            y: physicsCenter.y + physicsSpacing * Math.sin(angle_rad),
          };
        });
        
        // Create or reuse nodes at each corner
        const cellNodes: PointMass2D[] = [];
        for (const corner of corners) {
          const key = `${corner.x.toFixed(6)},${corner.y.toFixed(6)}`;
          let node = nodeMap.get(key);
          if (!node) {
            node = PointMass2D.fromParams(corner, defaultParams);
            (node as any).gridIndex = { q, r };
            (node as any)._nodeId = nodes.length;
            nodeMap.set(key, node);
            nodes.push(node);
          }
          cellNodes.push(node);
        }
        
        const cell = new HexCell(cellNodes, physicsCenter, defaultParams, { q, r });
        cells.push(cell);
        
        // Add springs for each edge using O(1) deduplication
        for (let i = 0; i < 6; i++) {
          const a = cellNodes[i];
          const b = cellNodes[(i + 1) % 6];
          const aId = (a as any)._nodeId;
          const bId = (b as any)._nodeId;
          const springKey = aId < bId ? `${aId}-${bId}` : `${bId}-${aId}`;
          
          if (!springSet.has(springKey)) {
            springSet.add(springKey);
            const restLength = Math.sqrt(
              Math.pow(a.position.x - b.position.x, 2) +
              Math.pow(a.position.y - b.position.y, 2)
            );
            springs.push(Spring2D.fromParams(a, b, restLength, defaultParams));
          }
        }
      }
    }
    
    console.info(`[HexGridFactory] Physics grid created: ${cells.length} cells, ${springs.length} springs, ${nodes.length} nodes`);
    console.info(`[HexGridFactory] Sample node position (physics): ${nodes[0]?.position.x.toFixed(3)}, ${nodes[0]?.position.y.toFixed(3)}`);
    
    return new HexSoftBody(nodes, springs, cells);
  }
}
