// config.ts: Centralized configuration for PhysicsEngine2D

import { CellParameters } from './domain/CellParameters';

export const SIM_CONFIG: Readonly<{
  defaultParams: CellParameters;
  desiredCellSpacing: number;
  desiredNumCols: number;
  desiredNumRows: number;
  margin: number;
  gravity: { x: number; y: number };
  globalDampingRatio: number;
  globalStiffness: number;
  globalMass: number;
  globalRestLength: number;
  globalInteractionStrength: number;
  enableMooneyRivlin: boolean;
  maxFps: number;
  // Add more toggles as needed
}> = {
  defaultParams: { mass: 0.01, stiffness: 0.01, damping: 0.01 },
  desiredCellSpacing: 40,
  desiredNumCols: 20,
  desiredNumRows: 15,
  margin: 40,
  gravity: { x: 0, y: 1 },
  globalDampingRatio: 0.5,
  globalStiffness: 0.01,
  globalMass: 0.01,
  globalRestLength: 1.0,
  globalInteractionStrength: 1.0,
  enableMooneyRivlin: false,
  maxFps: 60,
};
