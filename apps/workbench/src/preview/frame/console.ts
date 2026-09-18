/**
 * What the app said while it was being looked at.
 *
 * The blind spot this closes is specific: a screenshot shows a page that looks
 * finished while the console carries a React warning, a failed image or a
 * swallowed rejection. `TROUBLESHOOTING.md` is largely a list of faults that
 * survived a green build, and several of them announce themselves here and
 * nowhere else.
 *
 * Same-origin makes this a property assignment rather than a protocol: the
 * frame's `console` is an object this page can reach. The originals are always
 * called, so the browser's own DevTools sees exactly what it saw before.
 *
 * **Nothing collected here is a message, and that is a decision.** A row in the
 * console panel is a transcript of what the app said — a React warning, a failed
 * request, a stack trace — and the app's own source is English, so the row is
 * English however this site is set. The one word this file contributes is the
 * `Unhandled rejection:` in front of a rejected promise, and it names the browser
 * event that produced the row, beside the `error` and `warn` the panel prints in
 * their own spelling for the same reason. A German word in front of an English
 * stack trace would be the half-translated line
 * [ADR 0052](../../../../../adr/0052-the-sites-own-words-follow-the-setting.md)
 * exists to stop, with the halves the other way round; it would also stop matching
 * what somebody types into the panel's filter, which they type in English because
 * the thing they are looking for is.
 */
export type Level = 'error' | 'warn';

export interface LogEntry {
  id: number;
  level: Level;
  text: string;
  at: number;
}

const MARKER = '__previewPatched';

let counter = 0;

/**
 * An Error, whatever realm it was thrown in.
 *
 * `instanceof Error` is the obvious spelling and is wrong here for the same
 * reason it was wrong in `locate.ts`: the frame has its own `Error`, so an error
 * the app logged is not an instance of this page's one. It would fall through to
 * `JSON.stringify`, which renders an Error as `{}` — the console panel would show
 * a row that says nothing, which is worse than showing no row.
 */
function isError(value: unknown): value is Error {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Error).message === 'string' &&
    typeof (value as Error).name === 'string'
  );
}

function format(args: unknown[]): string {
  return args
    .map((arg) => {
      if (typeof arg === 'string') return arg;
      if (isError(arg)) return `${arg.name}: ${arg.message}`;
      try {
        // `undefined` for a function or a symbol, which `String()` can name.
        return JSON.stringify(arg) ?? String(arg);
      } catch {
        return String(arg);
      }
    })
    .join(' ')
    .slice(0, 2000);
}

/**
 * Patches the frame's console and its two unhandled-failure paths.
 *
 * Nothing is ever detached: a navigation replaces the frame's global, and with
 * it the console and both listeners. What has to be guarded is the opposite
 * case, attaching twice to one document — the marker does that for the wrappers
 * *and* the listeners, so this can be called as often as anyone likes.
 *
 * Which matters, because `load` is late. The app's own first render, and every
 * warning it emits, happens before the frame fires it. So this is also called
 * from the poll in `Preview.tsx`, which reaches a booting document that the load
 * handler alone would only meet after the fact.
 */
export function attachConsole(win: Window | null, onEntry: (entry: LogEntry) => void): void {
  if (!win) return;

  const emit = (level: Level, text: string) => {
    if (text) onEntry({ id: ++counter, level, text, at: Date.now() });
  };

  try {
    const target = (win as Window & typeof globalThis).console as Console & {
      [MARKER]?: boolean;
    };
    if (target[MARKER]) return;
    target[MARKER] = true;

    for (const level of ['error', 'warn'] as const) {
      const original = target[level].bind(target);
      target[level] = (...args: unknown[]) => {
        emit(level, format(args));
        original(...args);
      };
    }

    win.addEventListener('error', (event) => {
      emit('error', event.message || String(event.error));
    });
    win.addEventListener('unhandledrejection', (event) => {
      emit('error', `Unhandled rejection: ${format([event.reason])}`);
    });
  } catch {
    // The frame navigated away mid-attach. The next load attaches again.
  }
}
