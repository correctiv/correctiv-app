# ADR 0008 — Uniwind over NativeWind, and Tailwind v4

Status: accepted, 2026-08-27.

## Context

The app styled itself with NativeWind 4, which is a Tailwind **v3** engine. That
version pin is the whole of this decision: everything else follows from it.

Three things were pushing against it.

`tokens/theme.css` is vendored from `wp-design-tokens`, which declares
`peerDependencies: { tailwindcss: ">=4.1" }` — the tokens have been on v4 for as long
as they have been in this repo, and the app has been reading them through a
translation layer. [`tokens/README.md`](../tokens/README.md) records that mismatch as
one of the reasons the tokens were vendored rather than installed — a reason this
decision retires, and which that file now records as expired.

The translation layer was `tailwind.tokens.generated.js`: a v3 theme map with colours
shaped as `rgb(var(--color-x) / <alpha-value>)` and a plugin emitting the palette
twice, under `:root` and `.dark:root`. It existed only to restate, in a shape a v3
engine understands, what `theme.css` already said. When the token bridge moved into
`packages/design-tokens` so that the CMS could share it
([#47](https://github.com/faktenforum/correctiv-app/pull/47)), that file was the one
artefact that could not move with it — a v3 theme map is a fact about the engine this
app happens to run on, not about the tokens.

And the appearance setting was the app's most fragile surface. `darkMode: 'class'`
required `'system'` to be resolved by hand before it reached NativeWind, because
passing it through left the JavaScript following the device while the CSS waited for
a class nothing added. That shipped, on the default setting, past a green build and a
browser walk. The rule survived as a test and three paragraphs of comment.

## 1. Decision

Move to **Uniwind 1.11** and **Tailwind v4**.

NativeWind v5 was not an option: it is `5.0.0-preview.4` and its own documentation
says "not intended for production use".

## Consequences

**The token package gains a shareable artefact and loses a private one.**
`tailwind.config.js` and the v3 map are deleted. In their place are two generated
CSS files: `theme.css`, which the app imports, and `theme.standalone.css`, which
adds the `light` / `dark` variant definitions for a build that has no Uniwind to
supply them. Both carry `@theme` for the scales and the colour names, and the two
`@variant` blocks for the palettes.

The split is not decoration. `@variant light { … }` is an error unless something has
defined that variant, and Uniwind defines it — so a single file either fails for the
CMS or shadows Uniwind's definition in the app. The first draft of this decision
claimed one file served both; it did not, and importing it into a plain v4 build
failed outright with `Cannot use @variant with unknown variant: light`. Worse, once
that was patched by hand it *succeeded* while emitting no colour utilities at all,
because the registration that creates them is synthesised by Uniwind into its own
`node_modules`. Both halves are now generated, and a consumer outside the repo was
built against the real package to check.

**One file now serves both consumers, where two units were needed before.** The
generator resolved everything to px because NativeWind inlined `rem` against a root
size of 14. Uniwind resolves `rem` against 16 — the CSS convention, and the base
`wp-design-tokens` assumes — so `theme.css` keeps `rem` and the app still lands on the
same pixels. Every named spacing and radius token was checked to resolve to the
identical value it had under the v3 map; the numeric step is 2 px in both.

**The appearance rule inverted.** `setTheme` takes `'system'` — not as a registered
theme, but as a value it handles: it resolves the device scheme itself and reports
the resolved value, and it emits
both a `.light`/`.dark` class and a `prefers-color-scheme` fallback, so the two halves
cannot drift apart. `lib/theme/appearance.ts` now passes the setting through
verbatim, and resolving it by hand would be the new bug. The test that guarded the
old rule guards the new one, and keeps the story of the old defect — the discipline
it demands is unchanged: **check all three settings, and check `'system'` against both
device schemes.**

**Uniwind reaches deeper into Metro than NativeWind did.** It replaces
`transformerPath`, wraps `resolveRequest`, and rewrites the bare `react-native`
specifier plus a fixed list of component modules — on web, the matching
`react-native-web` ones — to `uniwind/components`, so `className` reaches the core
components. It takes the existing `resolveRequest` as its base, so the two resolver
workarounds in `metro.config.js` survive — but `withUniwindConfig` must be the
outermost wrapper, and that is a requirement, not a preference.

**A token name can collide with a Tailwind utility, and did.** Tailwind v4 has
logical *side* radius utilities, so `rounded-s` means "start side" — and the design
system has a radius token called `s`. Both rules were emitted and both applied: every
Badge, the search field and the duration chip on a video thumbnail got 4 px leading
corners and 2 px trailing ones. Nothing errored, and a token test cannot see it
because `--radius-s` still holds the right value and still emits a correct rule.
`--radius: initial` clears the DEFAULT key that generates the bare form of every
side utility, which resolves it for all ten names at once — including ones the design
system has not added yet. A test asserts that line is still emitted, because the
collision returns silently without it and no assertion about `--radius-s` can see it.

The first attempt at that guard refused any radius token named after a side, on the
theory that `--radius: initial` would not save them. It would; the guard would have
thrown on a plausible future `--var-radius-l` and pushed the next person to either
rename a design token or delete the line that does the actual work.

**Third-party components need wrapping.** Only `react-native` imports are rewritten,
so `react-native-safe-area-context`'s `SafeAreaView` and `react-native-webview`'s
`WebView` would drop a `className` silently — they are not `View`s underneath, so the
prop reaches a native component that ignores it. `components/ui/SafeAreaView.tsx` and
`components/media/VideoFrame.tsx` wrap them with `withUniwind`, which maps `className`
to `style`. The WebView case was latent: no call site passes one today, but
`videoFrameTypes.ts` declares it, and the web twin puts it on a real DOM `<iframe>`
where it works — so the two branches would have disagreed in exactly the way that
shared type exists to prevent.

**There is no Babel step any more.** Uniwind is a Metro plugin; `babel.config.js` is
back to `babel-preset-expo` alone.

## What was checked

The engine decides how the app looks, so the check was pixels rather than a green
build — sampled, not eyeballed, after reading a screenshot wrong once.

Android (API 36), all four appearance combinations, sampled off the screenshots:
`System` on a light device → `255,255,255`; `System` on a dark device → `26,26,26`
(`grey-100`) with muted text at `168,168,168` (`grey-600`); explicit light on a dark
device → white; explicit dark on a light device → `26,26,26`. The full
`tour-android.sh` ran with no missed step.

Web: light and dark via `prefers-color-scheme`, surface and card flipping together —
page `255,255,255` → `32,32,32`, card `248,248,248` → `41,41,41`. The two dark
numbers are not the token values, and that is the screenshot rather than the app: a
`div` painted a known `#1a1a1a` in the same capture reads back `32,32,32` too, and
`#242424` reads `41,41,41`. The app's surfaces match the reference swatch exactly.
Worth writing down, because reading a colour off a screenshot is how this check went
wrong once already — the picture looked light while the DOM, the computed styles and
the pixels all said dark.
