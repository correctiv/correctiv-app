import { DEVICES } from './devices';
import { wbMessage, type WorkbenchMessage } from '../i18n/messages';
import type { LogEntry } from './frame/console';
import { activeScheme, appTheme, frameRoute, frameScheme, handleOf } from './frame/handle';
import { audit } from './frame/measure';
import { waitNavigation, waitReady } from './frame/ready';
import { FIXTURES } from './frame/seed';
import type { Scheme } from './frame/tokens';
import { getLogs } from './logs';
import { ROUTES } from './routes';
import type { PreviewState, ThemeSetting } from './state';
import { getState, set } from './store';

/**
 * `window.preview` — the shell, as something other than a person can drive it.
 *
 * Everything here goes through the same `store.set()` the toolbar uses, which is
 * the point: an automated walk and a human walk cannot end up looking at
 * different things.
 *
 * A caller outside this page works in three verbs — say what you want, wait
 * until it is on screen, ask what is actually there — and those are `set`,
 * `ready` and `get`. The rest is the vocabulary those three take (`devices`,
 * `routes`, `fixtures`) and what the frame has to say for itself (`logs`,
 * `audit`).
 *
 * `set()` resolving only after the frame has settled is the part worth keeping.
 * It turns "navigate, then sleep 2000, then screenshot" into one await, and it
 * is the difference between a screenshot of the app and a screenshot of its
 * first paint.
 *
 * **Nothing here is formatted for a reader.** A device's label, a fixture's label
 * and hint, and a finding's sentence all leave as descriptors — an id and an
 * English `defaultMessage` — rather than as whatever language the person at the
 * keyboard has this site set to. A caller that matches on a word therefore goes on
 * matching after somebody switches the setting, which is the same reason the three
 * verbs read the store rather than the screen
 * ([ADR 0052](../../../../adr/0052-the-sites-own-words-follow-the-setting.md) §1).
 */
export interface FrameInfo {
  /** Whether the app left a dev handle behind; false in the static export. */
  handle: boolean;
  /** What the app's own setting says, read back out of its store. */
  appTheme: ThemeSetting | null;
  /** What the device reports, measured inside the frame. */
  scheme: Scheme | null;
  /** Which palette is painted, i.e. the setting with `'system'` resolved. */
  active: Scheme;
}

export interface Status extends PreviewState, FrameInfo {
  /** Which of the four appearance combinations is on screen. */
  combination: number | null;
  /** Where the frame actually is, which a tap inside the app can change. */
  frameRoute: string | undefined;
  warnings: number;
  errors: number;
}

export interface PreviewApi {
  get(): Status;
  set(patch: Partial<PreviewState>): Promise<Status>;
  ready(): Promise<void>;
  devices(): typeof DEVICES;
  routes(): typeof ROUTES;
  fixtures(): { id: string; label: WorkbenchMessage; hint: WorkbenchMessage }[];
  logs(): ReturnType<typeof getLogs>;
  /** Runs the measure checks now and returns them, without touching the panel. */
  audit(): ReturnType<typeof audit>;
}

/** Nothing read back yet: the static export's answer, and the shell's until it has one. */
export const NO_FRAME: FrameInfo = { handle: false, appTheme: null, scheme: null, active: 'light' };

let frame: HTMLIFrameElement | null = null;

/** Called once by the App, which owns the element. */
export function registerFrame(el: HTMLIFrameElement | null): void {
  frame = el;
}

/**
 * One `Status`, assembled from things nobody holds all of at once.
 *
 * The App passes what the poll last saw, because React has to re-render when
 * that changes. `window.preview` passes a fresh read instead: a caller that has
 * just awaited `set()` is asking what is on screen *now*, and an answer up to
 * one poll tick out of date is exactly the "the automation and the person
 * disagree about what is on screen" this tool exists to prevent.
 */
export function statusOf(
  state: PreviewState,
  info: FrameInfo,
  route: string | undefined,
  logs: LogEntry[],
): Status {
  return {
    ...state,
    ...info,
    combination: combinationOf(info.appTheme, info.scheme),
    frameRoute: route,
    warnings: logs.filter((l) => l.level === 'warn').length,
    errors: logs.filter((l) => l.level === 'error').length,
  };
}

function liveStatus(): Status {
  const win = frame?.contentWindow ?? null;
  return statusOf(getState(), frame ? readFrame(win) : NO_FRAME, frameRoute(win), getLogs());
}

/**
 * The four combinations `TROUBLESHOOTING.md` insists on, numbered as it numbers
 * them: the two explicit settings, then `system` against each device scheme.
 * Four is the one that has already shipped broken, and it is also the default.
 *
 * One table rather than three. The buttons, the readout and this numbering all
 * name the same four things, and named separately they would disagree the first
 * time one of them was reworded.
 */
export const COMBINATIONS: {
  n: number;
  label: WorkbenchMessage;
  theme: ThemeSetting;
  /** Absent where the setting alone decides, i.e. 1 and 2. */
  scheme?: Scheme;
  isDefault?: boolean;
}[] = [
  {
    n: 1,
    label: wbMessage({
      id: 'tools.appearance.combination.1',
      defaultMessage: 'Setting light',
      description:
        'The first of the four appearance combinations: the app’s own setting explicitly on light, whatever the device reports. “light” is the literal value of that setting, printed in its own spelling two rows above in the same panel, and is not translated.',
    }),
    theme: 'light',
  },
  {
    n: 2,
    label: wbMessage({
      id: 'tools.appearance.combination.2',
      defaultMessage: 'Setting dark',
      description:
        'The second of the four appearance combinations: the app’s own setting explicitly on dark, whatever the device reports. “dark” is the literal value of that setting and is not translated.',
    }),
    theme: 'dark',
  },
  {
    n: 3,
    label: wbMessage({
      id: 'tools.appearance.combination.3',
      defaultMessage: 'System · light device',
      description:
        'The third of the four appearance combinations: the app’s setting on system, against a device reporting light. Both “system” and “light” are literal values and are not translated.',
    }),
    theme: 'system',
    scheme: 'light',
  },
  {
    n: 4,
    label: wbMessage({
      id: 'tools.appearance.combination.4',
      defaultMessage: 'System · dark device',
      description:
        'The fourth of the four appearance combinations, and the app’s default: the setting on system, against a device reporting dark. This is the one that has already shipped broken. Both “system” and “dark” are literal values and are not translated.',
    }),
    theme: 'system',
    scheme: 'dark',
    isDefault: true,
  },
];

export function combinationOf(setting: ThemeSetting | null, scheme: Scheme | null): number | null {
  const hit = COMBINATIONS.find(
    (c) => c.theme === setting && (c.scheme === undefined || c.scheme === scheme),
  );
  return hit?.n ?? null;
}

export function readFrame(win: Window | null): FrameInfo {
  return {
    handle: handleOf(win) !== null,
    appTheme: appTheme(win),
    scheme: frameScheme(win),
    active: activeScheme(win),
  };
}

/**
 * Whether this patch will point the frame somewhere new.
 *
 * It mirrors the condition in `Preview.tsx`, which is the code that actually
 * navigates: a fixture has to be in storage before the app boots, so a new one
 * costs a load, and so does a route the frame is not already showing.
 */
function willNavigate(el: HTMLIFrameElement, before: PreviewState, next: PreviewState): boolean {
  return (
    (next.seed !== null && next.seed !== before.seed) || frameRoute(el.contentWindow) !== next.route
  );
}

export function install(): void {
  const api: PreviewApi = {
    get: () => liveStatus(),
    async set(patch) {
      const before = getState();
      const next = set(patch);
      const el = frame;
      // Waited for from HERE, before anything else can look at the frame: the
      // navigation this patch causes is issued by an effect a render later, so
      // right now the frame still shows the page it is about to leave and its
      // `readyState` still says `complete`. `waitReady()` on its own would
      // settle against that outgoing document and hand back a screenshot of it.
      if (el && willNavigate(el, before, next)) await waitNavigation(el);
      await this.ready();
      return liveStatus();
    },
    ready: async () => {
      if (frame) await waitReady(frame);
    },
    devices: () => DEVICES,
    routes: () => ROUTES,
    fixtures: () => FIXTURES.map(({ id, label, hint }) => ({ id, label, hint })),
    logs: () => getLogs(),
    audit: () => audit(frame?.contentWindow ?? null),
  };
  (window as Window & { preview?: PreviewApi }).preview = api;
}

/**
 * Taken away with the view that installed it.
 *
 * The three verbs all answer about a frame, and there is no frame on any other
 * view of this site. Left in place, `set()` would resolve against nothing and
 * `get()` would report a device the reader cannot see, which is the automation
 * and the person disagreeing about what is on screen.
 */
export function uninstall(): void {
  delete (window as Window & { preview?: PreviewApi }).preview;
}
