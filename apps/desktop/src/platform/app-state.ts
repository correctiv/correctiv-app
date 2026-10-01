// `AppState`, answered from the windows rather than from a lifecycle this host lacks.
//
// The one reader is `useHomeLayoutRefresh`, which re-fetches the home document when the
// app returns to the foreground. A desktop has no "foreground" in Android's sense; the
// nearest true thing is that one of the app's windows holds the compositor's focus, and
// `notify::is-active` is GTK's signal for it. The app is `active` while ANY toplevel is
// active, so moving from the main window to the video stage window is not a leave.
//
// Alt-tabbing away and back therefore reports `background` then `active`, and the
// caller refreshes. That is cheap by construction: the core's thunk keeps a ten-minute
// floor between tries, which is the reason it may be asked as often as it likes.
//
// The window lookup is injected, so this file imports no `gi://` and the vitest run can
// feed it fakes. `foreground.ts` supplies the GTK one.
//
// fixed upstream in gjsify: #1343 — `AppState` is tier P3 in the layer's support table;
// once the layer routes it from the window, this file and the shim's export go.

export type AppStateStatus = 'active' | 'background';

/** The slice of `Gtk.Window` this needs. */
export interface ActivityWindow {
  readonly is_active: boolean;
  connect(signal: 'notify::is-active', handler: () => void): number;
  disconnect(id: number): void;
}

export interface AppStateSubscription {
  remove(): void;
}

export interface AppStateLike {
  readonly currentState: AppStateStatus;
  addEventListener(event: 'change', handler: (state: AppStateStatus) => void): AppStateSubscription;
}

export function createAppState(windows: () => readonly ActivityWindow[]): AppStateLike {
  const anyActive = (): boolean => windows().some((window) => window.is_active);

  return {
    get currentState(): AppStateStatus {
      return anyActive() ? 'active' : 'background';
    },

    addEventListener(_event, handler) {
      const watched = windows();
      let last = anyActive();
      const ids = watched.map((window) =>
        window.connect('notify::is-active', () => {
          const now = anyActive();
          if (now === last) return;
          last = now;
          handler(now ? 'active' : 'background');
        }),
      );
      return {
        remove(): void {
          watched.forEach((window, index) => window.disconnect(ids[index]));
        },
      };
    },
  };
}
