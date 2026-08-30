/**
 * TypedEmitter — type-safe event emitter with on/off/once/emit/listenerCount.
 * Compiles with: tsc --strict --target ES2020 --module commonjs event_emitter.ts
 * No external dependencies.
 */

type Listener<T> = (data: T) => void;

export class TypedEmitter<Events extends Record<string, unknown>> {
  private listeners: Map<string, Listener<unknown>[]> = new Map();

  on<K extends keyof Events>(event: K, listener: Listener<Events[K]>): this {
    const key = event as string;
    if (!this.listeners.has(key)) {
      this.listeners.set(key, []);
    }
    this.listeners.get(key)!.push(listener as Listener<unknown>);
    return this;
  }

  off<K extends keyof Events>(event: K, listener: Listener<Events[K]>): this {
    const key = event as string;
    const arr = this.listeners.get(key);
    if (!arr) return this;
    const idx = arr.indexOf(listener as Listener<unknown>);
    if (idx !== -1) {
      arr.splice(idx, 1);
    }
    return this;
  }

  once<K extends keyof Events>(event: K, listener: Listener<Events[K]>): this {
    const key = event as string;
    const wrapped: Listener<unknown> = (data: unknown) => {
      this.off(event, wrapped as Listener<Events[K]>);
      listener(data as Events[K]);
    };
    return this.on(event, wrapped as Listener<Events[K]>);
  }

  emit<K extends keyof Events>(event: K, data: Events[K]): boolean {
    const key = event as string;
    const arr = this.listeners.get(key);
    if (!arr || arr.length === 0) return false;
    for (const listener of arr) {
      listener(data);
    }
    return true;
  }

  listenerCount<K extends keyof Events>(event: K): number {
    const key = event as string;
    return (this.listeners.get(key) || []).length;
  }
}
