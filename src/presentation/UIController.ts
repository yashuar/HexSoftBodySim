// UIController: Handles user input, simulation controls, and mask editing events.
// Designed for modularity and easy extension.

import { SimulationCoordinator } from '../application/SimulationCoordinator';
import { MaskRegion } from '../application/MaskParser';
// ParameterPanel import and usage removed for UI rebuild
// import { ParameterPanel, ParameterChange } from './ParameterPanel';
import { StateManager } from '../infrastructure/StateManager';
import { CellParameters } from '../domain/CellParameters';
import { EventBus } from '../infrastructure/EventBus';

import { SimulationStepper } from '../domain/SimulationStepper';
import { SIM_CONFIG } from '../config';
import { SimulationState } from '../main';
import { DebugLogger } from '../infrastructure/DebugLogger';

export class UIController {
  private userInteractionController?: { applyInteractionForces: () => any, getActiveAreaConstraints?: () => any[] };

  public setUserInteractionController(controller: { applyInteractionForces: () => any, getActiveAreaConstraints?: () => any[] }) {
    this.userInteractionController = controller;
  }

  /**
   * Applies interaction forces and returns any extra constraints (e.g., area constraints from distributed drag)
   */
  public applyInteractionForces(): { extraVolumeConstraints?: any[] } {
    if (this.userInteractionController && typeof this.userInteractionController.applyInteractionForces === 'function') {
      return this.userInteractionController.applyInteractionForces();
    }
    return {};
  }

  /**
   * Returns all active area constraints from the user interaction controller, if any
   */
  public getActiveAreaConstraints(): any[] {
    if (this.userInteractionController && typeof this.userInteractionController.getActiveAreaConstraints === 'function') {
      return this.userInteractionController.getActiveAreaConstraints();
    }
    return [];
  }
  private coordinator: SimulationCoordinator;
  private maskRegions: MaskRegion[] = [];
  private isPaused: boolean = false;
  
  private speed: number = 1;
  private maxFps: number = 60;
  // Accept a generic StateManager type for broader compatibility
  private simState: StateManager<any>;
  private eventBus?: EventBus;

  constructor(coordinator: SimulationCoordinator, uiPanelId: string = 'parameter-panel-mount', simState?: StateManager<any>, eventBus?: EventBus) {
    this.coordinator = coordinator;
    this.simState = simState ?? new StateManager({ defaultParams: { mass: 1, stiffness: 1, damping: 0.01 }, smoothingFrames: 5 });
    this.eventBus = eventBus;


    // Listen for simulation control events
    if (this.eventBus) {
      this.eventBus.on('ui:togglePause', () => this.togglePause());
      this.eventBus.on('ui:reset', () => this.reset());
      this.eventBus.on('pluginError', (err) => {
        // Display or log plugin errors in the UI
        DebugLogger.log('system-event', '[UIController] Plugin error', { error: err });
        alert('A plugin error occurred. See console for details.');
      });
      this.eventBus.on('parameterChange', (change) => {
        this.simState.set(change);
        // Live update for all global parameters
        if (change.springFrequency !== undefined) {
          for (const spring of this.coordinator.body.springs) {
            spring.springFrequency = change.springFrequency;
          }
          // Update defaultParams for resets
          const prev = this.simState.get().defaultParams;
          this.simState.set({ defaultParams: { ...prev, springFrequency: change.springFrequency } });
        }
        if (change.dampingRatio !== undefined) {
          for (const spring of this.coordinator.body.springs) {
            spring.dampingRatio = change.dampingRatio;
          }
          // Update defaultParams for resets
          const prev = this.simState.get().defaultParams;
          this.simState.set({ defaultParams: { ...prev, dampingRatio: change.dampingRatio } });
        }
        if (change.globalMass !== undefined) {
          for (const node of this.coordinator.body.nodes) {
            node.mass = change.globalMass;
          }
          // Update defaultParams for resets
          const prev = this.simState.get().defaultParams;
          this.simState.set({ defaultParams: { ...prev, mass: change.globalMass } });
        }
        // Apply globalRestLength as a scale factor to all spring rest lengths  
        // This allows dynamic adjustment while preserving the relative proportions
        if (change.globalRestLength !== undefined && change.globalRestLength !== 1.0) {
          for (const spring of this.coordinator.body.springs) {
            // Reset to original calculated rest length first if we stored it
            if (!spring.originalRestLength) {
              spring.originalRestLength = spring.restLength;
            }
            // Scale the original rest length rather than compounding scaling
            spring.restLength = spring.originalRestLength * change.globalRestLength;
          }
        }
        if (change.globalInteractionStrength !== undefined) {
          // If you have a global interaction strength, update it here
          if (typeof this.coordinator.body.setGlobalInteractionStrength === 'function') {
            this.coordinator.body.setGlobalInteractionStrength(change.globalInteractionStrength);
          }
        }
        // --- NEW: Handle all other parameter changes for live simulation sync ---
        if (change.globalPressure !== undefined) {
          this.coordinator.world.globalPressure = change.globalPressure;
        }
        if (change.gravity !== undefined && typeof change.gravity === 'object') {
          this.coordinator.world.gravity = { x: change.gravity.x, y: change.gravity.y };
        }
        if (change.forceRealismScale !== undefined) {
          // No setForceRealismScale on body; only propagate to userInteractionController
          if (this.userInteractionController && typeof (this.userInteractionController as any).setForceRealismScale === 'function') {
            (this.userInteractionController as any).setForceRealismScale(change.forceRealismScale);
          }
          if (this.userInteractionController && typeof (this.userInteractionController as any).setForceRealismScale === 'function') {
            (this.userInteractionController as any).setForceRealismScale(change.forceRealismScale);
          }
        }
        if (change.enableGround !== undefined) {
          this.coordinator.world.enableGround = change.enableGround;
        }
        if (change.gravityX !== undefined || change.gravityY !== undefined) {
          const gx = change.gravityX !== undefined ? change.gravityX : SIM_CONFIG.gravity.x;
          const gy = change.gravityY !== undefined ? change.gravityY : SIM_CONFIG.gravity.y;
          this.coordinator.world.gravity = { x: gx, y: gy };
        }
        if (change.enableMooneyRivlin !== undefined) {
          // Toggle Mooney-Rivlin forces globally
          for (const cell of this.coordinator.body.cells) {
            cell.mooneyC1 = change.enableMooneyRivlin ? 1.0 : 0.0;
            cell.mooneyC2 = change.enableMooneyRivlin ? 0.2 : 0.0;
          }
        }
        if (change.mooneyDamping !== undefined) {
          // Update Mooney-Rivlin damping for all cells
          for (const cell of this.coordinator.body.cells) {
            cell.mooneyDamping = change.mooneyDamping;
          }
        }
        if (change.mooneyMaxForce !== undefined) {
          // Update Mooney-Rivlin max force for all cells
          for (const cell of this.coordinator.body.cells) {
            cell.mooneyMaxForce = change.mooneyMaxForce;
          }
        }
        if (change.speed !== undefined) {
          this.speed = Number(change.speed);
        }
        if (change.maxFps !== undefined) {
          this.maxFps = Number(change.maxFps);
        }
        // Grid/structure changes require reset to take effect
        if (change.desiredCellSpacing !== undefined || 
            change.desiredNumCols !== undefined || 
            change.desiredNumRows !== undefined || 
            change.margin !== undefined) {
          // Store the grid changes for reset
          this.simState.set({
            desiredCellSpacing: change.desiredCellSpacing ?? this.simState.get().desiredCellSpacing,
            desiredNumCols: change.desiredNumCols ?? this.simState.get().desiredNumCols,
            desiredNumRows: change.desiredNumRows ?? this.simState.get().desiredNumRows,
            margin: change.margin ?? this.simState.get().margin
          });
          
          // Show notification that reset is needed
          if (typeof (window as any).showSnackbar === 'function') {
            (window as any).showSnackbar('Grid changes require simulation reset to take effect');
          }
        }
        if (change.enableForceCoordination !== undefined || 
            change.materialModelMode !== undefined || 
            change.energyBudgetLimit !== undefined) {
          // Force coordination changes - update the SimulationStepper's force coordinator
          SimulationStepper.updateForceCoordinationConfig({
            enableCoordination: change.enableForceCoordination,
            materialModelMode: change.materialModelMode,
            energyBudgetLimit: change.energyBudgetLimit
          });
          
          DebugLogger.log('system-event', '[UIController] Force coordination settings updated live', {
            enableForceCoordination: change.enableForceCoordination,
            materialModelMode: change.materialModelMode,
            energyBudgetLimit: change.energyBudgetLimit
          });
        }
      });
    }
  }

  // Add a new mask region and update the simulation
  addMaskRegion(region: MaskRegion): void {
    this.simState.set({
      defaultParams: {
        mass: region.params.mass ?? SIM_CONFIG.globalMass,
        springFrequency: region.params.springFrequency ?? SIM_CONFIG.springFrequency,
        dampingRatio: region.params.dampingRatio ?? SIM_CONFIG.dampingRatio
      }
    });
    this.maskRegions.push(region);
    this.coordinator.onMaskChange(this.maskRegions, this.simState.get().defaultParams, this.simState.get().smoothingFrames);
  }

  // Step the simulation by dt
  step(dt: number): void {
    if (!this.isPaused) {
      this.coordinator.step(dt * this.speed, this);
    }
  }

  // Toggle pause/play
  togglePause(): void {
    this.isPaused = !this.isPaused;
    const pauseBtn = document.getElementById('pause-btn');
    if (pauseBtn) {
      pauseBtn.innerHTML = `<span class="material-icons">${this.isPaused ? 'play_arrow' : 'pause'}</span>${this.isPaused ? 'Resume' : 'Pause'}`;
    }
  }

  // Reset simulation with smart detection of what needs to be rebuilt
  reset(): void {
    const state = this.simState.get();
    
    // Always preserve all current parameter values when resetting
    const preservedState: Partial<SimulationState> = {
      ...state,
      // Ensure defaultParams reflects current UI values - use live values if available
      defaultParams: {
        mass: state.globalMass ?? state.defaultParams.mass,
        springFrequency: state.springFrequency ?? state.defaultParams.springFrequency,
        dampingRatio: state.dampingRatio ?? state.defaultParams.dampingRatio
      }
    };
    
    // Update the state manager with all preserved values before reset
    this.simState.set(preservedState);
    
    // Check if grid structure needs rebuilding
    const needsGridRebuild = this.needsGridRebuild(state);
    
    if (needsGridRebuild) {
      // Full reset for grid structure changes, preserving all parameters
      (window as any).resetSimulationWithParams?.(preservedState);
      if (typeof (window as any).showSnackbar === 'function') {
        (window as any).showSnackbar('Simulation reset with new grid layout, parameters preserved');
      }
    } else {
      // Soft reset - just reset physics state without rebuilding grid
      this.softReset();
      if (typeof (window as any).showSnackbar === 'function') {
        (window as any).showSnackbar('Physics state reset to default positions, parameters preserved');
      }
    }
  }

  private needsGridRebuild(state: any): boolean {
    // Compare current grid parameters with what was used to build the current grid
    // For now, we'll assume any reset needs a rebuild, but this could be smarter
    return true;
  }

  private softReset(): void {
    // Reset positions and velocities without rebuilding the grid
    if (this.coordinator?.body) {
      for (const node of this.coordinator.body.nodes) {
        // Reset velocities and accumulated forces
        node.velocity = { x: 0, y: 0 };
        node.force = { x: 0, y: 0 };
        // Could also reset positions to original grid layout here if we stored initial positions
      }
      
      // Reset spring rest lengths to defaults if needed
      const defaultRestLength = SIM_CONFIG.globalRestLength;
      for (const spring of this.coordinator.body.springs) {
        if (spring.restLength !== defaultRestLength) {
          spring.restLength = defaultRestLength;
        }
      }
    }
  }

  // Handle parameter slider changes
  // private handleParameterChange(change: ParameterChange) {
  //   // No-op: handled by StateManager subscription
  // }

  // Set up UI controls and wire up events


  get simulationSpeed(): number {
    return this.speed;
  }

  get simulationMaxFps(): number {
    return this.maxFps;
  }
}
