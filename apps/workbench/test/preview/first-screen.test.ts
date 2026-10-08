/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { LAYOUT_SET_KEY } from '../../src/preview/home/names';
import { shippedOf } from '../../src/preview/home/screens';
import {
  createScreen,
  discardScreens,
  selectLayout,
  setLayout,
  setScreen,
} from '../../src/preview/home/store';
import { getNavigation, setNavigation } from '../../src/preview/navigation/store';

/** The navigation the frame is told to draw. */
const frameNavigation = (): { tabs: string[] } =>
  JSON.parse(window.localStorage.getItem(LAYOUT_SET_KEY) ?? '{}').navigation;

/**
 * An empty navigation draws the empty state, so the first screen a layout gets has to be on
 * it: placing blocks on the first page of `ship` used to leave the frame on "Bald verfügbar"
 * until a second page was made and opened, because only opening a screen by its address
 * drew it.
 */
describe('the first screen of an empty layout', () => {
  beforeEach(() => {
    window.localStorage.clear();
    selectLayout('ship');
    discardScreens();
    setScreen('home');
  });

  it('is on the navigation once it has a block, and the frame is told', () => {
    expect(getNavigation().tabs).toEqual([]);
    setLayout(shippedOf('home', 'demo'));
    expect(getNavigation().tabs).toEqual(['home']);
    expect(frameNavigation().tabs).toEqual(['home']);
  });

  it('is on the navigation when it is made with a name', () => {
    expect(createScreen('kampagne', 'Kampagne')).toBeNull();
    expect(frameNavigation().tabs).toEqual(['kampagne']);
  });

  it('leaves the second screen off, which is the person’s to place', () => {
    setLayout(shippedOf('home', 'demo'));
    expect(createScreen('kampagne', 'Kampagne')).toBeNull();
    expect(getNavigation().tabs).toEqual(['home']);
  });

  it('does not put a screen back on a navigation somebody emptied on purpose', () => {
    selectLayout('demo');
    discardScreens();
    setNavigation({ ...getNavigation(), tabs: [] });
    setLayout(shippedOf('home', 'demo'));
    expect(getNavigation().tabs).toEqual([]);
  });
});
