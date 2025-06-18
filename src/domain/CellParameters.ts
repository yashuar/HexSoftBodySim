// CellParameters.ts
// Central type for all cell parameter bags in the simulation

export interface CellParameters {
  mass: number;
  stiffness: number;
  damping: number;
}
