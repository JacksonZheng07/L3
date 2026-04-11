import type { AppEvent } from '../state/types';

type Handler = (event: AppEvent) => void;

const handlers: Map<string, Set<Handler>> = new Map();
const eventLog: AppEvent[] = [];

export const eventBus = {
  publish(event: AppEvent): void {
    eventLog.push(event);
    const subscribers = handlers.get(event.type);
    if (subscribers) {
      subscribers.forEach(fn => fn(event));
    }
  },

  subscribe(type: AppEvent['type'], handler: Handler): () => void {
    if (!handlers.has(type)) {
      handlers.set(type, new Set());
    }
    handlers.get(type)!.add(handler);

    return () => {
      handlers.get(type)?.delete(handler);
    };
  },

  getLog(): AppEvent[] {
    return [...eventLog];
  },
};
