import { parseAddress } from '../shell/address';
import { VIEWS } from '../shell/views';
import { defaultDevice } from './devices';
import { fromAddress, INITIAL, type PreviewState } from './state';

/**
 * The frame's own state, in one place, with the URL as its only persistence.
 *
 * There is deliberately no second path: the toolbar, the keyboard and
 * `window.preview` (see `api.ts`) all go through `set()`. A control that wrote
 * its own DOM and a script that wrote the state would drift apart within a week,
 * and the drift would show up as "the automation and the person disagree about
 * what is on screen", which is the one thing this tool exists to prevent.
 *
 * **It no longer writes the address.** It used to, behind an `owning` flag, which
 * was this file knowing that the shell had other views and that the hash belonged
 * to them while one was open. The shell owns the hash on every route now
 * (`shell/address.ts`), and `pages/Preview.tsx` is the one place the two are
 * joined: state out through `toAddress`, address in through `fromAddress`. The
 * flag is gone with the thing it was guarding against.
 */
type Listener = () => void;

let state: PreviewState = INITIAL;
const listeners = new Set<Listener>();

/**
 * Whether a device was ever asked for, by a link or by a person.
 *
 * Until one is, the host's own size decides, so a phone opens the app at the
 * phone's size instead of drawing a smaller phone inside it. After one is, that
 * choice stands for the session: coming back to the view must not quietly undo
 * what somebody picked.
 */
let deviceAsked = false;

function notify(): void {
  for (const listener of listeners) listener();
}

export function getState(): PreviewState {
  return state;
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function set(patch: Partial<PreviewState>): PreviewState {
  const next = { ...state, ...patch };
  if (
    Object.keys(patch).every((k) =>
      Object.is(state[k as keyof PreviewState], next[k as keyof PreviewState]),
    )
  ) {
    return state;
  }
  if (patch.device !== undefined) deviceAsked = true;
  state = next;
  notify();
  return state;
}

/**
 * Whether the address said anything about the frame, which outranks the host.
 *
 * Either parameter counts. A link carrying `full=1` and no device is somebody
 * saying "the app, on its own"; answering that by also overriding the device
 * would be reading half a sentence.
 */
export function namesFrame(hash: string): boolean {
  const cut = hash.indexOf('?');
  if (cut === -1) return false;
  const p = new URLSearchParams(hash.slice(cut + 1));
  return p.has('d') || p.has('full');
}

/**
 * Take the address on the way in, and follow it while the view is open.
 *
 * A hash on arrival is an instruction, which is the whole point of the link. An
 * empty one means this is a return visit within the session, so what the state
 * already holds stands rather than being reset to the defaults.
 *
 * The `hashchange` listener stays, and only a person editing the address bar or a
 * step through history reaches it: `shell/address.ts` writes with `replaceState`,
 * which fires no event, so the page's own writes cannot come back round here.
 */
export function start(): () => void {
  const view = VIEWS.preview;
  if (location.hash) state = fromAddress(parseAddress(location.hash, view));
  if (namesFrame(location.hash)) deviceAsked = true;
  if (!deviceAsked) state = { ...state, device: defaultDevice() };
  notify();

  const onHash = () => {
    state = fromAddress(parseAddress(location.hash, view));
    notify();
  };
  window.addEventListener('hashchange', onHash);

  return () => window.removeEventListener('hashchange', onHash);
}
