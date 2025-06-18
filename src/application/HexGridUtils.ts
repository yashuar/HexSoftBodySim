// HexGridUtils: Utility functions for hex grid spacing and sizing

export function computeCellSpacingForGrid(canvasWidth: number, canvasHeight: number, numCols: number, numRows: number, margin: number = 40): number {
  // Pointy-topped hex grid
  // width = numCols * spacing * 0.75 + 0.25 * spacing
  // height = (numRows - 1) * spacing * sqrt(3)/2 + spacing
  const sqrt3 = Math.sqrt(3);
  const usableWidth = canvasWidth - 2 * margin;
  const usableHeight = canvasHeight - 2 * margin;
  const spacingX = usableWidth / (numCols * 0.75 + 0.25);
  const spacingY = usableHeight / ((numRows - 1) * sqrt3 / 2 + 1);
  return Math.min(spacingX, spacingY);
}

export function computeGridDimensionsForSpacing(canvasWidth: number, canvasHeight: number, spacing: number, margin: number = 40): { numCols: number, numRows: number } {
  // Inverse of above: given spacing, compute max cols/rows that fit
  const sqrt3 = Math.sqrt(3);
  const usableWidth = canvasWidth - 2 * margin;
  const usableHeight = canvasHeight - 2 * margin;
  const numCols = Math.floor((usableWidth - 0.25 * spacing) / (0.75 * spacing));
  const numRows = Math.floor(((usableHeight - spacing) / (spacing * sqrt3 / 2)) + 1);
  return { numCols, numRows };
}
