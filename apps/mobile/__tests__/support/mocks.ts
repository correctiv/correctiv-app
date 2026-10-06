/**
 * The doubles every suite wanted, identically, and therefore copied.
 *
 * Registered through `setupFiles` in jest.config.js, so it runs before each test
 * module is required and the mocks are in the registry by the time it imports
 * anything. Not a `.test.ts`, so testMatch ignores it.
 *
 * Only doubles that are **inert** belong here: nothing in this file is something a
 * test asserts against. That is the line. The expo-router mock is deliberately NOT
 * here even though eight suites carry a near-copy of it — its shape differs per
 * suite (`dismissTo` and `canGoBack` in one, `Stack` in another), and the suites
 * assert on `router.push`. A double you make claims about should be visible in the
 * file making them.
 *
 * A suite that needs different behaviour still declares its own `jest.mock`; a
 * file-local factory wins over this one.
 */

/**
 * The icon font loads asynchronously and setStates after the test has ended, which
 * surfaces as an update-outside-act warning pointing at whatever rendered last.
 * Rendering the name as text also lets a test assert which icon it got.
 */
jest.mock('@expo/vector-icons', () => {
  const react = jest.requireActual<typeof import('react')>('react');
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  const Ionicons = ({ name }: { name: string }) => react.createElement(Text, null, `icon:${name}`);
  Ionicons.displayName = 'Ionicons';
  return { Ionicons };
});

/** Leaving the app is never what a test wants, on any platform. */
jest.mock('@/lib/openExternal', () => ({ openExternal: jest.fn() }));

/**
 * The app bundles the `ship` layout and ships it empty (ADR 0078 §3), so no suite would find
 * a screen to draw. They read the `demo` layout in its place: content for the screens to
 * render, which is what these suites were written against. A suite about the empty bundle
 * mocks this module itself.
 */
jest.mock('@correctiv/app-core/data/layouts/ship/bundle', () => {
  const demo = jest.requireActual<typeof import('@correctiv/app-core/data/layouts/demo/bundle')>(
    '@correctiv/app-core/data/layouts/demo/bundle',
  );
  return { SHIP_SCREENS: demo.DEMO_SCREENS, SHIP_NAVIGATION: demo.DEMO_NAVIGATION };
});
