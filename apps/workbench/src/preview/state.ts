import { parseBerlinDateTime } from '@correctiv/app-core/lib/berlin-time';
import { parseTimeOfDay } from '@correctiv/app-core/lib/home-layout';
import type { Locale } from '@correctiv/app-core/stores/settings';

import type { ShellAddress } from '../shell/address';
import { DEFAULT_DEVICE, DEVICES, HOST_DEVICE, preset } from './devices';
import { isLocale } from './frame/locale';
import { TOKENS, type Overrides, type Scheme } from './frame/tokens';
import { isSpan, type Span } from './home/calendar';
import { scenarioNamed } from './scenarios';

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
   * The named scenario the home tool has open, or `null` for none: `sc=wahlabend`.
   *
   * ADR 0036 §11 put the name in the address, and `scenarios.ts` holds the names. A
   * scenario also brings a time and a session, and those are **defaults under the
   * address**, not values of their own: `tm` and `s` written beside `sc` win, and what
   * `toAddress` leaves out is exactly what equals the scenario's default. So `sc=wahlabend`
   * alone is the whole link until somebody moves the playhead, and taking `sc` out of the
   * address takes its time and its session with it.
   *
   * Two letters like `lg` and `tm`. A name nothing answers to is no scenario, the way a
   * junk `tm` is no time: a stale link should still open.
   */
  scenario: string | null;
  /**
   * What time the framed app is told it is, or `null` for its own clock: `HH:MM` for that
   * minute today, or `YYYY-MM-DDTHH:MM` for a day of its own, both Berlin wall clock.
   *
   * The date arrived with ADR 0059 §2, so that "what will readers see on Saturday at 18:00"
   * is a link. A bare time keeps meaning today, so every link sent before it still opens on
   * the hour it names.
   *
   * Here rather than inside the home tool because it is a way of looking at the app, the
   * way the device and the appearance are, and a link to the home screen at half past six
   * is the thing the whole timeline exists to produce. It is also what keeps a simulated
   * clock from becoming durable state nobody can see: an address that names no time
   * clears the key the app reads. `preview/home/clock.ts` is the writer.
   */
  time: string | null;
  /**
   * How far out the track under the frame is: a day, a week or a month, `zm=week` and
   * `zm=month`, and no `zm` for the day, so every link written before the zooms opens as it
   * did.
   *
   * ADR 0059 §2's three zooms of one axis. The playhead is `time` at every zoom and this
   * says only how much of the axis is drawn around it, so a link to the week of the
   * election night shows that week and the phone at the minute it names. `zm` and not `z`,
   * which has been the frame's scale since the first five parameters.
   */
  span: Span;
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
  scenario: null,
  time: null,
  span: 'day',
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
  const scenario = scenarioNamed(p.get('sc'));
  const askedTime = p.get('tm');

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
    // Written beside `sc`, the address wins over the scenario, an empty one included: `s=`
    // is somebody saying "no fixture", which a scenario's default must not overrule.
    seed: p.has('s') ? p.get('s') || null : (scenario?.session ?? null),
    scenario: scenario?.name ?? null,
    // Junk is no time at all rather than an error: a stale link should still open.
    time: p.has('tm') ? (isTime(askedTime) ? askedTime : null) : (scenario?.opensAt ?? null),
    // Default on, so the parameter is the exception and `tl=0` is the only thing it
    // spells. Anything else in it, including a missing one, is the default.
    // Junk is the day, which is what a missing one is.
    span: isSpan(p.get('zm')) ? (p.get('zm') as Span) : 'day',
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
  const scenario = scenarioNamed(state.scenario);
  if (scenario) p.set('sc', scenario.name);
  unlessDefault(p, 's', state.seed, scenario?.session ?? null);
  unlessDefault(p, 'tm', state.time, scenario?.opensAt ?? null);
  if (state.span !== 'day') p.set('zm', state.span);
  if (!state.timeline) p.set('tl', '0');
  if (state.check) p.set('check', '1');
  const light = writeOverrides(state.overrides, 'light');
  const dark = writeOverrides(state.overrides, 'dark');
  if (light) p.set('kl', light);
  if (dark) p.set('kd', dark);
  return { head: state.route || '/', rest: p };
}

function isTime(value: string | null): value is string {
  return parseTimeOfDay(value) !== null || parseBerlinDateTime(value) !== null;
}

/**
 * A value into the address only where it is not what the address would give anyway.
 *
 * Without a scenario the default is `null` and this is the plain "write it if there is
 * one". With one, a value equal to the scenario's is left out, and `null` against a
 * scenario's value is written empty, because it is somebody having switched the
 * scenario's default off and the next reading has to know.
 */
function unlessDefault(
  p: URLSearchParams,
  key: string,
  value: string | null,
  fallback: string | null,
): void {
  if (value === fallback) return;
  p.set(key, value ?? '');
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
