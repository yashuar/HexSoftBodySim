// Simple state management for UI and simulation
// StateManager.ts

export type StateListener<T> = (state: T) => void;

export class StateManager<T> {
  private state: T;
  private listeners: Set<StateListener<T>> = new Set();

  constructor(initial: T) {
    this.state = initial;
  }

  get(): T {
    return this.state;
  }

  set(newState: Partial<T>) {
    this.state = { ...this.state, ...newState };
    this.emit();
  }

  subscribe(listener: StateListener<T>) {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  private emit() {
    for (const l of this.listeners) l(this.state);
  }
}
