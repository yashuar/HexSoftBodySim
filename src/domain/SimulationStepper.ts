// SimulationStepper.ts
// Modularizes the simulation step logic for PhysicsWorld2D

import { HexSoftBody } from '../domain/HexSoftBody';
import { Gravity2D } from '../domain/forces/Gravity2D';
import { PressureForce2D } from '../domain/forces/PressureForce2D';
import { Integrator2D } from '../domain/Integrator2D';

import { VolumeConstraint2D } from '../domain/constraints/VolumeConstraint2D';
import { GroundConstraint2D } from '../domain/constraints/GroundConstraint2D';
import { UserConstraint2D } from '../domain/constraints/UserConstraint2D';

import { DebugLogger } from '../infrastructure/DebugLogger';
import { SIM_CONFIG } from '../config';

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
  uiController?: { applyInteractionForces: () => { extraVolumeConstraints?: any[] } };
}

export class SimulationStepper {
  static step(ctx: SimulationStepContext, dt: number) {
    dt = Math.min(dt, ctx.maxDt);
    
    // 1. FORCE PHASE: Apply all force-based effects
    for (const body of ctx.bodies) {
      // Note: Forces are reset during integration, not here
      // Apply forces in logical order:
      ctx.gravityForce.apply(body.nodes, ctx.worldGravity);
      body.applyMooneyRivlinForces();
      body.applySpringForces(dt); // Spring forces (not constraints)
      // Apply pressure forces to cells
      for (const cell of body.cells) {
        ctx.pressureForce.apply(cell);
      }
    }
    // --- NEW: Apply distributed user interaction forces if present ---
    let extraVolumeConstraints: any[] = [];
    if (ctx.uiController && typeof ctx.uiController.applyInteractionForces === 'function') {
      const result = ctx.uiController.applyInteractionForces();
      if (result && Array.isArray(result.extraVolumeConstraints)) {
        extraVolumeConstraints = result.extraVolumeConstraints;
      }
    }
    
    // Apply user interaction forces (before integration for immediate response)
    // Filter out disabled constraints to prevent orphaned constraint processing
    const activeUserConstraints = ctx.userConstraints?.filter(uc => uc.enabled) ?? [];
    if (activeUserConstraints.length > 0) {
      for (const uConstraint of activeUserConstraints) {
        // Update constraint release timer
        if (uConstraint.isReleasing) {
          const releaseComplete = uConstraint.updateRelease(dt);
          if (releaseComplete) {
            uConstraint.enabled = false;
            continue; // Skip applying force if just disabled
          }
        }
        
        uConstraint.applyForce(); // Use force-based approach for user interaction
      }
    }
    
    // 2. INTEGRATION: Update velocities and positions using forces
    for (const body of ctx.bodies) {
      Integrator2D.semiImplicitEuler(body.nodes, dt);
    }
    
    // Explosion detection and recovery
    for (const body of ctx.bodies) {
      // --- Dynamic anomaly thresholds ---
      const canvasWidth = (window && window.innerWidth) ? window.innerWidth : 1920;
      const canvasHeight = (window && window.innerHeight) ? window.innerHeight : 1080;
      const posMaxVal = 1.2 * Math.max(canvasWidth, canvasHeight); // Allow 20% margin
      const velMaxVal = 200; // Large velocities are always suspicious

      for (const node of body.nodes) {
        const pos = node.position;
        const vel = node.velocity;
        // Gather more context for logging
        const nodeId = (node as any)._nodeId ?? body.nodes.indexOf(node);
        // Gather grid/canvas/global info if available
        const gridInfo = {
          canvasWidth,
          canvasHeight,
          margin: (typeof SIM_CONFIG !== 'undefined' && SIM_CONFIG.margin !== undefined) ? SIM_CONFIG.margin : undefined,
          spacing: (typeof SIM_CONFIG !== 'undefined' && SIM_CONFIG.desiredCellSpacing !== undefined) ? SIM_CONFIG.desiredCellSpacing : undefined,
          desiredNumCols: (typeof SIM_CONFIG !== 'undefined' && SIM_CONFIG.desiredNumCols !== undefined) ? SIM_CONFIG.desiredNumCols : undefined,
          desiredNumRows: (typeof SIM_CONFIG !== 'undefined' && SIM_CONFIG.desiredNumRows !== undefined) ? SIM_CONFIG.desiredNumRows : undefined,
          actualNumNodes: body.nodes.length,
          actualNumSprings: body.springs.length,
          actualNumCells: body.cells.length,
          posMaxVal,
          velMaxVal
        };
        const nodeInfo = {
          nodeId,
          pos: { ...pos },
          vel: { ...vel },
          mass: node.mass,
          damping: node.damping,
          springs: body.springs.filter(s => s.a === node || s.b === node).map(s => ({
            other: s.a === node ? (s.b as any)._nodeId ?? body.nodes.indexOf(s.b) : (s.a as any)._nodeId ?? body.nodes.indexOf(s.a),
            restLength: s.restLength,
            springFrequency: s.springFrequency,
            dampingRatio: s.dampingRatio
          })),
          gridInfo
        };
        // Check for NaN/Inf
        if (!isFinite(pos.x) || !isFinite(pos.y) || !isFinite(vel.x) || !isFinite(vel.y)) {
          DebugLogger.log('pointmass', 'NaN/Inf detected in node', nodeInfo);
          // Reset to safe values
          pos.x = isFinite(pos.x) ? pos.x : 0;
          pos.y = isFinite(pos.y) ? pos.y : 0;
          vel.x = 0;
          vel.y = 0;
        }
        // Check for excessive values (explosion)
        if (Math.abs(pos.x) > posMaxVal || Math.abs(pos.y) > posMaxVal) {
          DebugLogger.log('pointmass', 'Large position detected in node', nodeInfo);
          // Clamp to safe range
          pos.x = Math.max(-posMaxVal, Math.min(pos.x, posMaxVal));
          pos.y = Math.max(-posMaxVal, Math.min(pos.y, posMaxVal));
        }
        if (Math.abs(vel.x) > velMaxVal || Math.abs(vel.y) > velMaxVal) {
          DebugLogger.log('pointmass', 'Large velocity detected in node', nodeInfo);
          vel.x = Math.max(-velMaxVal, Math.min(vel.x, velMaxVal));
          vel.y = Math.max(-velMaxVal, Math.min(vel.y, velMaxVal));
        }
      }

      // --- Collapse detection: are most nodes clustered in a tiny region? ---
      if (body.nodes.length > 2) {
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const node of body.nodes) {
          minX = Math.min(minX, node.position.x);
          maxX = Math.max(maxX, node.position.x);
          minY = Math.min(minY, node.position.y);
          maxY = Math.max(maxY, node.position.y);
        }
        const spreadX = maxX - minX;
        const spreadY = maxY - minY;
        // If all nodes are within a tiny region (e.g. < 2% of canvas), flag as collapse
        const collapseThreshold = 0.02 * Math.max(canvasWidth, canvasHeight);
        if (spreadX < collapseThreshold && spreadY < collapseThreshold) {
          DebugLogger.log('pointmass', 'Grid collapse detected: all nodes clustered', {
            minX, maxX, minY, maxY, spreadX, spreadY, nodeCount: body.nodes.length, canvasWidth, canvasHeight, collapseThreshold
          });
        }
      }
    }
    
    // 3. POSITION-BASED CONSTRAINT PHASE: Iteratively correct positions
    // Merge and deduplicate all area constraints (global + extra)
    const allAreaConstraints = [...ctx.volumeConstraints];
    for (const c of extraVolumeConstraints) {
      if (!allAreaConstraints.includes(c)) {
        allAreaConstraints.push(c);
      }
    }
    for (let iter = 0; iter < ctx.iterationBudget; iter++) {
      for (const vConstraint of allAreaConstraints) {
        vConstraint.apply();
      }
      // Fine-tuning user constraints (minimal position corrections only)
      if (ctx.userConstraints && ctx.userConstraints.length > 0) {
        for (const uConstraint of ctx.userConstraints) {
          uConstraint.apply(); // Fine position correction
        }
      }
    }
    
    // 4. ENVIRONMENT CONSTRAINTS: Apply after all other constraints
    if (ctx.enableGround) {
      for (const gConstraint of ctx.groundConstraints) {
        gConstraint.apply();
      }
    }
    
    // Log user constraints if present, but only once per second
    if (ctx.userConstraints && ctx.userConstraints.length > 0) {
      const now = performance.now();
      if (!SimulationStepper._lastUserConstraintLogTime || now - SimulationStepper._lastUserConstraintLogTime > 1000) {
        console.log(`[SimulationStepper] Applied ${ctx.userConstraints.length} user constraint(s) for ${ctx.iterationBudget} iterations`);
        SimulationStepper._lastUserConstraintLogTime = now;
      }
    }
  }

  // Track last log time for user constraint logging
  private static _lastUserConstraintLogTime: number = 0;
}
