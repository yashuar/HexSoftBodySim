import { ParameterPanel } from '../src/presentation/ParameterPanel';
import { StateManager } from '../src/infrastructure/StateManager';

describe('ParameterPanel (Outcome-Driven)', () => {
  let container: HTMLElement;
  let simState: StateManager<{ defaultParams: { mass: number; stiffness: number; damping: number; }, smoothingFrames: number }>;

  beforeEach(() => {
    container = document.createElement('div');
    // Mock sliders
    const stiffnessSlider = document.createElement('input');
    stiffnessSlider.type = 'range';
    stiffnessSlider.id = 'stiffness-slider';
    container.appendChild(stiffnessSlider);
    const dampingSlider = document.createElement('input');
    dampingSlider.type = 'range';
    dampingSlider.id = 'damping-slider';
    container.appendChild(dampingSlider);
    const speedSlider = document.createElement('input');
    speedSlider.type = 'range';
    speedSlider.id = 'speed-slider';
    container.appendChild(speedSlider);
    document.body.appendChild(container);
    simState = new StateManager({ defaultParams: { mass: 1, stiffness: 1, damping: 0.1 }, smoothingFrames: 5 });
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('reflects state changes in the DOM (sliders)', () => {
    new ParameterPanel(container, simState as any);
    simState.set({ defaultParams: { mass: 2, stiffness: 2, damping: 0.2 }, smoothingFrames: 10 });
    // Outcome-driven: check DOM values as user would see
    expect((document.getElementById('stiffness-slider') as HTMLInputElement).value).toBe('2');
    expect((document.getElementById('damping-slider') as HTMLInputElement).value).toBe('0.2');
    expect((document.getElementById('speed-slider') as HTMLInputElement).value).toBe('10');
  });

  it('updates state when user changes sliders (user-driven)', () => {
    new ParameterPanel(container, simState as any);
    // Simulate user changing the slider
    const stiffnessSlider = document.getElementById('stiffness-slider') as HTMLInputElement;
    stiffnessSlider.value = '3';
    stiffnessSlider.dispatchEvent(new Event('input'));
    // Outcome-driven: check state as user would observe in UI
    expect(simState.get().defaultParams.stiffness).toBe(3);
    const dampingSlider = document.getElementById('damping-slider') as HTMLInputElement;
    dampingSlider.value = '0.5';
    dampingSlider.dispatchEvent(new Event('input'));
    expect(simState.get().defaultParams.damping).toBe(0.5);
    const speedSlider = document.getElementById('speed-slider') as HTMLInputElement;
    speedSlider.value = '7';
    speedSlider.dispatchEvent(new Event('input'));
    expect(simState.get().smoothingFrames).toBe(7);
  });
});
