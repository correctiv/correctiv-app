# @correctiv/design-tokens

The CORRECTIV design tokens, resolved into shapes a program can use: a Tailwind v4
theme carrying two complete colour schemes, the same values as typed constants in
px, and `theme.css` as a string for embedding in the article reader.

Colours come in three tiers — primitives, semantic roles, and the deprecated v1
aliases upstream keeps until its consumers migrate. Product code wants the semantic
ones (`bg-canvas`, `text-on-canvas-muted`, `border-stroke`); primitives exist to back
them, and are the right answer only where a colour must NOT follow the scheme. See
[ADR 0022](../../adr/0022-three-tiers-of-colour-and-a-dark-scheme-that-names-roles.md).

The source of truth is `tokens/theme.css` at the repo root, vendored from
[correctiv/wp-design-tokens](https://github.com/correctiv/wp-design-tokens), see
[tokens/README.md](../../tokens/README.md).

Three files are written by hand: `palette.js`, `scripts/generate.mjs` and
`src/index.ts`. Everything else here comes out of the generator and is never edited:
`npm run tokens` would overwrite the edit, and the drift check in
`apps/mobile/__tests__/tokens.test.ts` fails the build if it does not. Note that
the two CSS files are generated despite not being named `*.generated.*`. Their
names are the import paths a consumer writes.

No UI framework and no platform SDK, the same rule
[`@correctiv/app-core`](../app-core/README.md) lives by, for the same reason. This
package additionally has no dependencies at all, which app-core cannot claim: it
carries an HTML parser for its DOM extraction backend.

## Who consumes it

| Consumer | Uses |
|---|---|
| `apps/mobile` | `theme.css` (through Uniwind), the typed constants via `src/lib/theme`, and the reader CSS |
| CORRECTIV WordPress CMS | `theme.standalone.css`, *next*, not yet wired up |

```css
/* An app whose bundler already defines the light/dark variants, i.e. Uniwind. */
@import '@correctiv/design-tokens/theme.css';

/* Anything else on Tailwind v4: same tokens, variant definitions included. */
@import '@correctiv/design-tokens/theme.standalone.css';
```

The class half of the switch reads `:where(.dark, .dark *)` on `:root`, the **root
element**. A `dark` class on `<body>` does nothing; it has to be on `<html>`. Worth
knowing before reaching for `body_class()`, because the `prefers-color-scheme` half
keeps working either way, so a toggle would fail while the automatic path looked
fine.

**Your own `--color-*` overrides belong in a layer.** The dark block sits inside
`@layer theme`, and unlayered CSS beats every layer whatever its specificity — so a
plain `:root { --color-canvas: … }` in your stylesheet wins in *both* schemes and
silently takes that variable out of dark mode. Either put the override in a layer of
your own, or give it a dark value too. This changed on 2026-09-15: the dark block
used to be unlayered, and an unlayered override lost to it. It moved because the
native side of this repo cannot read it otherwise, and `apps/mobile/__tests__/design-tokens-standalone.test.ts`
now pins the position.

That the standalone file actually works for a consumer with no Uniwind is checked
on every PR: `apps/mobile/__tests__/design-tokens-standalone.test.ts` compiles it
with plain Tailwind and asserts the colour utilities appear and both dark paths carry
the dark values. It is there because this file has already been wrong twice, and
neither time was loud. See the test's own header.

Two files because `@variant light { … }` is an error unless something has defined
that variant. Uniwind defines it, so the app must not define it a second time and
shadow Uniwind's own; a plain Tailwind v4 build defines nothing, so the standalone
file brings its own. Importing `theme.css` alone into a plain v4 build fails with
`Cannot use @variant with unknown variant: light`, which is how this was found.

```ts
import { colors, colorsDark, spacingPx } from '@correctiv/design-tokens/tokens.generated';
import { READER_DARK_CSS, THEME_CSS } from '@correctiv/design-tokens/reader.generated';
```

Subpath imports, as above, so that reading one colour does not also pull in the
reader's embedded copy of `theme.css`. The `exports` wildcard names the `.ts`
extension, unlike `@correctiv/app-core`'s, which does not. That package is only
ever resolved by Metro and by this repo's own `tsconfig` paths, both of which guess
the extension; this one is meant to be read from outside the repo, where nothing
guesses and an extensionless target is simply a file that does not exist.
`src/index.ts` re-exports both and explains what the package deliberately leaves to
its hosts: the loaded font family names, which are React Native asset names rather
than token facts.

## Layout

```
palette.js                the dark values and the two role colours, hand-written
scripts/generate.mjs      the generator
theme.css                 the Tailwind v4 theme, what the app imports
theme.standalone.css      the same, plus the light/dark variant definitions
src/tokens.generated.ts   typed constants
src/reader.generated.ts   theme.css as a string, plus the dark override block
src/index.ts              the barrel, and the boundary explained
```

`palette.js` exists because `theme.css` ships no dark values at all — upstream's dark
block is a bare `@TODO`. It holds two lists: a dark value for every colour that names
a **role**, and the primitives that deliberately have none, because `white` names a
value and a value does not change with the scheme. The generator throws on a colour
that is in neither, which is how a token added upstream reaches a human instead of
silently staying light. Read it before adding a colour.

## Regenerating

```bash
npm run tokens          # from the repo root
```

That writes the artefacts in one pass over `theme.css`, so the two colour
schemes cannot be parsed twice and disagree. Nothing is written outside this
package.

**Generated files are never hand-edited.** They carry a header saying so.
`apps/mobile/__tests__/tokens.test.ts` regenerates them and byte-compares on
every CI run, so a hand edit, or a token change without a regeneration, is a
failed PR rather than silent drift.
