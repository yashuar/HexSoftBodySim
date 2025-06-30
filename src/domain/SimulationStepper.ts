// SimulationStepper.ts
// Modularizes the simulation step logic for PhysicsWorld2D

import { HexSoftBody } from '../domain/HexSoftBody';
import { Gravity2D } from '../domain/forces/Gravity2D';
import { PressureForce2D } from '../domain/forces/PressureForce2D';
import { Integrator2D } from '../domain/Integrator2D';

import { VolumeConstraint2D } from '../domain/constraints/VolumeConstraint2D';
import { GroundConstraint2D } from '../domain/constraints/GroundConstraint2D';
import { UserConstraint2D } from '../domain/constraints/UserConstraint2D';
import { AdaptiveConstraintSolver } from '../domain/constraints/AdaptiveConstraintSolver';
import { SimulationRobustnessManager } from '../domain/constraints/SimulationRobustnessManager';
import { BoundaryStabilizer } from '../domain/constraints/BoundaryStabilizer';
import { MeshStabilizer } from '../domain/constraints/MeshStabilizer';
import { HexagonShapeEnforcer } from '../domain/constraints/HexagonShapeEnforcer';

import { DebugLogger } from '../infrastructure/DebugLogger';
import { ForceCoordinator2D, DEFAULT_FORCE_COORDINATION } from '../infrastructure/ForceCoordinator2D';
import { SIM_CONFIG } from '../config';
import { PointMass2D } from './PointMass2D';

export interface SimulationStepContext {
  bodies: HexSoftBody[];
  gravityForce: Gravity2D;
  pressureForce: PressureForce2D;
  volumeConstraints: VolumeConstraint2D[];
  userConstraints: UserConstraint2D[];
  groundConstraints: GroundConstraint2D[];
  enableGround: boolean;
  iterationBudget: number;
  maxDt: number;
  worldGravity: { x: number; y: number };
  uiController?: { 
    applyInteractionForces: () => { extraVolumeConstraints?: any[] };
    update?: (dt: number) => void;
    applyGlobalRestoreDamping?: () => void;
  };
}

export class SimulationStepper {
  private static forceCoordinator: ForceCoordinator2D | null = null;
  private static constraintSolver: AdaptiveConstraintSolver | null = null;
  private static robustnessManager: SimulationRobustnessManager | null = null;
  private static boundaryStabilizer: BoundaryStabilizer | null = null;
  private static meshStabilizer: MeshStabilizer | null = null;
  private static shapeEnforcer: HexagonShapeEnforcer | null = null;

  // Initialize force coordinator (called once)
  private static getForceCoordinator(): ForceCoordinator2D {
    if (!this.forceCoordinator) {
      const config = {
        ...DEFAULT_FORCE_COORDINATION,
        enableCoordination: SIM_CONFIG.enableForceCoordination,
        materialModelMode: SIM_CONFIG.materialModelMode,
        energyBudgetLimit: SIM_CONFIG.energyBudgetLimit
      };
      this.forceCoordinator = new ForceCoordinator2D(config);
    }
    return this.forceCoordinator;
  }
  
  // Initialize constraint solver (called once) 
  private static getConstraintSolver(): AdaptiveConstraintSolver {
    if (!this.constraintSolver) {
      this.constraintSolver = new AdaptiveConstraintSolver();
    }
    return this.constraintSolver;
  }
  
  // Initialize robustness manager (called once)
  private static getRobustnessManager(): SimulationRobustnessManager {
    if (!this.robustnessManager) {
      this.robustnessManager = new SimulationRobustnessManager();
    }
    return this.robustnessManager;
  }
  
  // Initialize boundary stabilizer (called once)
  private static getBoundaryStabilizer(): BoundaryStabilizer {
    if (!this.boundaryStabilizer) {
      this.boundaryStabilizer = new BoundaryStabilizer();
    }
    return this.boundaryStabilizer;
  }
  
  // Initialize mesh stabilizer (called once)
  private static getMeshStabilizer(): MeshStabilizer {
    if (!this.meshStabilizer) {
      this.meshStabilizer = new MeshStabilizer();
    }
    return this.meshStabilizer;
  }

  // Initialize hexagon shape enforcer (called once)
  private static getShapeEnforcer(): HexagonShapeEnforcer {
    if (!this.shapeEnforcer) {
      this.shapeEnforcer = new HexagonShapeEnforcer();
    }
    return this.shapeEnforcer;
  }

  // Update force coordination configuration at runtime
  static updateForceCoordinationConfig(config: Partial<{
    enableCoordination: boolean;
    materialModelMode: 'springs-primary' | 'mooney-primary' | 'hybrid';
    energyBudgetLimit: number;
  }>): void {
    const forceCoordinator = this.getForceCoordinator();
    forceCoordinator.updateConfig({
      enableCoordination: config.enableCoordination,
      materialModelMode: config.materialModelMode,
      energyBudgetLimit: config.energyBudgetLimit
    });
  }

  static step(ctx: SimulationStepContext, dt: number) {
    const stepStartTime = performance.now();
    dt = Math.min(dt, ctx.maxDt);
    
    // ENHANCED LOGGING: Track simulation step details
    const stepId = Math.random().toString(36).substring(2, 8);
    const initialNodeStates = ctx.bodies.length > 0 ? {
      firstNodePos: { x: ctx.bodies[0].nodes[0].getPositionX(), y: ctx.bodies[0].nodes[0].getPositionY() },
      firstNodeVel: { x: ctx.bodies[0].nodes[0].getVelocityX(), y: ctx.bodies[0].nodes[0].getVelocityY() },
      totalNodes: ctx.bodies.reduce((sum, body) => sum + body.nodes.length, 0),
      totalSprings: ctx.bodies.reduce((sum, body) => sum + body.springs.length, 0)
    } : null;
    
    // Log step start with system state
    if (Math.random() < 0.01) { // 1% sample rate for step logging
      DebugLogger.log('system-event', 'Simulation step started', {
        stepId,
        dt,
        maxDt: ctx.maxDt,
        gravity: ctx.worldGravity,
        initialState: initialNodeStates,
        constraintCounts: {
          volume: ctx.volumeConstraints.length,
          user: ctx.userConstraints.length,
          ground: ctx.groundConstraints.length
        }
      });
    }
    
    // Initialize only the systems we actually use
    const boundaryStabilizer = this.getBoundaryStabilizer();
    
    // SIMPLIFIED SIMULATION STEP - focused on user interaction streamlining
    
    // 1. UPDATE USER INTERACTIONS (new simplified system)
    if (ctx.uiController && typeof ctx.uiController.update === 'function') {
      ctx.uiController.update(dt);
      
      // DEBUG: Track forces after user interaction
      if (ctx.bodies.length > 0 && ctx.bodies[0].nodes.length > 0) {
        this.trackNodeForces(ctx.bodies[0].nodes[0], "AFTER_USER_INTERACTION", stepId);
      }
    }
    
    // 2. FORCE PHASE: Apply core forces only
    for (const body of ctx.bodies) {
      // Apply core physics forces:
      ctx.gravityForce.apply(body.nodes, ctx.worldGravity);
      
      // DEBUG: Track forces after gravity
      if (body.nodes.length > 0) {
        this.trackNodeForces(body.nodes[0], "AFTER_GRAVITY", stepId);
      }
      
      // Apply Mooney-Rivlin forces if enabled (essential biomechanical feature)
      if (SIM_CONFIG.enableMooneyRivlin) {
        body.applyMooneyRivlinForces();
        
        // DEBUG: Track forces after Mooney-Rivlin
        if (body.nodes.length > 0) {
          this.trackNodeForces(body.nodes[0], "AFTER_MOONEY_RIVLIN", stepId);
        }
      }
      
      // Apply spring forces (includes all essential features: non-linear, strain-stiffening)
      body.applySpringForces(dt, 1.0);
      
      // DEBUG: Track forces after springs
      if (body.nodes.length > 0) {
        this.trackNodeForces(body.nodes[0], "AFTER_SPRINGS", stepId);
      }
      
      // Apply pressure forces to cells (essential for volume preservation)
      for (const cell of body.cells) {
        ctx.pressureForce.apply(cell);
      }
      
      // DEBUG: Track forces after pressure
      if (body.nodes.length > 0) {
        this.trackNodeForces(body.nodes[0], "AFTER_PRESSURE", stepId);
      }
    }
    
    // 3. GLOBAL RESTORE DAMPING (helps return to rest state when no interaction)
    if (ctx.uiController && typeof ctx.uiController.applyGlobalRestoreDamping === 'function') {
      ctx.uiController.applyGlobalRestoreDamping();
    }
    
    // 4. INTEGRATION: Update velocities and positions using forces
    for (const body of ctx.bodies) {
      Integrator2D.semiImplicitEuler(body.nodes, dt);
    }
    
    // 5. EXPLOSION DETECTION AND RECOVERY (simplified)
    for (const body of ctx.bodies) {
      const canvasWidth = (window && window.innerWidth) ? window.innerWidth : 1920;
      const canvasHeight = (window && window.innerHeight) ? window.innerHeight : 1080;
      const posMaxVal = 1.2 * Math.max(canvasWidth, canvasHeight);
      const velMaxVal = 200;

      for (const node of body.nodes) {
        const pos = node.position;
        const vel = node.velocity;
        
        // Check for NaN/Inf
        if (!isFinite(pos.x) || !isFinite(pos.y) || !isFinite(vel.x) || !isFinite(vel.y)) {
          console.warn('[SimulationStepper] NaN/Inf detected, resetting node');
          pos.x = isFinite(pos.x) ? pos.x : 0;
          pos.y = isFinite(pos.y) ? pos.y : 0;
          vel.x = 0;
          vel.y = 0;
        }
        
        // Check for explosive values
        if (Math.abs(pos.x) > posMaxVal || Math.abs(pos.y) > posMaxVal) {
          console.warn('[SimulationStepper] Large position detected, clamping');
          pos.x = Math.max(-posMaxVal, Math.min(pos.x, posMaxVal));
          pos.y = Math.max(-posMaxVal, Math.min(pos.y, posMaxVal));
        }
        
        if (Math.abs(vel.x) > velMaxVal || Math.abs(vel.y) > velMaxVal) {
          console.warn('[SimulationStepper] Large velocity detected, clamping');
          vel.x = Math.max(-velMaxVal, Math.min(vel.x, velMaxVal));
          vel.y = Math.max(-velMaxVal, Math.min(vel.y, velMaxVal));
        }
      }
    }
    
    // 6. CONSTRAINT PHASE: Apply position-based constraints
    for (let iter = 0; iter < ctx.iterationBudget; iter++) {
      // Apply volume constraints for shape preservation
      for (const vConstraint of ctx.volumeConstraints) {
        vConstraint.apply();
      }
    }
    
    // 7. ENVIRONMENT CONSTRAINTS: Ground, etc.
    if (ctx.enableGround) {
      for (const gConstraint of ctx.groundConstraints) {
        gConstraint.apply();
      }
    }
  }

  // Enhanced force tracking for debugging
  static trackNodeForces(node: PointMass2D, phase: string, stepId: string): void {
    if (!SIM_CONFIG.enableDebugLogging) return;
    if (Math.random() > 0.8) return; // 20% sample rate for better debugging
    
    const nodeId = (node as any)._nodeId || (node as any)._id || 'unknown';
    const currentForce = {
      x: (node as any)._force?.x || 0,
      y: (node as any)._force?.y || 0
    };
    const forceMagnitude = Math.sqrt(currentForce.x * currentForce.x + currentForce.y * currentForce.y);
    
    DebugLogger.log('system-event', `Force state: ${phase}`, {
      stepId,
      phase,
      nodeId,
      nodePosition: { x: node.getPositionX(), y: node.getPositionY() },
      nodeVelocity: { x: node.getVelocityX(), y: node.getVelocityY() },
      accumulatedForce: currentForce,
      forceMagnitude: forceMagnitude,
      timestamp: Date.now()
    });
  }

  // Track last log time for user constraint logging
  private static _lastUserConstraintLogTime: number = 0;

  // Public method to access mesh stabilizer for debugging
  static getPublicMeshStabilizer(): MeshStabilizer {
    return this.getMeshStabilizer();
  }

  // Public method to access shape enforcer for debugging
  static getPublicShapeEnforcer(): HexagonShapeEnforcer {
    return this.getShapeEnforcer();
  }
}
