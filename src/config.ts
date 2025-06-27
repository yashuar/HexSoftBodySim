// config.ts: Centralized configuration for PhysicsEngine2D

import { CellParameters } from './domain/CellParameters';

// Parameter schema for auto-generated UI controls
export type ParameterType = 'slider' | 'toggle' | 'vector2';

export interface ParameterMeta {
  type: ParameterType;
  label: string;
  description: string;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  group: string;
  icon?: string;
}

export interface ParameterSchema {
  [key: string]: ParameterMeta;
}

// Parameter schema definition for UI auto-generation
export const PARAMETER_SCHEMA: ParameterSchema = {
  // Physics group - Core physics parameters
  springFrequency: {
    type: 'slider',
    label: 'Spring Frequency',
    description: 'Spring oscillation frequency in Hz (higher = stiffer springs)',
    min: 0.1,
    max: 20,
    step: 0.1,
    unit: 'Hz',
    group: 'Physics',
    icon: 'vibration'
  },
  dampingRatio: {
    type: 'slider',
    label: 'Damping Ratio',
    description: 'Controls how quickly motion is damped (0 = none, 1 = critical, 2 = overdamped)',
    min: 0,
    max: 2,
    step: 0.001,
    group: 'Physics',
    icon: 'waves'
  },
  globalMass: {
    type: 'slider',
    label: 'Mass',
    description: 'Mass of each point in the simulation',
    min: 0.001,
    max: 50,
    step: 0.001,
    unit: 'kg',
    group: 'Physics',
    icon: 'fitness_center'
  },
  globalRestLength: {
    type: 'slider',
    label: 'Rest Length',
    description: 'Natural length of springs between points',
    min: 0.1,
    max: 2,
    step: 0.01,
    unit: 'm',
    group: 'Physics',
    icon: 'straighten'
  },
  globalInteractionStrength: {
    type: 'slider',
    label: 'Interaction Strength',
    description: 'Strength of inter-cell forces',
    min: 0,
    max: 10,
    step: 0.01,
    group: 'Physics',
    icon: 'link'
  },
  // NEW: Force realism scaling
  forceRealismScale: {
    type: 'slider',
    label: 'Force Realism Scale',
    description: 'Scale interaction forces: 0.1=light touch, 1.0=current, 2.0=strong manipulation',
    min: 0.05,
    max: 3.0,
    step: 0.05,
    unit: 'x',
    group: 'Physics',
    icon: 'touch_app'
  },
  enableMooneyRivlin: {
    type: 'toggle',
    label: 'Mooney-Rivlin Material',
    description: 'Use Mooney-Rivlin material model for soft bodies',
    group: 'Physics',
    icon: 'texture'
  },
  gravity: {
    type: 'vector2',
    label: 'Gravity',
    description: 'Gravitational acceleration vector',
    min: -10,
    max: 10,
    step: 0.1,
    unit: 'm/s²',
    group: 'Physics',
    icon: 'arrow_downward'
  },
  
  // Scene group - Grid and visual setup
  desiredCellSpacing: {
    type: 'slider',
    label: 'Cell Spacing',
    description: 'Distance between grid cells',
    min: 1,
    max: 200,
    step: 1,
    unit: 'px',
    group: 'Scene',
    icon: 'grid_on'
  },
  desiredNumCols: {
    type: 'slider',
    label: 'Columns',
    description: 'Number of columns in the grid',
    min: 1,
    max: 100,
    step: 1,
    group: 'Scene',
    icon: 'view_column'
  },
  desiredNumRows: {
    type: 'slider',
    label: 'Rows',
    description: 'Number of rows in the grid',
    min: 1,
    max: 100,
    step: 1,
    group: 'Scene',
    icon: 'view_agenda'
  },
  margin: {
    type: 'slider',
    label: 'Margin',
    description: 'Margin around the grid',
    min: 0,
    max: 200,
    step: 1,
    unit: 'px',
    group: 'Scene',
    icon: 'crop_free'
  },
  speed: {
    type: 'slider',
    label: 'Speed',
    description: 'Simulation speed multiplier (1 = normal, <1 = slow motion, >1 = fast)',
    min: 0.1,
    max: 4,
    step: 0.01,
    unit: 'x',
    group: 'Scene',
    icon: 'speed'
  },
  maxFps: {
    type: 'slider',
    label: 'Max FPS',
    description: 'Maximum frames per second for simulation and rendering',
    min: 10,
    max: 120,
    step: 1,
    unit: 'fps',
    group: 'Scene',
    icon: 'slow_motion_video'
  },
  mooneyDamping: {
    type: 'slider',
    label: 'Mooney-Rivlin Damping',
    description: 'Viscous damping for Mooney-Rivlin material (biological realism)',
    min: 0.0,
    max: 1.0,
    step: 0.01,
    unit: '',
    group: 'Physics',
    icon: 'waves'
  },
  mooneyMaxForce: {
    type: 'slider',
    label: 'Mooney-Rivlin Max Force',
    description: 'Maximum force per node to prevent instability',
    min: 10,
    max: 200,
    step: 5,
    unit: 'N',
    group: 'Physics',
    icon: 'security'
  },
};

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
  // Force realism scaling
  forceRealismScale: number; // 1.0 = current forces, 0.1 = light touch, 2.0 = strong manipulation
  // Simulation parameters
  enableMooneyRivlin: boolean;
  mooneyDamping: number; // Viscous damping for Mooney-Rivlin material
  mooneyMaxForce: number; // Maximum force per node to prevent instability
  maxFps: number;
  enableDebugLogging: boolean;
  // Timestep stability
  maxTimestep: number; // Maximum allowed timestep for stability
  stiffnessTimestepFactor: number; // Factor for timestep-aware stiffness
}> = {
  defaultParams: { mass: 1.0, springFrequency: 2.0, dampingRatio: 0.1 }, // Gentle: stable simulation
  desiredCellSpacing: 40,
  desiredNumCols: 20,
  desiredNumRows: 15,
  margin: 40,
  gravity: { x: 0, y: 1 },
  // Physics parameters - GENTLE settings for stability
  springFrequency: 2.0, // Moderate frequency = stable springs
  dampingRatio: 0.1, // Moderate damping for stability
  globalMass: 1.0, // Normal mass for reasonable forces
  globalRestLength: 1.0,
  globalInteractionStrength: 1.0,
  // NEW: Force realism scaling
  forceRealismScale: 1.0, // 1.0 = current forces, 0.1 = light touch, 2.0 = strong manipulation
  // Simulation parameters
  enableMooneyRivlin: false,
  mooneyDamping: 0.15, // Moderate damping for biological realism
  mooneyMaxForce: 50.0, // Reasonable force limit for stability
  maxFps: 60,
  enableDebugLogging: true, // ENABLE for force propagation debugging
  // Timestep stability (less conservative for better force propagation)
  maxTimestep: 1.0 / 30.0, // 30 FPS max for stability
  stiffnessTimestepFactor: 1.0, // Full stiffness (was 0.8 - unnecessarily conservative)
};
