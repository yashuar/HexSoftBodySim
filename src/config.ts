// config.ts: Centralized configuration for PhysicsEngine2D

import { CellParameters } from './domain/CellParameters';

// Parameter schema for auto-generated UI controls
export type ParameterType = 'slider' | 'toggle' | 'vector2' | 'select';

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
  options?: { value: string; label: string }[]; // For select type
  advanced?: boolean; // If true, only show in Advanced mode
}

export interface ParameterSchema {
  [key: string]: ParameterMeta;
}

// Parameter schema definition for UI auto-generation
export const PARAMETER_SCHEMA: ParameterSchema = {
  globalPressure: {
    type: 'slider',
    label: 'Global Pressure',
    description: 'Internal pressure applied to each cell (Pa)',
    min: 0,
    max: 100,
    step: 0.1,
    unit: 'Pa',
    group: 'Physics',
    icon: 'compress'
  },
  enableGround: {
    type: 'toggle',
    label: 'Enable Ground',
    description: 'Enable or disable ground constraint',
    group: 'Physics',
    icon: 'horizontal_rule'
  },
  // Physics group - Core physics parameters
  springFrequency: {
    type: 'slider',
    label: 'Spring Frequency',
    description: 'Spring oscillation frequency in Hz (higher = stiffer springs)',
    min: 0.1,
    max: 15,
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
    max: 0.5,
    step: 0.001,
    group: 'Physics',
    icon: 'waves',
    advanced: true
  },
  globalMass: {
    type: 'slider',
    label: 'Mass',
    description: 'Mass of each point in the simulation',
    min: 0.001,
    max: 0.2,
    step: 0.001,
    unit: 'kg',
    group: 'Physics',
    icon: 'fitness_center'
  },
  globalRestLength: {
    type: 'slider',
    label: 'Rest Length',
    description: 'Natural length of springs between points',
    min: 0.5,
    max: 1.5,
    step: 0.01,
    unit: 'm',
    group: 'Physics',
    icon: 'straighten',
    advanced: true
  },
  globalInteractionStrength: {
    type: 'slider',
    label: 'Interaction Strength',
    description: 'Strength of inter-cell forces',
    min: 0,
    max: 2,
    step: 0.01,
    group: 'Physics',
    icon: 'link'
  },
  // NEW: Force realism scaling
  forceRealismScale: {
    type: 'slider',
    label: 'Force Realism Scale',
    description: 'Scale interaction forces: 0.1=light touch, 1.0=current, 2.0=strong manipulation',
    min: 0.1,
    max: 5.0,
    step: 0.1,
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
    icon: 'waves',
    advanced: true
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
  // Force Coordination System
  enableForceCoordination: {
    type: 'toggle',
    label: 'Force Coordination',
    description: 'Enable intelligent coordination between force systems',
    group: 'Physics',
    icon: 'settings'
  },
  materialModelMode: {
    type: 'select',
    label: 'Material Model Mode',
    description: 'Balance between spring and Mooney-Rivlin forces',
    options: [
      { value: 'springs-primary', label: 'Springs Primary' },
      { value: 'hybrid', label: 'Hybrid (Balanced)' },
      { value: 'mooney-primary', label: 'Mooney-Rivlin Primary' }
    ],
    group: 'Physics',
    icon: 'science'
  },
  energyBudgetLimit: {
    type: 'slider',
    label: 'Energy Budget Limit',
    description: 'Maximum system energy before stability intervention',
    min: 100,
    max: 5000,
    step: 100,
    unit: 'J',
    group: 'Physics',
    icon: 'battery_full'
  },
};

export const SIM_CONFIG: Readonly<{
  globalPressure: number;
  enableGround: boolean;
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
  // Force coordination system
  enableForceCoordination: boolean;
  materialModelMode: 'springs-primary' | 'hybrid' | 'mooney-primary';
  energyBudgetLimit: number;
  maxFps: number;
  enableDebugLogging: boolean;
  // Timestep stability
  maxTimestep: number; // Maximum allowed timestep for stability
  stiffnessTimestepFactor: number; // Factor for timestep-aware stiffness
}> = {
  // HUMAN ADIPOSE TISSUE PARAMETERS - Based on scientific research
  // Research source: Samani et al. - Young's modulus: 3.250 ± 0.910 kPa
  // Density: 900 kg/m³ (fatty tissue), Poisson's ratio: 0.49
  // Grid discretization: 20×15 = 300 points for physics simulation (not biological cells)
  // Total tissue volume represented, divided by grid points for mass per node
  defaultParams: { 
    mass: 0.0033, // kg - mass per grid node for ~900 kg/m³ density (assuming 1mm thickness)
    springFrequency: 8.0, // Hz - increased for stronger spring restoration
    dampingRatio: 0.05 // Low damping for force propagation (Poisson's ratio affects bulk behavior, not wave damping)
  }, 
  desiredCellSpacing: 40,
  desiredNumCols: 20,
  desiredNumRows: 15,
  margin: 40,
  gravity: { x: 0, y: 0 }, // Gravity disabled by default
  globalPressure: 1.75, // Default pressure for soft tissue
  enableGround: false, // Ground constraint disabled by default
  // BIOMECHANICALLY ACCURATE FAT TISSUE PHYSICS
  springFrequency: 8.0, // Hz - increased for stronger spring restoration
  dampingRatio: 0.05, // Much lower damping for force propagation (was 0.49 - too high!)
  globalMass: 0.06, // kg - mass per discretization node (tunable for simulation stability)
  globalRestLength: 1.0, // Placeholder - actual rest lengths calculated from geometry
  globalInteractionStrength: 1.0, // REMOVED - no longer needed with direct physics
  // REMOVED ALL SCALING COMPLEXITY
  forceRealismScale: 3.0, // Increased for much stronger user interaction
  // Simulation parameters - adjusted for fat tissue at new scale
  enableMooneyRivlin: true, // Keep for realistic soft-body physics
  mooneyDamping: 0.2, // Higher damping for new scale
  mooneyMaxForce: 8.0, // Much lower force limits for new scale (was 30.0)
  // Force coordination system (DISABLED for simplified physics)
  enableForceCoordination: false,
  materialModelMode: 'springs-primary' as const,
  energyBudgetLimit: 200, // Lower energy budget for new scale
  maxFps: 60,
  enableDebugLogging: true, // Keep enabled for debugging
  // Timestep stability - optimized for higher frequencies
  maxTimestep: 1.0 / 120.0, // Higher frequency simulation (120 FPS) for stability
  stiffnessTimestepFactor: 1.0, // Full stiffness for proper force transmission
};
