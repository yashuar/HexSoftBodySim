// ForceCoordinator2D: Unified coordination system for all force-generating systems
// Ensures force systems work in harmony while preserving modular architecture
// Integrates with existing Spring2D, Mooney-Rivlin, user interaction, and state management

import { HexSoftBody } from '../domain/HexSoftBody';
import { SIM_CONFIG } from '../config';
import { DebugLogger } from './DebugLogger';

export interface ForceCoordinationConfig {
  enableCoordination: boolean;
  materialModelMode: 'springs-primary' | 'mooney-primary' | 'hybrid';
  energyBudgetLimit: number;
  adaptiveDamping: boolean;
  boundaryStabilization: boolean;
  oscillationDamping: number; // Additional damping for oscillation prevention
  forceSystemWeights: {
    springs: number;
    mooneyRivlin: number;
    userInteraction: number;
    gravity: number;
    pressure: number;
  };
}

export interface ForceAnalysis {
  springForceRange: { min: number; max: number; typical: number };
  mooneyForceRange: { min: number; max: number; typical: number };
  userForceRange: { min: number; max: number; typical: number };
  totalSystemEnergy: number;
  recommendedScaling: {
    mooneyScale: number;
    dampingAdjustment: number;
    energyDissipationNeeded: boolean;
  };
}

export class ForceCoordinator2D {
  private config: ForceCoordinationConfig;
  private lastAnalysis: ForceAnalysis | null = null;
  private energyHistory: number[] = [];
  private velocityHistory: Map<any, number[]> = new Map(); // Track velocity history per node
  private maxHistoryLength = 60; // 1 second at 60fps
  private oscillationDetectionLength = 20; // Check last 20 frames for oscillation pattern

  constructor(config: ForceCoordinationConfig) {
    this.config = config;
  }

  // Main coordination entry point - called before force application
  coordinateForces(body: HexSoftBody, dt: number): {
    mooneyScale: number;
    dampingAdjustment: number;
    boundaryDampingScale: number;
    energyLimitReached: boolean;
  } {
    // Debug: Log that coordination is being called
    if (Date.now() % 2000 < 50) { // Every ~2 seconds
      DebugLogger.log('force-coordination', '[ForceCoordinator2D] coordinateForces called', {
        enableCoordination: this.config.enableCoordination,
        boundaryStabilization: this.config.boundaryStabilization,
        oscillationDamping: this.config.oscillationDamping
      });
    }

    if (!this.config.enableCoordination) {
      return { 
        mooneyScale: 1.0, 
        dampingAdjustment: 1.0, 
        boundaryDampingScale: 1.0,
        energyLimitReached: false 
      };
    }

    // Analyze current force state
    const analysis = this.analyzeCurrentForces(body);
    this.lastAnalysis = analysis;

    // Calculate coordinated scaling
    const coordination = this.calculateCoordination(analysis, dt);

    // Apply boundary stabilization if enabled
    let boundaryDampingScale = 1.0;
    if (this.config.boundaryStabilization) {
      boundaryDampingScale = this.calculateBoundaryDamping(body, analysis);
    }

    // Log coordination decisions
    if (SIM_CONFIG.enableDebugLogging && Date.now() % 2000 < 50) { // Every ~2 seconds
      DebugLogger.log('force-coordination', 'Force coordination applied', {
        materialMode: this.config.materialModelMode,
        mooneyScale: coordination.mooneyScale,
        dampingAdjustment: coordination.dampingAdjustment,
        boundaryDampingScale,
        systemEnergy: analysis.totalSystemEnergy,
        energyBudgetUsed: (analysis.totalSystemEnergy / this.config.energyBudgetLimit * 100).toFixed(1) + '%'
      });
    }

    return {
      ...coordination,
      boundaryDampingScale
    };
  }

  // Analyze current force magnitudes across all systems
  private analyzeCurrentForces(body: HexSoftBody): ForceAnalysis {
    let springForces: number[] = [];
    let totalSystemEnergy = 0;

    // Analyze spring forces
    for (const spring of body.springs) {
      const dx = spring.b.position.x - spring.a.position.x;
      const dy = spring.b.position.y - spring.a.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1e-8;
      const displacement = Math.abs(dist - spring.restLength);
      const forceMag = spring.stiffness * displacement;
      springForces.push(forceMag);
    }

    // Calculate system energy (kinetic + potential)
    for (const node of body.nodes) {
      const kineticEnergy = 0.5 * node.mass * (node.velocity.x * node.velocity.x + node.velocity.y * node.velocity.y);
      totalSystemEnergy += kineticEnergy;
    }

    // Track energy history for trend analysis
    this.energyHistory.push(totalSystemEnergy);
    if (this.energyHistory.length > this.maxHistoryLength) {
      this.energyHistory.shift();
    }

    // Calculate ranges
    const springMin = Math.min(...springForces, 0);
    const springMax = Math.max(...springForces, 0);
    const springTypical = springForces.length > 0 ? springForces.reduce((a, b) => a + b, 0) / springForces.length : 0;

    // Estimate Mooney-Rivlin force range based on current spring state
    const mooneyTypical = springTypical * 0.8; // Typically slightly less than springs
    const mooneyMin = springMin * 0.5;
    const mooneyMax = springMax * 1.2;

    // Estimate user force range (from config and force realism scale)
    const userTypical = 150 * SIM_CONFIG.forceRealismScale; // Base user force
    const userMin = 10 * SIM_CONFIG.forceRealismScale;
    const userMax = 500 * SIM_CONFIG.forceRealismScale;

    return {
      springForceRange: { min: springMin, max: springMax, typical: springTypical },
      mooneyForceRange: { min: mooneyMin, max: mooneyMax, typical: mooneyTypical },
      userForceRange: { min: userMin, max: userMax, typical: userTypical },
      totalSystemEnergy,
      recommendedScaling: this.calculateRecommendedScaling(springTypical, mooneyTypical, totalSystemEnergy)
    };
  }

  // Calculate recommended force scaling for optimal coordination
  private calculateRecommendedScaling(springTypical: number, mooneyTypical: number, systemEnergy: number) {
    // Scale Mooney-Rivlin to match spring force magnitude
    let mooneyScale = 1.0;
    if (mooneyTypical > 0 && springTypical > 0) {
      // Target Mooney-Rivlin to be 60-80% of spring forces for good coordination
      const targetRatio = this.getMooneyTargetRatio();
      mooneyScale = (springTypical * targetRatio) / mooneyTypical;
      mooneyScale = Math.max(0.1, Math.min(mooneyScale, 3.0)); // Reasonable bounds
    }

    // Calculate damping adjustment based on energy state
    let dampingAdjustment = 1.0;
    if (this.config.adaptiveDamping) {
      const energyRatio = systemEnergy / this.config.energyBudgetLimit;
      if (energyRatio > 0.8) {
        // High energy - increase damping
        dampingAdjustment = 1.0 + (energyRatio - 0.8) * 2.0; // Up to 2.4x damping
      } else if (energyRatio < 0.3) {
        // Low energy - allow less damping for responsiveness
        dampingAdjustment = 0.8 + energyRatio * 0.67; // Down to 0.8x damping
      }
    }

    const energyDissipationNeeded = systemEnergy > this.config.energyBudgetLimit * 0.7;

    return { mooneyScale, dampingAdjustment, energyDissipationNeeded };
  }

  // Get target Mooney-Rivlin to spring force ratio based on material model mode
  private getMooneyTargetRatio(): number {
    switch (this.config.materialModelMode) {
      case 'springs-primary':
        return 0.4; // Mooney-Rivlin as 40% supplement to springs
      case 'mooney-primary':
        return 1.2; // Mooney-Rivlin as 120% of springs (dominant)
      case 'hybrid':
        return 0.7; // Mooney-Rivlin as 70% of springs (balanced)
      default:
        return 0.6;
    }
  }

  // Calculate final coordination parameters
  private calculateCoordination(analysis: ForceAnalysis, dt: number): {
    mooneyScale: number;
    dampingAdjustment: number;
    energyLimitReached: boolean;
  } {
    const { mooneyScale, dampingAdjustment, energyDissipationNeeded } = analysis.recommendedScaling;

    // Apply force system weights from configuration
    const weightedMooneyScale = mooneyScale * this.config.forceSystemWeights.mooneyRivlin;
    const weightedDampingAdjustment = dampingAdjustment;

    // Check energy limit
    const energyLimitReached = analysis.totalSystemEnergy > this.config.energyBudgetLimit;

    // Additional safety scaling if energy limit exceeded
    let finalMooneyScale = weightedMooneyScale;
    let finalDampingAdjustment = weightedDampingAdjustment;

    if (energyLimitReached) {
      // Reduce non-essential forces and increase damping
      finalMooneyScale *= 0.5; // Reduce Mooney-Rivlin contribution
      finalDampingAdjustment *= 1.5; // Increase damping
      
      if (SIM_CONFIG.enableDebugLogging) {
        DebugLogger.log('force-coordination', 'Energy limit exceeded - applying safety scaling', {
          originalMooneyScale: weightedMooneyScale,
          reducedMooneyScale: finalMooneyScale,
          dampingIncrease: finalDampingAdjustment
        });
      }
    }

    return {
      mooneyScale: finalMooneyScale,
      dampingAdjustment: finalDampingAdjustment,
      energyLimitReached
    };
  }

  // Calculate boundary-specific damping to prevent oscillations
  // Based on Box2D's constraint stabilization approach with improved oscillation detection
  private calculateBoundaryDamping(body: HexSoftBody, analysis: ForceAnalysis): number {
    const boundaryNodes = this.identifyBoundaryNodes(body);
    let totalOscillationScore = 0;
    let nodesWithOscillation = 0;
    let maxOscillationScore = 0;

    // Advanced oscillation detection: look for velocity patterns and ramping
    for (const node of boundaryNodes) {
      const velocityMagnitude = Math.sqrt(node.velocity.x * node.velocity.x + node.velocity.y * node.velocity.y);
      
      // Track velocity history for this node
      if (!this.velocityHistory.has(node)) {
        this.velocityHistory.set(node, []);
      }
      const nodeHistory = this.velocityHistory.get(node)!;
      nodeHistory.push(velocityMagnitude);
      
      // Keep only recent history
      if (nodeHistory.length > this.oscillationDetectionLength) {
        nodeHistory.shift();
      }

      // Analyze oscillation patterns (reduced sensitivity)
      const oscillationScore = this.analyzeOscillationPattern(nodeHistory, velocityMagnitude);
      if (oscillationScore > 0.3) { // Increased threshold from 0.1 to 0.3
        totalOscillationScore += oscillationScore;
        nodesWithOscillation++;
        maxOscillationScore = Math.max(maxOscillationScore, oscillationScore);
      }
    }

    // Calculate adaptive damping - start low, ramp up more gently for oscillations
    let dampingScale = 1.0; // Start with no additional damping
    
    if (nodesWithOscillation > 0) {
      const avgOscillationScore = totalOscillationScore / nodesWithOscillation;
      const oscillationSeverity = Math.min(maxOscillationScore, 2.0); // Reduced cap from 3.0 to 2.0
      
      // Gentler progressive damping to reduce over-correction
      if (oscillationSeverity > 1.5) {
        // Severe oscillation - moderate damping (reduced from emergency level)
        dampingScale = 1.0 + this.config.oscillationDamping + oscillationSeverity * 0.4; // Reduced from 1.2
      } else if (oscillationSeverity > 1.0) {
        // Moderate oscillation - light damping (reduced)
        dampingScale = 1.0 + this.config.oscillationDamping + oscillationSeverity * 0.2; // Reduced from 0.6
      } else if (oscillationSeverity > 0.5) { // Increased threshold from 0.3
        // Minor oscillation - very light damping
        dampingScale = 1.0 + this.config.oscillationDamping * 0.3 + oscillationSeverity * 0.1; // Reduced
      } else {
        // Very minor - minimal damping
        dampingScale = 1.0 + this.config.oscillationDamping * 0.1; // Reduced from 0.2
      }
      
      DebugLogger.log('force-coordination', '[ForceCoordinator2D] OSCILLATION DETECTED - applying stabilization', {
        boundaryNodeCount: boundaryNodes.length,
        nodesWithOscillation,
        avgOscillationScore: avgOscillationScore.toFixed(3),
        maxOscillationScore: maxOscillationScore.toFixed(3),
        oscillationSeverity: oscillationSeverity.toFixed(3),
        dampingScale: dampingScale.toFixed(3)
      });
    } else {
      // No oscillation detected - reduce damping for better responsiveness
      dampingScale = 1.0 + this.config.oscillationDamping * 0.1; // Only 10% of base damping
    }

    // Debug: Log boundary damping calculation less frequently
    if (Date.now() % 2000 < 50) { // Every ~2 seconds
      DebugLogger.log('force-coordination', '[ForceCoordinator2D] Boundary damping calculation', {
        boundaryNodeCount: boundaryNodes.length,
        nodesWithOscillation,
        totalOscillationScore: totalOscillationScore.toFixed(3),
        dampingScale: dampingScale.toFixed(3)
      });
    }

    // Cap damping to prevent over-stabilization but allow higher values for emergencies
    return Math.min(dampingScale, 4.0); // Allow very high damping for severe oscillations
  }

  // Analyze velocity history to detect oscillation patterns
  private analyzeOscillationPattern(velocityHistory: number[], currentVelocity: number): number {
    if (velocityHistory.length < 10) return 0; // Need enough history

    // Check for increasing velocity trend (ramping oscillation)
    const recent = velocityHistory.slice(-10);
    const older = velocityHistory.slice(-20, -10);
    
    if (older.length === 0) return 0;

    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
    
    // Score based on multiple factors:
    let score = 0;

    // 1. Velocity magnitude (immediate danger)
    if (currentVelocity > 5) {
      score += Math.min(currentVelocity / 10, 1.0); // Up to 1.0 for high velocity
    }

    // 2. Increasing velocity trend (ramping oscillation)
    if (recentAvg > olderAvg && olderAvg > 0) {
      const trend = (recentAvg - olderAvg) / olderAvg;
      score += Math.min(trend * 2, 1.0); // Up to 1.0 for strong upward trend
    }

    // 3. Velocity variance (oscillation pattern)
    if (recent.length >= 5) {
      const variance = this.calculateVariance(recent);
      if (variance > 10) { // High variance indicates oscillation
        score += Math.min(variance / 50, 0.5); // Up to 0.5 for high variance
      }
    }

    return score;
  }

  // Calculate variance of an array
  private calculateVariance(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  }

  // Identify boundary nodes for special treatment
  private identifyBoundaryNodes(body: HexSoftBody): any[] {
    const boundaryNodes: any[] = [];
    
    // A node is considered boundary if it has fewer springs than interior nodes
    const avgSpringCount = body.springs.length * 2 / body.nodes.length; // Each spring connects 2 nodes
    
    for (const node of body.nodes) {
      let springCount = 0;
      for (const spring of body.springs) {
        if (spring.a === node || spring.b === node) {
          springCount++;
        }
      }
      
      // Boundary nodes typically have fewer connections
      if (springCount < avgSpringCount * 0.8) {
        boundaryNodes.push(node);
      }
    }
    
    return boundaryNodes;
  }

  // Update configuration (for runtime parameter changes)
  updateConfig(newConfig: Partial<ForceCoordinationConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  // Get current analysis for debugging/monitoring
  getCurrentAnalysis(): ForceAnalysis | null {
    return this.lastAnalysis;
  }

  // Check if system is stable (for UI feedback)
  isSystemStable(): boolean {
    if (!this.lastAnalysis) return true;
    
    const energyRatio = this.lastAnalysis.totalSystemEnergy / this.config.energyBudgetLimit;
    const energyTrend = this.getEnergyTrend();
    
    return energyRatio < 0.8 && energyTrend <= 0.1; // Stable if energy is low and not increasing rapidly
  }

  // Calculate energy trend (for predictive stability)
  private getEnergyTrend(): number {
    if (this.energyHistory.length < 10) return 0;
    
    const recent = this.energyHistory.slice(-10);
    const older = this.energyHistory.slice(-20, -10);
    
    if (older.length === 0) return 0;
    
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
    
    return (recentAvg - olderAvg) / Math.max(olderAvg, 1); // Relative change
  }
}

// Default coordination configuration
export const DEFAULT_FORCE_COORDINATION: ForceCoordinationConfig = {
  enableCoordination: true,
  materialModelMode: 'hybrid',
  energyBudgetLimit: 1000, // Reasonable energy limit for stability
  adaptiveDamping: true,
  boundaryStabilization: true,
  oscillationDamping: 0.3, // 30% base additional damping - balanced approach
  forceSystemWeights: {
    springs: 1.0,           // Primary physics system
    mooneyRivlin: 0.7,      // Biological enhancement
    userInteraction: 1.0,   // Preserve user control
    gravity: 1.0,           // Environmental forces
    pressure: 1.0           // Internal forces
  }
};
