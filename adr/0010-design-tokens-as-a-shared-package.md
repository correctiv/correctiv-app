# ADR 0010 — The design tokens as a shared package

Status: accepted, 2026-08-27.

## Context

The token bridge lived in `apps/mobile-rn/scripts/generate-tokens.mjs` and wrote
three artefacts into the app. That was correct while the app was the only consumer.

It is not the only prospective one. CORRECTIV's WordPress CMS renders the same brand,
and `tokens/theme.css` is a vendored copy of *its* `wp-design-tokens`. So the values
already come from the CMS side — but one thing does not, and it is the thing that
matters: **the dark palette.** ~~`theme.css` ships a `prefers-color-scheme: dark`
block marked `@TODO Set this to the actual values` whose values are the light ones.~~
Reading it would produce a "dark mode" identical to light. ~~`palette.js` in this repo
assigns every grey by the role it plays in the majority of its uses, and records why
an inverted scale would be wrong.~~ That file is what a second consumer would come
here for.

> Both struck claims are voided by
> [ADR 0022](0022-three-tiers-of-colour-and-a-dark-scheme-that-names-roles.md).
> wp-design-tokens `8ed7a28` deleted the placeholder block, and `palette.js` now
> assigns a value per semantic **role** rather than per grey. The conclusion the
> paragraph draws — that the dark palette is this repo's to decide, and that it is
> what a second consumer comes here for — is unchanged.

## 1. Decision

`packages/design-tokens` — the generator, `palette.js`, and every artefact it writes.
Nothing is written into the app any more.

## Consequences

**Two CSS files, and the split is not decoration.** `theme.css` is what the app
imports; `theme.standalone.css` is the same plus the `light` / `dark` variant
definitions. `@variant light { … }` is an error unless something has defined that
variant — Uniwind defines it, so a single file either fails for an outside consumer or
shadows Uniwind's definition in the app.

This was got wrong first, and the way it was wrong is worth recording: the initial
version claimed one file served both. It failed outright under plain Tailwind v4 with
`Cannot use @variant with unknown variant: light`, and once that was patched by hand
it *succeeded while emitting no colour utilities at all*, because the `@theme`
registration that creates them is synthesised by Uniwind into its own `node_modules`.
A green build and a silently colourless stylesheet. Both halves are generated now, and
the claim was re-checked by building a consumer linked from outside the workspace.

**The `exports` map names the `.ts` extension**, unlike `@correctiv/app-core`'s. That
package is only ever resolved by Metro and by this repo's own `tsconfig` paths, both
of which guess an extension; this one is meant to be read from outside the repo, where
nothing guesses and an extensionless target is a file that does not exist.

**`tokens/` stays at the repo root, and is not folded into this package.** It is
vendored third-party material under **GPL-2.0-or-later** while this repo is
AGPL-3.0-or-later. A clearly named top-level directory with its own README stating
provenance, upstream commit and licence makes "this is not ours" visible at a glance;
nesting it inside a package we author and licence differently blurs a boundary that
should stay sharp. Two guards also hang off that path: `.oxfmtrc.json` ignores
`tokens/**` so the vendored bytes stay byte-identical to upstream, and
`apps/mobile-rn/__tests__/tokens.test.ts` asserts the resolution path is inside this
repo — after an upward search once found a *foreign checkout* at a different commit
and a developer and CI generated from different sources while agreeing.

**Font families deliberately stay in the app.** `Merriweather_400Regular` and
`SourceSans3_400Regular` are `@expo-google-fonts` asset names — a family name only
means something to a runtime that has loaded that font, and the CMS resolves the same
two typefaces through CSS stacks. They live in `apps/mobile-rn/src/lib/theme/fonts.ts`.

**Drift is a failed PR, not a discovery.** `tokens.test.ts` regenerates all four
artefacts and byte-compares them, and it restores the committed bytes afterwards — a
check that repairs what it reports would go green on the next run with nothing done
about it.

## What this has not delivered

**Nobody imports it from outside this repo.** `theme.standalone.css` was built against
a real consumer linked from outside the workspace, so the capability is verified — but
until the CMS actually reads it, the justification above is an intention rather than a
fact. That is the one thing worth doing next with this package.

**`tokens/typography.css` is read by nothing.** `apps/mobile-rn/src/lib/theme/typography.ts`
describes itself as "a 1:1 translation of the `ty-*` utilities in
wp-design-tokens/css/typography.css" and is maintained **by hand** — eleven variants of
size, tracking and leading, transcribed from a file sitting right next to the generator
that transcribes everything else. There is no drift check, because it is not a generated
artefact. Generating those specs is the obvious next step, and it is also the answer to
"why is that file vendored at all".
