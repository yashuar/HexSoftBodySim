// ParameterPanel: UI for displaying and editing simulation/global parameters.

export type ParameterChange = {
  stiffness?: number;
  damping?: number;
  speed?: number;
};

export class ParameterPanel {
  private container: HTMLElement;
  private stiffnessSlider: HTMLInputElement;
  private dampingSlider: HTMLInputElement;
  private speedSlider: HTMLInputElement;
  private listeners: ((change: ParameterChange) => void)[] = [];

  constructor(container: HTMLElement) {
    this.container = container;
    this.stiffnessSlider = document.getElementById('stiffness-slider') as HTMLInputElement;
    this.dampingSlider = document.getElementById('damping-slider') as HTMLInputElement;
    this.speedSlider = document.getElementById('speed-slider') as HTMLInputElement;
    this.attachListeners();
  }

  private attachListeners() {
    if (this.stiffnessSlider) {
      this.stiffnessSlider.addEventListener('input', () => {
        this.emit({ stiffness: parseFloat(this.stiffnessSlider.value) });
      });
    }
    if (this.dampingSlider) {
      this.dampingSlider.addEventListener('input', () => {
        this.emit({ damping: parseFloat(this.dampingSlider.value) });
      });
    }
    if (this.speedSlider) {
      this.speedSlider.addEventListener('input', () => {
        this.emit({ speed: parseFloat(this.speedSlider.value) });
      });
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

  update(params: { stiffness: number; damping: number; speed: number }): void {
    if (this.stiffnessSlider) this.stiffnessSlider.value = params.stiffness.toString();
    if (this.dampingSlider) this.dampingSlider.value = params.damping.toString();
    if (this.speedSlider) this.speedSlider.value = params.speed.toString();
  }
}
