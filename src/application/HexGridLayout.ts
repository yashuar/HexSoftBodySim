// HexGridLayout.ts
// Utility for grid dimension, spacing, and centering logic

export interface GridLayout {
  numCols: number;
  numRows: number;
  spacing: number;
  offsetX: number;
  offsetY: number;
}

export function computeHexGridLayout(canvasWidth: number, canvasHeight: number, desiredCellSpacing: number, margin: number = 0): GridLayout {
  const sqrt3 = Math.sqrt(3);
  const usableWidth = canvasWidth - 2 * margin;
  const usableHeight = canvasHeight - 2 * margin;
  // Estimate grid size
  let numCols = Math.floor((usableWidth - desiredCellSpacing * 0.25) / (desiredCellSpacing * 0.75));
  let numRows = Math.floor((usableHeight - desiredCellSpacing) / (desiredCellSpacing * sqrt3 / 2)) + 1;
  // Recompute spacing to fit exactly
  const spacingX = usableWidth / (numCols * 0.75 + 0.25);
  const spacingY = usableHeight / ((numRows - 1) * sqrt3 / 2 + 1);
  const spacing = Math.min(spacingX, spacingY);
  // Centering offsets
  const gridWidth = spacing * (numCols * 0.75 + 0.25);
  const gridHeight = spacing * ((numRows - 1) * sqrt3 / 2 + 1);
  const offsetX = margin + (usableWidth - gridWidth) / 2;
  const offsetY = margin + (usableHeight - gridHeight) / 2;
  return { numCols, numRows, spacing, offsetX, offsetY };
}
