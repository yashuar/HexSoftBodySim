import { StateManager } from '../infrastructure/StateManager';
import { EventBus } from '../infrastructure/EventBus';
import { SIM_CONFIG, PARAMETER_SCHEMA, ParameterMeta } from '../config';

// ParameterPanel: Modern card-based UI with auto-generated controls

export type ParameterChange = {
  springFrequency?: number;
  dampingRatio?: number;
  mass?: number;
  restLength?: number;
  interactionStrength?: number;
  gravityX?: number;
  gravityY?: number;
  enableMooneyRivlin?: boolean;
  speed?: number;
  maxFps?: number;
  desiredCellSpacing?: number;
  desiredNumCols?: number;
  desiredNumRows?: number;
  margin?: number;
  globalMass?: number;
  globalRestLength?: number;
  globalInteractionStrength?: number;
  gravity?: { x: number; y: number };
};

interface ControlElement extends HTMLElement {
  getValue: () => any;
  setValue: (value: any) => void;
}

export class ParameterPanel {
  private container: HTMLElement;
  private controls: Record<string, ControlElement> = {};
  private listeners: ((change: ParameterChange) => void)[] = [];
  private eventBus?: EventBus;

  constructor(container: HTMLElement, simState: StateManager<{ smoothingFrames: number }>, eventBus?: EventBus) {
    this.container = container;
    this.eventBus = eventBus;
    
    // Clear container and build modern card-based UI
    this.container.innerHTML = '';
    this.container.className = 'parameter-panel-container';
    
    // Group parameters by their group property
    const groups = this.groupParameters();
    
    // Create card for each group
    for (const [groupName, params] of groups) {
      this.createParameterCard(groupName, params);
    }
    
    // Add restore defaults button
    this.createRestoreButton(simState);
    
    // Attach all event listeners
    this.attachListeners(simState);
  }

  private groupParameters(): Map<string, Array<[string, ParameterMeta]>> {
    const groups = new Map<string, Array<[string, ParameterMeta]>>();
    
    for (const [key, meta] of Object.entries(PARAMETER_SCHEMA)) {
      if (!groups.has(meta.group)) {
        groups.set(meta.group, []);
      }
      groups.get(meta.group)!.push([key, meta]);
    }
    
    return groups;
  }

  private createParameterCard(groupName: string, params: Array<[string, ParameterMeta]>) {
    const card = document.createElement('div');
    card.className = 'parameter-card';
    
    // Card header (clickable to expand/collapse)
    const header = document.createElement('div');
    header.className = 'parameter-card-header';
    
    const groupIcon = this.getGroupIcon(groupName);
    
    // Start with Physics expanded, others collapsed
    const isExpanded = groupName === 'Physics';
    
    header.innerHTML = `
      <div class="card-header-left">
        <span class="material-icons card-icon">${groupIcon}</span>
        <h3 class="card-title">${groupName}</h3>
      </div>
      <span class="material-icons card-toggle-icon ${isExpanded ? 'expanded' : ''}">expand_more</span>
    `;
    
    // Card content
    const content = document.createElement('div');
    content.className = `parameter-card-content ${isExpanded ? 'expanded' : ''}`;
    
    // Create controls for each parameter in this group
    for (const [key, meta] of params) {
      const control = this.createControl(key, meta);
      content.appendChild(control);
    }
    
    // Add click handler for expand/collapse
    header.addEventListener('click', () => {
      const toggleIcon = header.querySelector('.card-toggle-icon') as HTMLElement;
      const isCurrentlyExpanded = content.classList.contains('expanded');
      
      if (isCurrentlyExpanded) {
        content.classList.remove('expanded');
        toggleIcon.classList.remove('expanded');
      } else {
        content.classList.add('expanded');
        toggleIcon.classList.add('expanded');
      }
    });
    
    card.appendChild(header);
    card.appendChild(content);
    this.container.appendChild(card);
  }

  private getGroupIcon(groupName: string): string {
    const icons: Record<string, string> = {
      'Physics': 'science',
      'Scene': 'view_in_ar'
    };
    return icons[groupName] || 'settings';
  }

  private createControl(key: string, meta: ParameterMeta): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'control-wrapper';
    
    switch (meta.type) {
      case 'slider':
        return this.createSliderControl(key, meta, wrapper);
      case 'toggle':
        return this.createToggleControl(key, meta, wrapper);
      case 'vector2':
        return this.createVector2Control(key, meta, wrapper);
      default:
        throw new Error(`Unknown parameter type: ${meta.type}`);
    }
  }

  private createSliderControl(key: string, meta: ParameterMeta, wrapper: HTMLElement): HTMLElement {
    const defaultValue = this.getDefaultValue(key);
    
    wrapper.innerHTML = `
      <div class="control-header">
        <div class="control-label" title="${meta.description}">
          <span class="material-icons control-icon">${meta.icon || 'tune'}</span>
          <span class="label-text">${meta.label}</span>
          ${meta.unit ? `<span class="unit-text">(${meta.unit})</span>` : ''}
        </div>
        <span class="control-value">${defaultValue}</span>
      </div>
      <div class="slider-container">
        <input type="range" 
               class="slider-input" 
               min="${meta.min}" 
               max="${meta.max}" 
               step="${meta.step}" 
               value="${defaultValue}">
      </div>
    `;
    
    const slider = wrapper.querySelector('.slider-input') as HTMLInputElement;
    const valueDisplay = wrapper.querySelector('.control-value') as HTMLElement;
    
    // Update value display on input
    slider.addEventListener('input', () => {
      valueDisplay.textContent = slider.value;
    });
    
    // Create control interface
    const control = wrapper as ControlElement;
    control.getValue = () => parseFloat(slider.value);
    control.setValue = (value: number) => {
      slider.value = value.toString();
      valueDisplay.textContent = value.toString();
    };
    
    this.controls[key] = control;
    return wrapper;
  }

  private createToggleControl(key: string, meta: ParameterMeta, wrapper: HTMLElement): HTMLElement {
    const defaultValue = this.getDefaultValue(key);
    
    wrapper.innerHTML = `
      <div class="control-header">
        <div class="control-label" title="${meta.description}">
          <span class="material-icons control-icon">${meta.icon || 'toggle_on'}</span>
          <span class="label-text">${meta.label}</span>
        </div>
        <label class="toggle-switch">
          <input type="checkbox" class="toggle-input" ${defaultValue ? 'checked' : ''}>
          <span class="toggle-slider"></span>
        </label>
      </div>
    `;
    
    const checkbox = wrapper.querySelector('.toggle-input') as HTMLInputElement;
    
    // Create control interface
    const control = wrapper as ControlElement;
    control.getValue = () => checkbox.checked;
    control.setValue = (value: boolean) => {
      checkbox.checked = value;
    };
    
    this.controls[key] = control;
    return wrapper;
  }

  private createVector2Control(key: string, meta: ParameterMeta, wrapper: HTMLElement): HTMLElement {
    const defaultValue = this.getDefaultValue(key) as { x: number; y: number };
    
    wrapper.innerHTML = `
      <div class="control-header">
        <div class="control-label" title="${meta.description}">
          <span class="material-icons control-icon">${meta.icon || 'open_with'}</span>
          <span class="label-text">${meta.label}</span>
          ${meta.unit ? `<span class="unit-text">(${meta.unit})</span>` : ''}
        </div>
      </div>
      <div class="vector2-container">
        <div class="vector2-component">
          <label class="component-label">X</label>
          <input type="range" 
                 class="slider-input x-input" 
                 min="${meta.min}" 
                 max="${meta.max}" 
                 step="${meta.step}" 
                 value="${defaultValue.x}">
          <span class="component-value x-value">${defaultValue.x}</span>
        </div>
        <div class="vector2-component">
          <label class="component-label">Y</label>
          <input type="range" 
                 class="slider-input y-input" 
                 min="${meta.min}" 
                 max="${meta.max}" 
                 step="${meta.step}" 
                 value="${defaultValue.y}">
          <span class="component-value y-value">${defaultValue.y}</span>
        </div>
      </div>
    `;
    
    const xSlider = wrapper.querySelector('.x-input') as HTMLInputElement;
    const ySlider = wrapper.querySelector('.y-input') as HTMLInputElement;
    const xValue = wrapper.querySelector('.x-value') as HTMLElement;
    const yValue = wrapper.querySelector('.y-value') as HTMLElement;
    
    // Update value displays
    xSlider.addEventListener('input', () => {
      xValue.textContent = xSlider.value;
    });
    ySlider.addEventListener('input', () => {
      yValue.textContent = ySlider.value;
    });
    
    // Create control interface
    const control = wrapper as ControlElement;
    control.getValue = () => ({
      x: parseFloat(xSlider.value),
      y: parseFloat(ySlider.value)
    });
    control.setValue = (value: { x: number; y: number }) => {
      xSlider.value = value.x.toString();
      ySlider.value = value.y.toString();
      xValue.textContent = value.x.toString();
      yValue.textContent = value.y.toString();
    };
    
    this.controls[key] = control;
    return wrapper;
  }

  private getDefaultValue(key: string): any {
    // Map config values to parameter keys
    const configMap: Record<string, any> = {
      springFrequency: SIM_CONFIG.springFrequency,
      dampingRatio: SIM_CONFIG.dampingRatio,
      globalMass: SIM_CONFIG.globalMass,
      globalRestLength: SIM_CONFIG.globalRestLength,
      globalInteractionStrength: SIM_CONFIG.globalInteractionStrength,
      enableMooneyRivlin: SIM_CONFIG.enableMooneyRivlin,
      gravity: SIM_CONFIG.gravity,
      desiredCellSpacing: SIM_CONFIG.desiredCellSpacing,
      desiredNumCols: SIM_CONFIG.desiredNumCols,
      desiredNumRows: SIM_CONFIG.desiredNumRows,
      margin: SIM_CONFIG.margin,
      speed: 1,
      maxFps: SIM_CONFIG.maxFps
    };
    
    return configMap[key] ?? 0;
  }

  private createRestoreButton(simState: StateManager<{ smoothingFrames: number }>) {
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'restore-button-container';
    
    const restoreBtn = document.createElement('button');
    restoreBtn.className = 'restore-button';
    restoreBtn.innerHTML = `
      <span class="material-icons">settings_backup_restore</span>
      <span>Restore Defaults</span>
    `;
    
    restoreBtn.onclick = () => {
      this.restoreDefaults(simState);
    };
    
    buttonContainer.appendChild(restoreBtn);
    this.container.appendChild(buttonContainer);
  }

  private restoreDefaults(simState: StateManager<{ smoothingFrames: number }>) {
    // Restore all controls to default values
    for (const [key, control] of Object.entries(this.controls)) {
      const defaultValue = this.getDefaultValue(key);
      control.setValue(defaultValue);
    }
    
    // Emit parameter change event
    const changes: ParameterChange = {
      springFrequency: SIM_CONFIG.springFrequency,
      dampingRatio: SIM_CONFIG.dampingRatio,
      globalMass: SIM_CONFIG.globalMass,
      globalRestLength: SIM_CONFIG.globalRestLength,
      globalInteractionStrength: SIM_CONFIG.globalInteractionStrength,
      gravityX: SIM_CONFIG.gravity.x,
      gravityY: SIM_CONFIG.gravity.y,
      enableMooneyRivlin: SIM_CONFIG.enableMooneyRivlin,
      speed: 1,
      maxFps: SIM_CONFIG.maxFps,
      desiredCellSpacing: SIM_CONFIG.desiredCellSpacing,
      desiredNumCols: SIM_CONFIG.desiredNumCols,
      desiredNumRows: SIM_CONFIG.desiredNumRows,
      margin: SIM_CONFIG.margin
    };
    
    simState.set({ smoothingFrames: 5 });
    this.eventBus?.emit('parameterChange', changes);
  }

  private attachListeners(simState: StateManager<{ smoothingFrames: number }>) {
    // Attach listeners to all controls
    for (const [key, control] of Object.entries(this.controls)) {
      const meta = PARAMETER_SCHEMA[key];
      
      if (meta.type === 'vector2') {
        // Special handling for vector2 controls
        const wrapper = control;
        const xSlider = wrapper.querySelector('.x-input') as HTMLInputElement;
        const ySlider = wrapper.querySelector('.y-input') as HTMLInputElement;
        
        const emitVectorChange = () => {
          const value = control.getValue();
          this.eventBus?.emit('parameterChange', {
            gravityX: value.x,
            gravityY: value.y
          });
        };
        
        xSlider.addEventListener('input', emitVectorChange);
        ySlider.addEventListener('input', emitVectorChange);
      } else {
        // Regular controls
        const input = control.querySelector('input') as HTMLInputElement;
        input.addEventListener(meta.type === 'toggle' ? 'change' : 'input', () => {
          const value = control.getValue();
          
          // Special handling for speed parameter
          if (key === 'speed') {
            simState.set({ smoothingFrames: Number(value) });
          }
          
          this.eventBus?.emit('parameterChange', { [key]: value });
        });
      }
    }
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
    // Update controls based on parameter changes
    for (const [key, value] of Object.entries(params)) {
      if (this.controls[key] && value !== undefined) {
        // Handle special cases
        if (key === 'gravity' && typeof value === 'object') {
          this.controls[key].setValue(value);
        } else if (key === 'gravityX' || key === 'gravityY') {
          // Update gravity vector control
          if (this.controls['gravity']) {
            const currentGravity = this.controls['gravity'].getValue();
            if (key === 'gravityX') {
              this.controls['gravity'].setValue({ x: value as number, y: currentGravity.y });
            } else {
              this.controls['gravity'].setValue({ x: currentGravity.x, y: value as number });
            }
          }
        } else {
          this.controls[key].setValue(value);
        }
      }
    }
    
    this.emit(params as ParameterChange);
  }
}
