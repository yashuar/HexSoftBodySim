// DirectInteractionConfig.ts
// CLEAN INTERACTION CONFIGURATION - NO SCALING COMPLEXITY

export const DIRECT_INTERACTION_CONFIG = {
  // SIMPLE PHYSICS PARAMETERS - NO COORDINATE SCALING
  // These values work directly in physics space (20 units wide world)
  
  // User interaction spring parameters - REALISTIC FOR 0.06kg MASS
  dragStiffness: 50.0,     // N/m - reasonable spring stiffness for 60g mass
  dragDamping: 5.0,        // N⋅s/m - appropriate damping
  maxInteractionForce: 5.0, // N - reasonable force limit for tissue manipulation
  
  // Node selection parameters  
  selectionRadius: 0.5,    // physics units - how close cursor must be to select node
  
  // Visual feedback parameters
  highlightRadius: 0.6,    // physics units - size of selection highlight
  forceVisualizationScale: 0.01, // scale factor for force vector visualization
  
  // Performance parameters
  debugLogging: true,      // enable detailed force logging
  maxUpdatesPerFrame: 100, // prevent runaway updates
} as const;

// Type for the config
export type DirectInteractionConfigType = typeof DIRECT_INTERACTION_CONFIG;
