import { StateManager } from '../src/infrastructure/StateManager';

describe('StateManager (Outcome-Driven)', () => {
  it('returns initial state and updates state with set(), observable via get()', () => {
    const sm = new StateManager({ a: 1, b: 2 });
    expect(sm.get()).toEqual({ a: 1, b: 2 });
    sm.set({ b: 3 });
    expect(sm.get()).toEqual({ a: 1, b: 3 });
  });

  it('notifies listeners on state change, observable via callback', () => {
    const sm = new StateManager({ x: 0 });
    const calls: any[] = [];
    sm.subscribe(s => calls.push(s.x));
    sm.set({ x: 1 });
    sm.set({ x: 2 });
    expect(calls).toEqual([0, 1, 2]);
  });

  it('unsubscribes listeners, observable via callback', () => {
    const sm = new StateManager({ y: 0 });
    const calls: any[] = [];
    const unsub = sm.subscribe(s => calls.push(s.y));
    sm.set({ y: 1 });
    unsub();
    sm.set({ y: 2 });
    expect(calls).toEqual([0, 1]);
  });
});
