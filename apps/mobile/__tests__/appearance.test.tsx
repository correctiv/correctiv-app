import { act, create } from 'react-test-renderer';
import { Text } from 'react-native';
import { Provider } from 'react-redux';

import { setTheme } from '@correctiv/app-core/stores/settings';
import { resetStore } from '@correctiv/app-core/stores/store';

import { Uniwind } from 'uniwind';

import { coreStore } from '@/lib/store/core';
import { useAppearance } from '@/lib/theme/appearance';

jest.mock('uniwind', () => ({
  Uniwind: { setTheme: jest.fn() },
  useUniwind: () => ({ theme: 'light', hasAdaptiveThemes: true }),
}));

// Read back through the module, because jest hoists the factory above every
// declaration in this file and forbids it from closing over one.
const setThemeSpy = jest.mocked(Uniwind.setTheme);

/**
 * The one rule the colour system cannot survive without: the app's setting and the
 * styles must never disagree about which scheme is active.
 *
 * This replaces a regression test for a defect that shipped, and the defect is
 * worth keeping in view because the fix inverted the rule. Under NativeWind,
 * `'system'` had to be resolved to a concrete scheme HERE before being passed on:
 * handing it through left the JavaScript following the device while
 * `darkMode: 'class'` waited for a class nothing added, so `useColors()` returned
 * the dark palette while `bg-grey-100` stayed white. Typecheck, lint, the tests,
 * the Android build and the web export were all green, and a browser walk missed it
 * too — it flipped the setting to `'dark'` and pinned the emulated
 * `prefers-color-scheme` to light, exercising both paths that work and neither that
 * breaks.
 *
 * Under Uniwind the correct move is the opposite one: `setTheme` takes `'system'`
 * and resolves it itself, so resolving it here would be the bug — it would pin the
 * app to whatever the device said at mount and stop it following a later change.
 * So what this now asserts is that the setting arrives VERBATIM.
 */
function Probe() {
  useAppearance();
  return <Text>x</Text>;
}

function mount() {
  act(() => {
    create(
      <Provider store={coreStore}>
        <Probe />
      </Provider>,
    );
  });
}

beforeEach(() => {
  setThemeSpy.mockClear();
  act(() => {
    coreStore.dispatch(resetStore());
  });
});

describe('appearance', () => {
  it('passes "system" through rather than resolving it', () => {
    // Resolving it here would pin the app to the scheme the device reported at
    // mount; Uniwind keeps following the device only while it holds 'system'.
    mount();
    expect(setThemeSpy).toHaveBeenCalledWith('system');
  });

  it('passes an explicit setting through unchanged', () => {
    // A user who picks light on a dark phone means it — the reason this is a
    // setting and not just `prefers-color-scheme`.
    for (const setting of ['light', 'dark'] as const) {
      setThemeSpy.mockClear();
      act(() => {
        coreStore.dispatch(setTheme(setting));
      });
      mount();
      expect(setThemeSpy).toHaveBeenCalledWith(setting);
    }
  });

  it('follows a change of the setting', () => {
    mount();
    setThemeSpy.mockClear();

    act(() => {
      coreStore.dispatch(setTheme('dark'));
    });

    expect(setThemeSpy).toHaveBeenCalledWith('dark');
  });
});

/**
 * The device scheme moving under a `'system'` setting.
 *
 * The docblock above says Uniwind keeps following the device while it holds
 * `'system'`, and on the web that turned out to be half true: `setTheme('system')`
 * reads `prefers-color-scheme` once and stamps the answer on the root element, and
 * nothing re-reads it. Measured on the built workbench on 2026-09-11 with the
 * setting on System and the machine switched to dark with the page open: the
 * site's own chrome followed, because its CSS sits behind a media query, while
 * everything Uniwind had painted stayed light. So the setting still arrives
 * verbatim, and `'system'` is asked again whenever the device answer changes.
 *
 * Only where there is a `matchMedia` to ask. On a phone there is none, and what an
 * adaptive theme does there is Uniwind's own business; this is the web half.
 */
describe('a device that changes its mind', () => {
  let listeners: (() => void)[] = [];

  beforeEach(() => {
    listeners = [];
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        matchMedia: () => ({
          addEventListener: (_: string, fn: () => void) => listeners.push(fn),
          removeEventListener: (_: string, fn: () => void) => {
            listeners = listeners.filter((entry) => entry !== fn);
          },
        }),
      },
    });
  });

  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });

  it('asks "system" again when the device scheme moves', () => {
    mount();
    setThemeSpy.mockClear();

    act(() => {
      for (const fire of listeners) fire();
    });

    expect(setThemeSpy).toHaveBeenCalledWith('system');
  });

  it('does not listen on an explicit setting, which means what it says', () => {
    act(() => {
      coreStore.dispatch(setTheme('dark'));
    });
    mount();

    expect(listeners).toHaveLength(0);
  });

  it('lets go of the listener when the host goes away', () => {
    let tree: ReturnType<typeof create> | undefined;
    act(() => {
      tree = create(
        <Provider store={coreStore}>
          <Probe />
        </Provider>,
      );
    });
    expect(listeners).toHaveLength(1);

    act(() => {
      tree?.unmount();
    });

    expect(listeners).toHaveLength(0);
  });
});
