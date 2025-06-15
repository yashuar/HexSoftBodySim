// UIController: Handles user input, simulation controls, and mask editing events.
// Designed for modularity and easy extension.

import { SimulationCoordinator } from '../application/SimulationCoordinator';
import { MaskRegion } from '../application/MaskParser';
import { ParameterPanel, ParameterChange } from './ParameterPanel';

export class UIController {
  private coordinator: SimulationCoordinator;
  private maskRegions: MaskRegion[] = [];
  private isPaused: boolean = false;
  private uiPanel: HTMLElement | null;
  private parameterPanel: ParameterPanel | null = null;
  private speed: number = 1;

  constructor(coordinator: SimulationCoordinator, uiPanelId: string = 'ui-panel') {
    this.coordinator = coordinator;
    this.uiPanel = document.getElementById(uiPanelId);
    this.setupUI();
    this.parameterPanel = new ParameterPanel(document.body); // container not used, sliders are in DOM
    this.parameterPanel.onChange(this.handleParameterChange.bind(this));
  }

  // Add a new mask region and update the simulation
  addMaskRegion(region: MaskRegion): void {
    this.maskRegions.push(region);
    // Always provide all parameters for type safety
    const params = {
      mass: region.params.mass ?? 1,
      stiffness: region.params.stiffness ?? 1,
      damping: region.params.damping ?? 0.01
    };
    this.coordinator.onMaskChange(this.maskRegions, params);
  }

  // Step the simulation by dt
  step(dt: number): void {
    if (!this.isPaused) {
      this.coordinator.step(dt * this.speed);
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

  // Reset simulation (re-initialize body and world)
  reset(): void {
    window.location.reload();
  }

  // Handle parameter slider changes
  private handleParameterChange(change: ParameterChange) {
    if (change.stiffness !== undefined) {
      this.coordinator.setGlobalParameter('stiffness', change.stiffness);
    }
    if (change.damping !== undefined) {
      this.coordinator.setGlobalParameter('damping', change.damping);
    }
    if (change.speed !== undefined) {
      this.speed = change.speed;
    }
  }

  // Set up UI controls and wire up events
  private setupUI(): void {
    // Pause/Resume
    const pauseBtn = document.getElementById('pause-btn');
    if (pauseBtn) {
      pauseBtn.onclick = () => this.togglePause();
    }
    // Reset
    const resetBtn = document.getElementById('reset-btn');
    if (resetBtn) {
      resetBtn.onclick = () => this.reset();
    }
    // Add Mask
    const addMaskBtn = document.getElementById('add-mask-btn');
    if (addMaskBtn) {
      addMaskBtn.onclick = () => {
        // Placeholder: In a real app, would open mask editor or add a default region
        alert('Mask editing not yet implemented.');
      };
    }
  }

  get simulationSpeed(): number {
    return this.speed;
  }
}
