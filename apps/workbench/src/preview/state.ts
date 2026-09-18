import { parseTimeOfDay } from '@correctiv/app-core/lib/home-layout';
import type { Locale } from '@correctiv/app-core/stores/settings';

import type { ShellAddress } from '../shell/address';
import { DEFAULT_DEVICE, DEVICES, HOST_DEVICE, preset } from './devices';
import { isLocale } from './frame/locale';
import { TOKENS, type Overrides, type Scheme } from './frame/tokens';

/** The app's own appearance setting. `null` means "leave the app alone". */
export type ThemeSetting = 'system' | 'light' | 'dark';

/** Everything the shell can be told to do, and everything it puts in the URL. */
export interface PreviewState {
  route: string;
  device: string;
  /**
   * The frame turned a quarter from the way its size is written down, which is
   * landscape for everything written portrait-first and portrait for the two
   * presets that are not. `o=l` in the address is this, and `Toolbar` names the
   * orientation from `frameSize` rather than from here for that reason.
   */
  landscape: boolean;
  zoom: 'fit' | number;
  /** Only meaningful while `device === 'custom'`. */
  w: number;
  h: number;
  theme: ThemeSetting | null;
  /**
   * The language the framed app is built in, or `null` for the one it ships.
   *
   * Beside the appearance rather than in this site's own settings, which is the split
   * ADR 0050 §4 makes: the reader's language is a fact about the reader and lives in
   * storage, and the app's is a fact about what is on screen. It is also what stops a
   * chosen language becoming durable state nobody can see, exactly as `time` above is —
   * `frame/locale.ts` is the writer, and an address naming no language clears the key.
   *
   * `lg` because `l` alone reads as a `1` in a hash, and it is two letters like the
   * other keys added since the original five.
   */
  lang: Locale | null;
  /** A storage fixture applied before the frame boots; see `frame/seed.ts`. */
  seed: string | null;
  /**
   * `HH:MM`: what time the framed app is told it is, or `null` for its own clock.
   *
   * Here rather than inside the home tool because it is a way of looking at the app, the
   * way the device and the appearance are, and a link to the home screen at half past six
   * is the thing the whole timeline exists to produce. It is also what keeps a simulated
   * clock from becoming durable state nobody can see: an address that names no time
   * clears the key the app reads. `preview/home/clock.ts` is the writer.
   */
  time: string | null;
  /**
   * Whether the day is drawn under the frame.
   *
   * On by default, and off is what travels in the address, because the reason to write
   * one of the two down is that somebody chose it. ADR 0042 §2: the track is a control
   * for looking, so somebody who wants the frame and nothing else puts it away, and the
   * link they send puts it away for the person opening it.
   *
   * It says nothing about whether the track is on screen. That is decided where it is
   * drawn, out of the route the frame reports and the width of the window; a state that
   * tried to hold the answer would be a second copy of a media query.
   */
  timeline: boolean;
  /** Colour tokens overridden in the frame, per scheme. */
  overrides: Overrides;
  /** Run the measure checks as soon as the frame settles. */
  check: boolean;
}

export const INITIAL: PreviewState = {
  route: '/',
  device: DEFAULT_DEVICE,
  landscape: false,
  zoom: 'fit',
  w: preset(DEFAULT_DEVICE).w,
  h: preset(DEFAULT_DEVICE).h,
  theme: null,
  lang: null,
  seed: null,
  time: null,
  timeline: true,
  overrides: {},
  check: false,
};

const THEMES: ThemeSetting[] = ['system', 'light', 'dark'];

function isTheme(value: string | null): value is ThemeSetting {
  return value !== null && (THEMES as string[]).includes(value);
}

/**
 * `#/artikel?d=ipad-mini&o=l&t=dark` — route and everything about how it is being
 * looked at, in one link, so a finding can be handed over as a URL rather than as
 * a set of instructions.
 *
 * The five original parameters (`d`, `o`, `z`, `w`, `h`) keep their names and
 * their meaning: links written before this package existed still resolve.
 *
 * What moved is where the hash is parsed. `shell/address.ts` owns the grammar on
 * every route now, takes the three parameters that belong to the shell — `tools`,
 * `open`, `full` — and hands the rest through untouched. So this file no longer
 * reads a string: it reads what is left, which is exactly the frame's half. That
 * is what let `tools` and `full` leave `PreviewState`, where they had always been
 * the two fields that were not about the frame at all.
 */
export function fromAddress(address: ShellAddress): PreviewState {
  const route = address.head || '/';
  const p = address.rest;

  const asked = p.get('d') ?? '';
  const device = DEVICES.some((d) => d.id === asked) ? asked : INITIAL.device;
  const size = preset(device);
  const theme = p.get('t');
  const lang = p.get('lg');

  return {
    route,
    device,
    landscape: p.get('o') === 'l',
    // `z=fit`, a missing `z` and a junk one all come out as "fit".
    zoom: Number(p.get('z')) || 'fit',
    w: Number(p.get('w')) || size.w || INITIAL.w,
    h: Number(p.get('h')) || size.h || INITIAL.h,
    theme: isTheme(theme) ? theme : null,
    // Junk is no language at all rather than an error, the way `tm` below is read: a
    // stale link should still open, and a code the app has no catalogue for would give
    // it a provider with nothing in it rather than a setting that visibly failed.
    lang: isLocale(lang) ? lang : null,
    seed: p.get('s'),
    // Junk is no time at all rather than an error: a stale link should still open.
    time: parseTimeOfDay(p.get('tm')) === null ? null : p.get('tm'),
    // Default on, so the parameter is the exception and `tl=0` is the only thing it
    // spells. Anything else in it, including a missing one, is the default.
    timeline: p.get('tl') !== '0',
    overrides: parseOverrides(p.get('kl'), p.get('kd')),
    check: p.has('check'),
  };
}

/**
 * `kl=grey-100:ff0000,emphasis:00b0ff` — a proposed palette, per scheme, in the
 * link. A colour someone wants to argue for travels the same way a device and a
 * route do, which is the whole premise of this address bar. Unknown token names
 * and malformed values are dropped rather than rejected: a stale link should
 * still open.
 */
function parseOverrides(light: string | null, dark: string | null): Overrides {
  const out: Overrides = {};
  for (const [scheme, raw] of [
    ['light', light],
    ['dark', dark],
  ] as [Scheme, string | null][]) {
    for (const pair of raw?.split(',') ?? []) {
      const [token, hex] = pair.split(':');
      if (!token || !hex || !/^[\da-f]{6}$/i.test(hex)) continue;
      if (!(TOKENS as string[]).includes(token)) continue;
      const key = token as keyof Overrides;
      out[key] = { ...out[key], [scheme]: `#${hex.toLowerCase()}` };
    }
  }
  return out;
}

function writeOverrides(overrides: Overrides, scheme: Scheme): string {
  return TOKENS.filter((t) => overrides[t]?.[scheme])
    .map((t) => `${t}:${overrides[t]![scheme]!.replace('#', '')}`)
    .join(',');
}

/** The frame's half of the address: the app route, and the five-plus parameters. */
export function toAddress(state: PreviewState): { head: string; rest: URLSearchParams } {
  const p = new URLSearchParams();
  p.set('d', state.device);
  if (state.landscape) p.set('o', 'l');
  if (state.zoom !== 'fit') p.set('z', String(state.zoom));
  if (state.device === 'custom') {
    p.set('w', String(state.w));
    p.set('h', String(state.h));
  }
  if (state.theme) p.set('t', state.theme);
  if (state.lang) p.set('lg', state.lang);
  if (state.seed) p.set('s', state.seed);
  if (state.time) p.set('tm', state.time);
  if (!state.timeline) p.set('tl', '0');
  if (state.check) p.set('check', '1');
  const light = writeOverrides(state.overrides, 'light');
  const dark = writeOverrides(state.overrides, 'dark');
  if (light) p.set('kl', light);
  if (dark) p.set('kd', dark);
  return { head: state.route || '/', rest: p };
}

/**
 * The frame's size in CSS pixels, orientation applied.
 *
 * `host` comes out as zeroes, and that is not a fallback to fix here: its size is
 * whatever box the stage gives it, which this function cannot see. `Preview.tsx`
 * measures the box and substitutes it. A caller that forgets gets a frame of no
 * size, which is visible immediately rather than plausible and wrong.
 */
export function frameSize(state: PreviewState): { w: number; h: number } {
  if (state.device === HOST_DEVICE) return { w: 0, h: 0 };
  const { w, h } = state.device === 'custom' ? state : preset(state.device);
  return state.landscape ? { w: h, h: w } : { w, h };
}
