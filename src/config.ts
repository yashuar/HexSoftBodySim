// config.ts: Centralized configuration for PhysicsEngine2D

import { CellParameters } from './domain/CellParameters';

export const SIM_CONFIG: Readonly<{
  defaultParams: CellParameters;
  desiredCellSpacing: number;
  desiredNumCols: number;
  desiredNumRows: number;
  margin: number;
  gravity: { x: number; y: number };
  // Physics parameters - frequency-based (Box2D style)
  springFrequency: number; // Hz - oscillations per second
  dampingRatio: number; // 0.0 = no damping, 1.0 = critical damping
  globalMass: number;
  globalRestLength: number;
  globalInteractionStrength: number;
  // Simulation parameters
  enableMooneyRivlin: boolean;
  maxFps: number;
  enableDebugLogging: boolean;
  // Timestep stability
  maxTimestep: number; // Maximum allowed timestep for stability
  stiffnessTimestepFactor: number; // Factor for timestep-aware stiffness
}> = {
  defaultParams: { mass: 10.0, springFrequency: 8.0, dampingRatio: 0.02 }, // Balanced: good propagation + shape restoration
  desiredCellSpacing: 40,
  desiredNumCols: 20,
  desiredNumRows: 15,
  margin: 40,
  gravity: { x: 0, y: 1 },
  // Physics parameters - EXTREME optimization for force propagation
  springFrequency: 8.0, // Very high frequency = very responsive springs
  dampingRatio: 0.02, // Balanced damping for propagation + shape restoration
  globalMass: 10.0, // VERY high mass for strong forces
  globalRestLength: 1.0,
  globalInteractionStrength: 1.0,
  // Simulation parameters
  enableMooneyRivlin: false,
  maxFps: 60,
  enableDebugLogging: true, // ENABLE for force propagation debugging
  // Timestep stability (less conservative for better force propagation)
  maxTimestep: 1.0 / 30.0, // 30 FPS max for stability
  stiffnessTimestepFactor: 1.0, // Full stiffness (was 0.8 - unnecessarily conservative)
};
