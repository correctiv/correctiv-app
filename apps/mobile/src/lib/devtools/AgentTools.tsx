/**
 * The Rozenite domains that are hooks, mounted once, in development only.
 *
 * Three domains, and each arrives as a hook rather than as something the store can
 * be handed, so they need a component to live in and `lib/store/core.ts`'s
 * `devToolsEnhancers()` has no place for them:
 *
 *  - **Redux**, the agent half of the same history the enhancer already sends to
 *    the panel. `useReduxDevToolsAgentTools()` registers the tools that let an
 *    agent list stores, read state, list and inspect actions, and dispatch, jump,
 *    toggle, rollback, commit and sweep.
 *  - **Storage**, over the two MMKV instances `lib/platform/expo.ts` owns. The
 *    plugin's panel reads and WRITES entries, which is the same authority the
 *    Redux domain has and the reason for the capture rules below.
 *  - **React Navigation**, over expo-router's own container ref.
 *
 * **Not network inspection**, and that is a decision rather than an omission:
 * `react-native` 0.86.3 defaults both `enableNetworkEventReporting` and
 * `fuseboxNetworkInspectionEnabled` to `true` and captures natively on iOS and
 * Android, so it is the one item here that needs no dependency at all
 * ([ADR 0026](../../../../../adr/0026-react-native-review-and-hardening.md) §1).
 * Note what a session sees even so: the article reader is a WebView (ADR 0017)
 * and `expo-audio` and `expo-video` fetch through their own players, so JavaScript
 * HTTP inspection says nothing about any of the three.
 *
 * **Capture rules, because two of these domains can write.** Use test accounts,
 * keep captures local, and put none of them in the repository. Nothing here leaves
 * the machine unless somebody shares a trace, and that is the line to hold.
 *
 * **This file must never reach a release bundle, and nothing about it enforces
 * that from the inside.** The packages below guard themselves at module scope, but
 * this module is ours and Metro keeps a `require` it finds in a function however
 * unreachable the call is. So the one thing that matters is how `app/_layout.tsx`
 * selects it — at MODULE scope — and the check that it worked is the grep over the
 * published bundle in `.github/workflows/pages.yml`.
 */
import { useMMKVDevTools } from '@rozenite/mmkv-plugin';
import { useReactNavigationDevTools } from '@rozenite/react-navigation-plugin';
import { useReduxDevToolsAgentTools } from '@rozenite/redux-devtools-plugin';
import { useNavigationContainerRef } from 'expo-router';
import { useEffect, useState } from 'react';
import type { MMKV } from 'react-native-mmkv';

import { openStores } from '@/lib/platform/expo';

/**
 * Renders nothing. It exists so that three hooks have somewhere to be called from
 * that is mounted for the life of the app and above nothing that can unmount it.
 *
 * `app/_layout.tsx` mounts it inside `AppEnvironment` and beside `AppShell`, not
 * inside it: the shell returns `null` until the fonts and the store are ready, and
 * a debugger that attaches only after a successful startup is no use for the
 * startup faults worth debugging.
 */
export default function AgentTools(): null {
  useReduxDevToolsAgentTools();

  // In an EFFECT rather than during render, which is about where the code runs
  // rather than when. `expo export --platform web` prerenders every route in Node,
  // where there is no `localStorage` for MMKV's web build to reach, so opening a
  // store while rendering makes the adapter report both of them unavailable —
  // "nothing will persist", twice, in the log of a build that is fine. Effects do
  // not run in a prerender, so the inspector opens the stores in the browser that
  // is going to inspect them and nowhere else.
  const [storages, setStorages] = useState<Record<string, MMKV>>({});
  useEffect(() => setStorages(openStores()), []);
  // MMKV v4 dropped the readable `id` from an instance, so the plugin requires a
  // RECORD of id to instance and throws on an array. `openStores()` is keyed by
  // the same two ids the adapter writes under, which is what the panel labels its
  // namespaces with.
  useMMKVDevTools({ storages });

  // The cast is a two-copies problem stated rather than hidden. `expo-router` 57
  // VENDORS react-navigation at `expo-router/build/react-navigation/*` and depends
  // on no `@react-navigation/*` package at all, while this plugin declares
  // `@react-navigation/core ^7.12.1` as a peer — which npm then installs (7.22.1).
  // So two copies of one library exist in the dev tree and their
  // `NavigationContainerRef`s are nominally distinct: `PrivateValueStore`'s
  // protected brand makes TypeScript reject the assignment even though the shapes
  // agree. Structurally they do agree everywhere it matters — the plugin touches
  // `getRootState`, `resetRoot`, `dispatch`, `canGoBack` and the `state` and
  // `__unsafe_action__` listeners, and expo-router's `BaseNavigationContainer`
  // emits both — and the actions it dispatches are the plain objects
  // `CommonActions` builds, which cross copies unchanged.
  //
  // Nothing of this reaches a release bundle: the plugin's entry assigns the real
  // hook only when `NODE_ENV` is not production, and this whole module is selected
  // away at module scope in `app/_layout.tsx`. ADR 0026 §1 named the React
  // Navigation domain without anticipating the vendoring, which is what this
  // paragraph records.
  type PluginRef = Parameters<typeof useReactNavigationDevTools>[0]['ref'];
  const ref = useNavigationContainerRef() as unknown as PluginRef;
  useReactNavigationDevTools({ ref });

  return null;
}
