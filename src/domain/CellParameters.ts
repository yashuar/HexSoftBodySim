// CellParameters.ts
// Central type for all cell parameter bags in the simulation
// Updated to use Box2D-style frequency-based springs for better intuitive control

export interface CellParameters {
  mass: number;
  // Frequency-based spring parameters (Box2D approach)
  springFrequency: number; // Hz - oscillations per second (more intuitive than raw stiffness)
  dampingRatio: number; // 0.0 = no damping, 1.0 = critical damping (standardized)
}
