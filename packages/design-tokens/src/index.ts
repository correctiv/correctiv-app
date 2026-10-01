/**
 * CORRECTIV design tokens — the values, resolved once, for every consumer.
 *
 * `tokens/theme.css` at the repo root is the source of truth (vendored from
 * correctiv/wp-design-tokens; see tokens/README.md). CSS custom properties are the
 * right shape for a stylesheet and the wrong one for anything that has to compute
 * with a colour or hand a number to a layout engine. `scripts/generate.mjs` turns
 * them into that second shape, and everything in this package is its output.
 *
 * Consumers: `apps/mobile` (Expo / React Native) and, next, the CORRECTIV
 * WordPress CMS. The package therefore imports no UI framework, no platform SDK and
 * no dependencies at all — the same rule `packages/app-core` lives by, for the same
 * reason: whatever renders these values is the part that gets replaced.
 *
 * ## What is deliberately NOT here
 *
 * - **Font families.** The app embeds `Merriweather-Regular` and
 *   `SourceSans3-Regular` (PostScript names); those are native font names,
 *   meaningless to a CMS, which resolves the same two typefaces through the
 *   CSS stacks in theme.css. They stay in `apps/mobile/src/lib/theme/fonts.ts`,
 *   next to the weighted cuts.
 * - **The Tailwind theme itself.** It is not TypeScript at all: `theme.css` in this
 *   package's root is plain Tailwind v4, which is what makes it shareable. It is not
 *   re-exported here because CSS is imported by a bundler, not by a module —
 *   `@import '@correctiv/design-tokens/theme.css'`.
 * - **Anything that reads the appearance setting.** `colors` and `colorsDark` are
 *   two flat palettes; deciding which one is in force is the host's job (in the app,
 *   `useColors()`).
 *
 * Subpath imports work too — `@correctiv/design-tokens/tokens.generated` — and are
 * what the app uses, so that pulling in a colour does not pull in the reader's
 * embedded copy of theme.css.
 */
export * from './tokens.generated';
export * from './reader.generated';
