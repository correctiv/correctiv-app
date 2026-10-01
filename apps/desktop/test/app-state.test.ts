/**
 * `AppState` from the windows (`src/platform/app-state.ts`).
 *
 * The logic is tested against fake windows because there is no GTK in `npm run check`;
 * that `foreground.ts` hands it the real toplevels, and that `notify::is-active` fires on
 * the compositor's focus, is what a run on a display shows, not this file.
 */

import { describe, expect, it } from 'vitest';

import { createAppState, type ActivityWindow } from '../src/platform/app-state';

class FakeWindow implements ActivityWindow {
  is_active = false;
  private readonly handlers = new Map<number, () => void>();
  private next = 1;

  connect(_signal: 'notify::is-active', handler: () => void): number {
    const id = this.next++;
    this.handlers.set(id, handler);
    return id;
  }

  disconnect(id: number): void {
    this.handlers.delete(id);
  }

  get listeners(): number {
    return this.handlers.size;
  }

  focus(active: boolean): void {
    this.is_active = active;
    for (const handler of this.handlers.values()) handler();
  }
}

describe('createAppState', () => {
  it('reports the state of the windows it is asked about', () => {
    const window = new FakeWindow();
    const state = createAppState(() => [window]);
    expect(state.currentState).toBe('background');
    window.is_active = true;
    expect(state.currentState).toBe('active');
  });

  it('tells a listener when the window is active again, and when it is not', () => {
    const window = new FakeWindow();
    const seen: string[] = [];
    createAppState(() => [window]).addEventListener('change', (next) => seen.push(next));
    window.focus(true);
    window.focus(false);
    window.focus(true);
    expect(seen).toEqual(['active', 'background', 'active']);
  });

  it('does not repeat a state it already reported', () => {
    const window = new FakeWindow();
    const seen: string[] = [];
    createAppState(() => [window]).addEventListener('change', (next) => seen.push(next));
    window.focus(true);
    window.focus(true);
    expect(seen).toEqual(['active']);
  });

  it('treats a move between the app’s own windows as staying in the foreground', () => {
    const main = new FakeWindow();
    const stage = new FakeWindow();
    main.is_active = true;
    const seen: string[] = [];
    createAppState(() => [main, stage]).addEventListener('change', (next) => seen.push(next));
    main.focus(false);
    stage.focus(true);
    expect(seen).toEqual(['background', 'active']);
  });

  it('stops listening on remove(), on every window it connected to', () => {
    const main = new FakeWindow();
    const stage = new FakeWindow();
    const seen: string[] = [];
    const subscription = createAppState(() => [main, stage]).addEventListener('change', (next) =>
      seen.push(next),
    );
    expect(main.listeners + stage.listeners).toBe(2);
    subscription.remove();
    expect(main.listeners + stage.listeners).toBe(0);
    main.focus(true);
    expect(seen).toEqual([]);
  });
});
