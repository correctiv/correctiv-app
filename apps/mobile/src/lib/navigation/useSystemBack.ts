import { useEffect, useRef } from 'react';
import { BackHandler } from 'react-native';

/**
 * Answers Android's system back, the button and the gesture alike, for as long as
 * the calling screen is mounted (issue #120).
 *
 * `handler` returns `true` when it has dealt with back, and `false` to hand it on:
 * to the navigator, which pops a screen when it has one, and after that to the
 * system, which leaves the app. Almost every screen should never call this, because
 * the navigator already answers back for every route and both modals.
 *
 * **This is on the callback API already**, which is what predictive back would
 * require of every interceptor. React Native 0.86's `ReactActivity` registers an
 * `OnBackPressedCallback` on apps targeting SDK 36 and forwards it to `BackHandler`;
 * nothing here reaches for the deprecated `onBackPressed`. Predictive back itself
 * stays off, and `app.json`'s neighbour `app.config.js` says why.
 *
 * The web target has no system back to answer, only the browser's, which walks the
 * browser's history, so `useSystemBack.web.ts` registers nothing.
 *
 * The latest handler is read through a ref, so a screen can pass an inline
 * function without re-registering on every render; listeners run last-registered
 * first, and re-registering would reorder them.
 */
export function useSystemBack(handler: () => boolean): void {
  const latest = useRef(handler);
  latest.current = handler;
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => latest.current());
    return () => subscription.remove();
  }, []);
}
