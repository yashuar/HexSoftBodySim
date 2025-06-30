// SimulationStepper.ts
// SIMPLIFIED SIMULATION PIPELINE - Robust and effective with minimal complexity

import { HexSoftBody } from '../domain/HexSoftBody';
import { Gravity2D } from '../domain/forces/Gravity2D';
import { PressureForce2D } from '../domain/forces/PressureForce2D';
import { Integrator2D } from '../domain/Integrator2D';
import { VolumeConstraint2D } from '../domain/constraints/VolumeConstraint2D';
import { GroundConstraint2D } from '../domain/constraints/GroundConstraint2D';
import { UserConstraint2D } from '../domain/constraints/UserConstraint2D';
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
  uiController?: { 
    update: (dt: number) => void;
    applyGlobalRestoreDamping: () => void;
  };
}

export class SimulationStepper {
  // SIMPLIFIED PHYSICS STEPPER - No over-engineered systems
  
  static step(ctx: SimulationStepContext, dt: number) {
    dt = Math.min(dt, ctx.maxDt);
    
    // === PHASE 1: UPDATE USER INTERACTIONS ===
    if (ctx.uiController && typeof ctx.uiController.update === 'function') {
      ctx.uiController.update(dt);
    }
    
    // === PHASE 2: APPLY ALL FORCES ===
    for (const body of ctx.bodies) {
      // Apply gravity
      ctx.gravityForce.apply(body.nodes, ctx.worldGravity);
      
      // Apply Mooney-Rivlin forces (ESSENTIAL biomechanical feature)
      if (SIM_CONFIG.enableMooneyRivlin) {
        body.applyMooneyRivlinForces();
      }
      
      // Apply spring forces (INCLUDES all essential features: non-linear, strain-stiffening)
      body.applySpringForces(dt, 1.0);
      
      // Apply pressure forces (ESSENTIAL for volume preservation)
      for (const cell of body.cells) {
        ctx.pressureForce.apply(cell);
      }
    }
    
    // === PHASE 3: GLOBAL DAMPING FOR REST STATE RECOVERY ===
    if (ctx.uiController && typeof ctx.uiController.applyGlobalRestoreDamping === 'function') {
      ctx.uiController.applyGlobalRestoreDamping();
    }
    
    // === PHASE 4: INTEGRATION ===
    for (const body of ctx.bodies) {
      Integrator2D.semiImplicitEuler(body.nodes, dt);
    }
    
    // === PHASE 5: SIMPLE EXPLOSION DETECTION ===
    for (const body of ctx.bodies) {
      const canvasWidth = (window && window.innerWidth) ? window.innerWidth : 1920;
      const canvasHeight = (window && window.innerHeight) ? window.innerHeight : 1080;
      const posMaxVal = 1.2 * Math.max(canvasWidth, canvasHeight);
      const velMaxVal = 200;

      for (const node of body.nodes) {
        const posX = node.getPositionX();
        const posY = node.getPositionY();
        const velX = node.getVelocityX();
        const velY = node.getVelocityY();
        
        // Check for NaN/Inf
        if (!isFinite(posX) || !isFinite(posY) || !isFinite(velX) || !isFinite(velY)) {
          console.warn('[SimulationStepper] NaN/Inf detected, resetting node');
          node.setPosition(isFinite(posX) ? posX : 0, isFinite(posY) ? posY : 0);
          node.setVelocity(0, 0);
        }
        
        // Check for excessive values
        if (Math.abs(posX) > posMaxVal || Math.abs(posY) > posMaxVal) {
          console.warn('[SimulationStepper] Large position detected, clamping');
          node.setPosition(
            Math.max(-posMaxVal, Math.min(posX, posMaxVal)),
            Math.max(-posMaxVal, Math.min(posY, posMaxVal))
          );
        }
        
        if (Math.abs(velX) > velMaxVal || Math.abs(velY) > velMaxVal) {
          console.warn('[SimulationStepper] Large velocity detected, clamping');
          node.setVelocity(
            Math.max(-velMaxVal, Math.min(velX, velMaxVal)),
            Math.max(-velMaxVal, Math.min(velY, velMaxVal))
          );
        }
      }
    }
    
    // === PHASE 6: SIMPLE CONSTRAINT RESOLUTION ===
    // Volume constraints (minimal iterations for stability)
    const simpleIterations = Math.min(ctx.iterationBudget, 3); // Limit iterations for simplicity
    for (let iter = 0; iter < simpleIterations; iter++) {
      for (const vConstraint of ctx.volumeConstraints) {
        vConstraint.apply();
      }
    }
    
    // Ground constraints
    if (ctx.enableGround) {
      for (const gConstraint of ctx.groundConstraints) {
        gConstraint.apply();
      }
    }
  }
}
