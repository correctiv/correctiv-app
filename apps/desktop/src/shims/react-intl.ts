// `react-intl`, unchanged at runtime, with one type widened so its provider may stand
// in a JSX tag position on this host.
//
// NOT A COMPATIBILITY LAYER. Every value here is react-intl's own: the library is plain
// JavaScript with no platform SDK and no renderer of its own, so `useIntl`,
// `defineMessages` and `IntlProvider` run on GJS exactly as they run on Hermes. The one
// thing that does not survive is a TYPE, and it is the same narrowness
// `app/_layout.tsx` casts around for its error boundary.
//
// ## The type, and why it is the host's problem rather than react-intl's
//
// `tsconfig.json` sets `jsxImportSource` to `@gjsify/gtk-host/react` so that an
// accidental `<div>` is a type error rather than a blank window. That namespace declares
// `ElementType` as `keyof GtkReactIntrinsicElements | ((props: never) => ReactNode)` —
// a GTK tag, or a function returning a `ReactNode`. React 19's own
// `FunctionComponent` returns `ReactNode | Promise<ReactNode>`, because a component may
// be async, so EVERY typed function component from a library fails that test:
//
//     TS2786: 'IntlProvider' cannot be used as a JSX component.
//       Type 'ReactNode | Promise<ReactNode>' is not assignable to type 'ReactNode'.
//
// The app's own components do not hit it because their return types are inferred, and
// an inferred one is the narrow `ReactNode`. This is therefore not about react-intl at
// all; it is about any component whose type was written out.
//
// fixed upstream in gjsify: `GtkElementType` should admit React's own
// `FunctionComponent` and `ComponentClass`, the way React's `ElementType` does — remove
// this file and the `EXACT` entry for it on the next bump.
//
// ## Why a whole module rather than a cast at the call site
//
// The call site is `apps/mobile/src/i18n/Localisation.tsx`, which is the phone's file
// and has no business carrying a GTK-shaped cast. Redirecting the import is the
// mechanism this host already uses for exactly that situation (`gjsify.config.mjs`'s
// `EXACT` table), and it keeps the widening in the desktop tree where a reader looking
// for this host's compromises will find it.
//
// ## `react-intl-upstream`, and why this file cannot say `react-intl`
//
// It is the real package under a second name, aliased in `gjsify.config.mjs` and in
// `tsconfig.json`'s `paths`. Both of those redirect the bare `react-intl` to THIS FILE,
// by exact string — so a `from 'react-intl'` here resolves to itself, and the symptom is
// not a loop but an empty module: `export *` re-exports nothing and all 40-odd screens
// report "has no exported member 'useIntl'". The second name is what breaks the cycle,
// and it is a name no package.json declares precisely so that nothing but this file can
// reach past the redirect.

export * from 'react-intl-upstream';

import { IntlProvider as BaseIntlProvider } from 'react-intl-upstream';
import type { ComponentProps, ReactNode } from 'react';

/** react-intl's provider, retyped as the narrow function component GTK's JSX accepts. */
export const IntlProvider = BaseIntlProvider as unknown as (
  props: ComponentProps<typeof BaseIntlProvider>,
) => ReactNode;
