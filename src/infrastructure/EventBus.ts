// EventBus.ts
// Minimal event bus for decoupled communication

export type EventHandler<T = any> = (payload: T) => void;

export class EventBus {
  private listeners: Map<string, Set<EventHandler>> = new Map();

  on<T = any>(event: string, handler: EventHandler<T>) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(handler as EventHandler);
    return () => this.listeners.get(event)!.delete(handler as EventHandler);
  }

  off<T = any>(event: string, handler: EventHandler<T>) {
    this.listeners.get(event)?.delete(handler as EventHandler);
  }

  emit<T = any>(event: string, payload: T) {
    for (const handler of this.listeners.get(event) ?? []) {
      try {
        handler(payload);
      } catch (err) {
        // Optionally log or re-emit error
        console.error(`[EventBus] Handler error for event '${event}':`, err);
      }
    }
  }
}
