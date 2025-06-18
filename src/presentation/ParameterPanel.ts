import { StateManager } from '../infrastructure/StateManager';
import { EventBus } from '../infrastructure/EventBus';
import { SIM_CONFIG } from '../config';

// ParameterPanel: Material-inspired UI for global simulation parameters.

export type ParameterChange = {
  stiffness?: number;
  dampingRatio?: number;
  mass?: number;
  restLength?: number;
  interactionStrength?: number;
  gravityX?: number;
  gravityY?: number;
  enableMooneyRivlin?: boolean;
  speed?: number;
  desiredCellSpacing?: number;
  desiredNumCols?: number;
  desiredNumRows?: number;
  margin?: number;
  globalDampingRatio?: number;
  globalStiffness?: number;
  globalMass?: number;
  globalRestLength?: number;
  globalInteractionStrength?: number;
};

export class ParameterPanel {
  private container: HTMLElement;
  private controls: Record<string, HTMLInputElement> = {};
  private listeners: ((change: ParameterChange) => void)[] = [];
  private eventBus?: EventBus;

  constructor(container: HTMLElement, simState: StateManager<{ smoothingFrames: number }>, eventBus?: EventBus) {
    this.container = container;
    this.eventBus = eventBus;
    // Only clear the parameter controls, not the whole panel
    this.container.innerHTML = '';
    // --- Section: Physics Parameters ---
    this.container.appendChild(this.sectionHeader('Physics'));
    this.createSlider('globalDampingRatio', 0, 2, 0.01, 0.5, 'Damping Ratio', 'mui-slider', 'Controls how quickly motion is damped (0 = none, 1 = critical, 2 = overdamped)');
    this.createSlider('globalStiffness', 0, 10, 0.01, 0.01, 'Stiffness', 'mui-slider', 'Spring stiffness (higher = stiffer springs, more force)');
    this.createSlider('globalMass', 0.001, 10, 0.001, 0.01, 'Mass', 'mui-slider', 'Mass of each point in the simulation');
    this.createSlider('globalRestLength', 0.1, 2, 0.01, 1, 'Rest Length', 'mui-slider', 'Natural length of springs between points');
    this.createSlider('globalInteractionStrength', 0, 10, 0.01, 1, 'Interaction Strength', 'mui-slider', 'Strength of inter-cell forces');
    this.createSwitch('enableMooneyRivlin', 'Enable Mooney-Rivlin', 'Use Mooney-Rivlin material model for soft bodies');
    this.container.appendChild(this.divider());
    // --- Section: Gravity ---
    this.container.appendChild(this.sectionHeader('Gravity'));
    this.createSlider('gravityX', -10, 10, 0.1, 0, 'Gravity X', 'mui-slider', 'Horizontal gravity (m/s²)');
    this.createSlider('gravityY', -10, 10, 0.1, 1, 'Gravity Y', 'mui-slider', 'Vertical gravity (m/s²)');
    this.container.appendChild(this.divider());
    // --- Section: Grid/Simulation ---
    this.container.appendChild(this.sectionHeader('Grid'));
    this.createSlider('desiredCellSpacing', 1, 200, 1, 40, 'Cell Spacing', 'mui-slider', 'Distance between grid cells');
    this.createSlider('desiredNumCols', 1, 100, 1, 20, 'Num Cols', 'mui-slider', 'Number of columns in the grid');
    this.createSlider('desiredNumRows', 1, 100, 1, 15, 'Num Rows', 'mui-slider', 'Number of rows in the grid');
    this.createSlider('margin', 0, 200, 1, 40, 'Margin', 'mui-slider', 'Margin around the grid');
    this.container.appendChild(this.divider());
    // --- Section: Simulation ---
    this.container.appendChild(this.sectionHeader('Simulation'));
    this.createSlider('speed', 0.1, 4, 0.01, 1, 'Simulation Speed', 'mui-slider', 'Controls the speed multiplier for the simulation (1 = normal, <1 = slow motion, >1 = fast)');
    this.createSlider('maxFps', 10, 120, 1, 60, 'Max FPS', 'mui-slider', 'Maximum frames per second for simulation and rendering');
    // Attach listeners for all controls
    this.attachListeners(simState);
    // Append Restore Defaults button at the end
    const restoreBtn = document.createElement('button');
    restoreBtn.className = 'mui-btn';
    restoreBtn.id = 'restore-defaults-btn';
    restoreBtn.title = 'Restore all parameters to default values';
    restoreBtn.innerHTML = '<span class="material-icons">settings_backup_restore</span>Restore Defaults';
    restoreBtn.style.margin = '12px 0 0 0';
    restoreBtn.onclick = () => {
      // Set all controls to SIM_CONFIG defaults
      this.update({
        globalDampingRatio: SIM_CONFIG.globalDampingRatio,
        globalStiffness: SIM_CONFIG.globalStiffness,
        globalMass: SIM_CONFIG.globalMass,
        globalRestLength: SIM_CONFIG.globalRestLength,
        globalInteractionStrength: SIM_CONFIG.globalInteractionStrength,
        gravityX: SIM_CONFIG.gravity.x,
        gravityY: SIM_CONFIG.gravity.y,
        enableMooneyRivlin: SIM_CONFIG.enableMooneyRivlin,
        speed: 1,
        maxFps: 60
      });
      // Update StateManager as well (only known properties)
      simState.set({
        smoothingFrames: 5
      });
      this.eventBus?.emit('parameterChange', {
        globalDampingRatio: SIM_CONFIG.globalDampingRatio,
        globalStiffness: SIM_CONFIG.globalStiffness,
        globalMass: SIM_CONFIG.globalMass,
        globalRestLength: SIM_CONFIG.globalRestLength,
        globalInteractionStrength: SIM_CONFIG.globalInteractionStrength,
        gravityX: SIM_CONFIG.gravity.x,
        gravityY: SIM_CONFIG.gravity.y,
        enableMooneyRivlin: SIM_CONFIG.enableMooneyRivlin,
        speed: 1,
        maxFps: 60
      });
    };
    this.container.appendChild(restoreBtn);
  }

  private sectionHeader(label: string): HTMLElement {
    const el = document.createElement('div');
    el.className = 'mui-section-header';
    el.style.fontSize = '0.98rem';
    el.style.fontWeight = '600';
    el.style.margin = '10px 0 2px 0';
    el.style.letterSpacing = '0.2px';
    el.style.gap = '4px';
    el.innerHTML = `<span class="material-icons" style="font-size:1em;">tune</span> ${label}`;
    return el;
  }

  private divider(): HTMLElement {
    const hr = document.createElement('hr');
    hr.className = 'mui-divider';
    hr.style.margin = '8px 0';
    return hr;
  }

  private createSlider(
    key: string,
    min: number,
    max: number,
    step: number,
    value: number,
    label: string,
    sliderClass: string,
    tooltip: string
  ) {
    const wrapper = document.createElement('div');
    wrapper.className = 'mui-row';
    wrapper.style.gap = '8px';
    wrapper.style.marginBottom = '4px';
    wrapper.style.alignItems = 'center';
    // Label with tooltip
    const labelElem = document.createElement('label');
    labelElem.className = 'mui-label mui-tooltip';
    labelElem.htmlFor = key;
    labelElem.style.fontSize = '0.93rem';
    labelElem.style.marginBottom = '0';
    labelElem.style.gap = '3px';
    labelElem.innerHTML = `${label} <span class="material-icons" style="font-size:0.95em;vertical-align:middle;">help_outline</span>`;
    const tooltipElem = document.createElement('span');
    tooltipElem.className = 'mui-tooltip-text';
    tooltipElem.textContent = tooltip;
    labelElem.appendChild(tooltipElem);
    // Slider
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.id = key;
    slider.className = sliderClass;
    slider.min = min.toString();
    slider.max = max.toString();
    slider.step = step.toString();
    slider.value = value.toString();
    slider.style.flex = '1 1 auto';
    slider.style.margin = '0';
    slider.style.height = '18px';
    // Value display
    const valueDisplay = document.createElement('span');
    valueDisplay.className = 'mui-slider-value';
    valueDisplay.style.fontSize = '0.93rem';
    valueDisplay.style.minWidth = '28px';
    valueDisplay.textContent = value.toString();
    slider.addEventListener('input', () => {
      valueDisplay.textContent = slider.value;
    });
    wrapper.appendChild(labelElem);
    wrapper.appendChild(slider);
    wrapper.appendChild(valueDisplay);
    this.container.appendChild(wrapper);
    this.controls[key] = slider;
  }

  private createSwitch(key: string, label: string, tooltip: string) {
    const wrapper = document.createElement('div');
    wrapper.className = 'mui-row';
    wrapper.style.gap = '8px';
    wrapper.style.marginBottom = '4px';
    // Label with tooltip
    const labelElem = document.createElement('label');
    labelElem.className = 'mui-label mui-tooltip';
    labelElem.htmlFor = key;
    labelElem.style.fontSize = '0.93rem';
    labelElem.style.marginBottom = '0';
    labelElem.style.gap = '3px';
    labelElem.innerHTML = `${label} <span class="material-icons" style="font-size:0.95em;vertical-align:middle;">help_outline</span>`;
    const tooltipElem = document.createElement('span');
    tooltipElem.className = 'mui-tooltip-text';
    tooltipElem.textContent = tooltip;
    labelElem.appendChild(tooltipElem);
    // Switch
    const switchWrapper = document.createElement('span');
    switchWrapper.className = 'mui-switch';
    switchWrapper.style.height = '18px';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = key;
    const slider = document.createElement('span');
    slider.className = 'mui-slider';
    switchWrapper.appendChild(checkbox);
    // Custom switch track/knob (optional, for more Material look)
    wrapper.appendChild(labelElem);
    wrapper.appendChild(switchWrapper);
    this.container.appendChild(wrapper);
    this.controls[key] = checkbox;
  }

  private attachListeners(simState: StateManager<{ smoothingFrames: number }>) {
    // All controls emit parameterChange events
    const emitChange = (key: string, value: any) => {
      this.eventBus?.emit('parameterChange', { [key]: value });
    };
    // Sliders
    [
      'globalDampingRatio', 'globalStiffness', 'globalMass', 'globalRestLength', 'globalInteractionStrength',
      'gravityX', 'gravityY', 'desiredCellSpacing', 'desiredNumCols', 'desiredNumRows', 'margin', 'speed', 'maxFps'
    ].forEach(key => {
      const slider = this.controls[key] as HTMLInputElement;
      if (slider) {
        slider.addEventListener('input', () => {
          const value = slider.type === 'range' ? parseFloat(slider.value) : slider.value;
          if (key === 'speed') simState.set({ smoothingFrames: Number(value) });
          emitChange(key, value);
        });
      }
    });
    // Switches
    ['enableMooneyRivlin'].forEach(key => {
      const checkbox = this.controls[key] as HTMLInputElement;
      if (checkbox) {
        checkbox.addEventListener('change', () => {
          emitChange(key, checkbox.checked);
        });
      }
    });
  }

  onChange(listener: (change: ParameterChange) => void) {
    this.listeners.push(listener);
  }

  private emit(change: ParameterChange) {
    for (const listener of this.listeners) {
      listener(change);
    }
  }

  update(params: Partial<ParameterChange>): void {
    const keys: (keyof ParameterChange)[] = [
      'stiffness', 'dampingRatio', 'mass', 'restLength', 'interactionStrength',
      'gravityX', 'gravityY', 'enableMooneyRivlin', 'speed',
      'desiredCellSpacing', 'desiredNumCols', 'desiredNumRows', 'margin',
      'globalDampingRatio', 'globalStiffness', 'globalMass', 'globalRestLength', 'globalInteractionStrength'
    ];
    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(this.controls, key) && params[key] !== undefined) {
        const ctrl = this.controls[key] as HTMLInputElement;
        if (ctrl.type === 'checkbox') {
          ctrl.checked = Boolean(params[key]);
        } else {
          ctrl.value = String(params[key]);
          // Update value display if present
          const wrapper = ctrl.parentElement;
          if (wrapper) {
            const valueDisplay = wrapper.querySelector('.mui-slider-value');
            if (valueDisplay) {
              valueDisplay.textContent = ctrl.value;
            }
          }
        }
      }
    }
    // Emit combined change event for all updated parameters
    this.emit(params as ParameterChange);
  }
}
