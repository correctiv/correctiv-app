import { describe, expect, it } from 'vitest';

import { parseAddress, writeAddress } from '../../src/shell/address';
import { VIEWS } from '../../src/shell/views';
import { frameSize, fromAddress, INITIAL, toAddress } from '../../src/preview/state';
import type { PreviewState } from '../../src/preview/state';

const VIEW = VIEWS.preview;

/** The frame's half of a hash, through the shell's grammar and back. */
const read = (hash: string): PreviewState => fromAddress(parseAddress(hash, VIEW));

function write(state: PreviewState): string {
  const { head, rest } = toAddress(state);
  return writeAddress({ head, rest, tool: null, full: false }, VIEW);
}

describe('the frame’s half of the hash', () => {
  it('round-trips a full state, because a link is the shell’s only persistence', () => {
    // `w`/`h` are only carried for `custom`; for a named device they are derived
    // from the preset, so a round-trip normalises them to it. iPad mini is
    // 744x1133, and a state claiming otherwise is not a state this shell can be in.
    const state: PreviewState = {
      ...INITIAL,
      route: '/artikel',
      device: 'ipad-mini',
      w: 744,
      h: 1133,
      landscape: true,
      zoom: 0.5,
      theme: 'dark',
      seed: 'signed-in',
      check: true,
      timeline: false,
      overrides: { 'grey-100': { dark: '#102a54' }, emphasis: { light: '#00b0ff' } },
    };
    expect(read(write(state))).toEqual(state);
  });

  /**
   * The panel and `full` left this state, and a link that carries them still works.
   *
   * They were always the two fields that were not about the frame: whether the
   * right panel is open and whether the chrome is out of the way are the shell's,
   * on every route, and `shell/address.ts` owns them now. What has to keep holding
   * is that the frame's parser does not see them and does not lose the parameters
   * beside them — `tools`, the panel's own older spelling, included.
   */
  it('leaves the shell’s own parameters to the shell', () => {
    const hash = '#/artikel?d=ipad-mini&tools=1&full=1';
    const address = parseAddress(hash, VIEW);

    expect(address.tool).toBe('appearance');
    expect(address.full).toBe(true);
    expect(read(hash)).toEqual({
      ...INITIAL,
      route: '/artikel',
      device: 'ipad-mini',
      w: 744,
      h: 1133,
    });
  });

  it('still reads a link written before this package existed', () => {
    const state = read('#/artikel?d=ipad-pro-11&o=l&z=fit');
    expect(state.route).toBe('/artikel');
    expect(state.device).toBe('ipad-pro-11');
    expect(state.landscape).toBe(true);
    expect(state.zoom).toBe('fit');
  });

  it('keeps a custom size, and only then', () => {
    const custom = read('#/?d=custom&w=500&h=900');
    expect([custom.w, custom.h]).toEqual([500, 900]);
    expect(write(custom)).toContain('w=500');
    expect(write({ ...custom, device: 'iphone-se' })).not.toContain('w=500');
  });

  it('drops an override it cannot trust rather than refusing the link', () => {
    const state = read('#/?kd=grey-100:102a54,not-a-token:ffffff,emphasis:xyz');
    expect(state.overrides).toEqual({ 'grey-100': { dark: '#102a54' } });
  });

  /**
   * The day under the frame is on unless a link says otherwise, and only the exception
   * is written down.
   *
   * ADR 0042 §2 puts a switch in the toolbar so that somebody can have the frame and
   * nothing else, and the address is what carries that choice to the person the link is
   * sent to. Default-on is what decides the spelling: a parameter written on every link
   * to say "yes, the usual thing" is noise in every link, so `tl=0` is the only thing
   * this key ever spells and everything else — a missing one, a junk one, `tl=1` — is
   * the default. A stale link should still open, which is the same rule the time, the
   * device and the overrides above are read by.
   */
  it('writes the day away and nothing else, so only the exception is in the link', () => {
    expect(write({ ...INITIAL, timeline: true })).not.toContain('tl=');
    expect(write({ ...INITIAL, timeline: false })).toContain('tl=0');
  });

  it('treats anything but an explicit nought as the day being there', () => {
    const at = (rest: string) => read(`#/?d=iphone-15-pro${rest}`).timeline;
    expect(at('')).toBe(true);
    expect(at('&tl=1')).toBe(true);
    expect(at('&tl=yes')).toBe(true);
    expect(at('&tl=0')).toBe(false);
  });

  it('treats an empty hash as the default view', () => {
    expect(read('')).toEqual(INITIAL);
  });
});

/**
 * `landscape` swaps the two numbers. It does not mean landscape.
 *
 * Those were the same sentence while every preset was written portrait-first,
 * and they stopped being one when the presets above tablet size arrived written
 * the way a laptop is used. The toolbar therefore names the orientation from what
 * comes out of here, and this pins the half it reads: rewrite `desktop` as
 * 900 × 1440 and the control it drives starts disagreeing with the frame again.
 */
describe('the frame that comes out of a preset', () => {
  const at = (device: string, landscape = false) => frameSize({ ...INITIAL, device, landscape });

  it('keeps the pair as written, and turns it when asked', () => {
    expect(at('iphone-se')).toEqual({ w: 375, h: 667 });
    expect(at('iphone-se', true)).toEqual({ w: 667, h: 375 });
    expect(at('desktop')).toEqual({ w: 1440, h: 900 });
    expect(at('desktop', true)).toEqual({ w: 900, h: 1440 });
  });

  /** Its size is the box the stage measures, which this function cannot see. */
  it('answers zero for the host', () => {
    expect(at('host')).toEqual({ w: 0, h: 0 });
  });
});
