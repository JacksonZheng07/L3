/**
 * L³ Event Bus
 * Typed pub/sub for decoupling the core scoring engine from the UI layer.
 */

import type { MintScore, ProbeResult, MigrationEvent } from '../state/types';

// ── Event Map ────────────────────────────────────────────────────────

export interface EventMap {
  'scores:updated': MintScore[];
  'probe:complete': { url: string; result: ProbeResult };
  'migration:started': MigrationEvent;
  'migration:completed': MigrationEvent;
  'error': { message: string };
}

type EventName = keyof EventMap;
type Handler<T> = (payload: T) => void;

// ── Bus Implementation ───────────────────────────────────────────────

class EventBus {
  private listeners = new Map<EventName, Set<Handler<unknown>>>();

  on<K extends EventName>(event: K, handler: Handler<EventMap[K]>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    const set = this.listeners.get(event)!;
    set.add(handler as Handler<unknown>);

    // Return unsubscribe function
    return () => {
      set.delete(handler as Handler<unknown>);
    };
  }

  off<K extends EventName>(event: K, handler: Handler<EventMap[K]>): void {
    this.listeners.get(event)?.delete(handler as Handler<unknown>);
  }

  emit<K extends EventName>(event: K, payload: EventMap[K]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const handler of set) {
      try {
        handler(payload);
      } catch (err) {
        if (event !== 'error') {
          this.emit('error', {
            message: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }
  }

  /** Remove all listeners, optionally for a single event. */
  clear(event?: EventName): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
}

/** Singleton event bus instance shared across the application. */
export const eventBus = new EventBus();
