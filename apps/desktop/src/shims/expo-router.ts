// `expo-router`, over `@gjsify/react-native/router`.
//
// The `--dialect react-native` build aliases the bare `react-native` specifier and
// nothing else, so this one is ours to point somewhere. The router package already IS
// the expo-router surface over `@react-navigation/core`, and the app uses exactly the
// four names it supports — `router` (19 calls), `useLocalSearchParams` (7),
// `usePathname` (1) and `Stack` (1) — plus `Tabs`, which this host's own tab layout uses.
//
// Everything else expo-router exports is deliberately absent rather than stubbed. An
// import of `Link` or `Redirect` should fail at the build, where the support table can
// say what the plan for it is; a stub would make it fail in the window.
//
// ## The one thing that is an adapter rather than a re-export
//
// `router.push` in `@gjsify/react-native/router` takes `(href: string)`. expo-router's
// takes a `Href`, which is EITHER a string OR `{ pathname, params }` — and this app uses
// both forms, at ten call sites across seven pathnames:
//
//   router.push({ pathname: '/artikel', params: { url } })          a query parameter
//   router.push({ pathname: '/projekt/[id]', params: { id } })      a path parameter
//
// Handing the object straight through would not fail the build (nothing typechecks the
// bundle) and would not throw at runtime either — it would be interpolated into a URL as
// `[object Object]`, so every parameterised navigation in the app would quietly land on
// the not-found route. That is exactly the silent-failure shape this port exists to
// refuse, so the two forms are converted here.
//
// fixed upstream in gjsify: `router.push`/`replace`/`navigate` should accept
// expo-router's object `Href` — remove `hrefOf` and the wrapper below on the next bump.

import { CommonActions } from '@react-navigation/core';
import { Children, createElement, isValidElement, type ReactElement } from 'react';

import {
  navigationRef,
  router as gjsifyRouter,
  Stack as gjsifyStack,
  Tabs,
  useLocalSearchParams,
  usePathname,
} from '@gjsify/react-native/router';

export { Tabs, useLocalSearchParams, usePathname };

/**
 * A `<Stack.Screen>` that may also be rendered from inside a screen, because on
 * expo-router that is half of what it is for.
 *
 * The layer reads `<Stack.Screen>` as DATA — `<Stack>` collects its `name` and
 * `options` and never renders it — and `StackScreen` therefore THROWS a
 * `RouterError` if React ever calls it, on the sound argument that a declaration
 * nobody read would otherwise vanish silently. expo-router has a second meaning for
 * the same element: rendered inside a route's own body with no `name`, it sets the
 * CURRENT screen's options. `components/ui/ScreenHeader.tsx` does exactly that on
 * every one of the twelve screens that take a header (ADR 0030), so on this host the
 * layer's refusal fired per screen rather than catching a mistake.
 *
 * **THE OPTIONS ARE DROPPED, and they could not be anything else.** `<Stack>`'s own
 * option vocabulary here is `title`, `headerShown` and `animation`; four of the six
 * the phone sets — `headerTitle`, `headerBackTitle`, `headerStyle`, `headerTintColor`
 * — configure a native stack header that does not exist on this host, and the layer
 * refuses each by name. There is no version of forwarding these that is not an error.
 * What is actually lost is `title`: an `Adw.NavigationPage` falls back to the route's
 * name, so a pushed page's title in the window's header bar reads `artikel` rather
 * than „Artikel“. Named here because it is the one of the six that had a counterpart.
 *
 * **What this host shows instead** is the reason the trade is tolerable: `<Stack>`
 * renders an `Adw.NavigationView`, whose chrome is the window's own header bar with
 * its own back control — the platform's header, which is precisely what ADR 0030 asks
 * a host to prefer. So the twelve screens lose a configuration call and keep a header.
 * `app/formular.tsx` is the one screen that asks for the app's drawn bar instead, and
 * it still gets it: that half of `ScreenHeader` is ordinary markup.
 *
 * `test/expo-router-shim.test.ts` holds both halves — that a declaration still reaches
 * the layer, and that a render is inert rather than a throw.
 */
function StackScreen(_props: { name?: string; options?: Record<string, unknown> }): null {
  return null;
}
StackScreen.displayName = 'Stack.Screen';

/**
 * `<Stack>`, with the declarations above translated back into the layer's own.
 *
 * `screenOptionsFrom` compares each child against the marker component it was handed
 * and refuses anything else by name, so a tolerant `Screen` cannot simply be swapped
 * in beside the layer's `<Stack>` — the route declarations in `app/_layout.tsx` and
 * `app/(tabs)/_layout.tsx` would be the refused children instead. Re-creating each one
 * as the layer's marker is the whole of the adapter, and it keeps the refusal intact
 * for every child that is neither.
 */
export function Stack({ children, ...rest }: Parameters<typeof gjsifyStack>[0]): ReactElement {
  const declared = Children.map(children, (child) =>
    isValidElement(child) && child.type === StackScreen
      ? createElement(gjsifyStack.Screen, child.props as { name: string })
      : child,
  );
  return createElement(gjsifyStack, rest, declared);
}
Stack.Screen = StackScreen;

type Params = Record<string, string | number | undefined | null>;

/** expo-router's `Href`, in the two shapes this app writes. */
export type Href = string | { pathname: string; params?: Params };

/**
 * `Href` -> the path string the router takes.
 *
 * A param named in the pathname (`[id]`, `[slug]`) is substituted into that segment; a
 * param that is not becomes a query parameter. That is expo-router's own rule, and it is
 * why one function covers both call shapes.
 *
 * Values are percent-encoded. The app pushes whole article URLs as a param
 * (`params: { url }`), so a value containing `/`, `?` and `:` is the ordinary case here
 * rather than an edge one.
 */
export function hrefOf(href: Href): string {
  if (typeof href === 'string') return href;

  const params: Params = { ...href.params };
  let pathname = href.pathname;

  for (const [key, value] of Object.entries(params)) {
    const placeholder = `[${key}]`;
    if (!pathname.includes(placeholder)) continue;
    pathname = pathname.replace(placeholder, encodeURIComponent(String(value ?? '')));
    delete params[key];
  }

  const query = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');

  return query === '' ? pathname : `${pathname}?${query}`;
}

/**
 * How many screens this shim has pushed since the last `replace`.
 *
 * The state behind `canGoBack()`, which `@gjsify/react-native/router` does not expose —
 * and NOT a nicety: `lib/navigation/goBack.ts` calls it unconditionally, so without it
 * the reader's back button dies with `router.canGoBack is not a function`. That is a
 * latent crash on the vertical slice, invisible until someone presses the one control
 * every pushed screen has.
 *
 * A COUNTER IS AN APPROXIMATION, and here is exactly how good it is. Every navigation
 * the application makes goes through this object, so the count is right for all of them.
 * What it cannot see is a pop from the GTK side — Escape, Alt+Left, the mouse back
 * button — which `Adw.NavigationView` performs and the router bridges to React Navigation
 * without telling this module. After one of those the count is too high by one, so
 * `canGoBack()` can answer true when the stack is already at its root; `back()` then
 * pops nothing and the screen simply does not change.
 *
 * fixed upstream in gjsify: the router should expose `canGoBack`, which React
 * Navigation's own navigation object already answers — remove the counter with it.
 */
let pushed = 0;

/**
 * The methods the app calls, each accepting expo-router's `Href`.
 *
 * Six rather than four: `canGoBack` and `dismissTo` are the two the app uses that the
 * router does not have.
 */
export const router = {
  push: (href: Href): void => {
    pushed++;
    gjsifyRouter.push(hrefOf(href));
  },
  replace: (href: Href): void => {
    // `replace` swaps the current screen rather than stacking one, so the depth is
    // whatever it was — except from the root, where the app uses it to enter the
    // onboarding and there is still nothing behind.
    gjsifyRouter.replace(hrefOf(href));
  },
  navigate: (href: Href): void => gjsifyRouter.navigate(hrefOf(href)),
  back: (): void => {
    if (pushed > 0) pushed--;
    gjsifyRouter.back();
  },
  canGoBack: (): boolean => pushed > 0,
  /**
   * expo-router's `dismissTo`, mapped to `replace`.
   *
   * It means "pop back to this route, dismissing what is above it". `Adw.NavigationView`
   * can do that (`pop_to_tag`), but the router exposes no such call, and `replace` gets
   * the user to the right SCREEN — which is what the one call site
   * (`app/formular.tsx`, after a form is submitted) is for. The difference is the
   * history left behind, so it is named rather than passed off as equivalent.
   */
  dismissTo: (href: Href): void => {
    pushed = 0;
    gjsifyRouter.replace(hrefOf(href));
  },
  /**
   * `setParams`, which the router below REFUSES, answered here for the one screen
   * that calls it.
   *
   * `@gjsify/react-native/router` throws a `RouterError` on this name, and the
   * reason it gives is real: params travel INTO a route through the pattern and back
   * OUT through `useLocalSearchParams`, and an edit in place writes at neither end,
   * so the URL could stop describing the screen. Its error names
   * `router.replace({ pathname, params })` as the alternative.
   *
   * Why this host answers it anyway rather than taking that alternative. The caller
   * is the gallery's "All components" control, which clears `?c=` — a filter, not a
   * navigation, and `replace` would rebuild the page's whole tree to change one
   * query parameter. And the refusal's own premise does not hold once you look at
   * where the two halves read from: `useLocalSearchParams` is `useRoute().params`,
   * and `usePathname` strips the query off the path it derives. React Navigation's
   * own `SET_PARAMS` writes that same route object, so both halves keep agreeing.
   *
   * `source: route.key` and not a bare dispatch, because `BaseRouter` handles
   * `SET_PARAMS` at whichever navigator sees it first — the root — and would set the
   * params of the root navigator's current route. The key names the FOCUSED route,
   * which is the one `useLocalSearchParams` is about, and is therefore right for a
   * screen nested inside the tabs as well as for `/gallery` beside them.
   */
  setParams: (params: Params): void => {
    if (!navigationRef.isReady()) return;
    // CAST, because the container ref is typed against `ReactNavigation.RootParamList`
    // and this app augments none — so the published types collapse `getCurrentRoute()`
    // to `undefined`, and after the guard below TypeScript is left with `never`. It
    // reads a `key` at runtime either way. Found by CI rather than here: the working
    // copy this host is developed against types it wider, so the linked build accepted
    // `route.key` and the published one did not.
    const route = navigationRef.getCurrentRoute() as { key: string } | undefined;
    if (route === undefined) return;
    navigationRef.dispatch({ ...CommonActions.setParams(params), source: route.key });
  },
};
