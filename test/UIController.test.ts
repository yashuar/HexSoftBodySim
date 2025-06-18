import { UIController } from '../src/presentation/UIController';
import { StateManager } from '../src/infrastructure/StateManager';

describe('UIController', () => {
  let container: HTMLElement;
  let simState: StateManager<any>;
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    simState = new StateManager({ maskRegions: [], defaultParams: { mass: 1, stiffness: 1, damping: 0.1 }, smoothingFrames: 5 });
  });
  afterEach(() => {
    document.body.removeChild(container);
  });

  it('can be constructed and attaches to the DOM', () => {
    const controller = new UIController(container, simState as any);
    expect(controller).toBeInstanceOf(UIController);
  });

  // Add more UIController-specific tests as needed (e.g., event handling, state sync)
});
