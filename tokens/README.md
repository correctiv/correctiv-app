# Design tokens (vendored)

The binding source of truth for colours, spacing and type, copied from
**[correctiv/wp-design-tokens](https://github.com/correctiv/wp-design-tokens)**.

| | |
|---|---|
| Upstream | `https://github.com/correctiv/wp-design-tokens` |
| Commit | `8ed7a28601c43c17b099e0d5768c62b228a4ac19` (`main`, after `v0.1.1`) |
| Upstream licence | GPL-2.0-or-later, compatible with this repo's AGPL-3.0-or-later |

## Why vendored, and not a submodule or an npm dependency

- **~~npm dependency is not available.~~ That reason expired on 2026-08-27.** The
  package declares `peerDependencies: { tailwindcss: ">=4.1" }`, which NativeWind 4
  could not satisfy because it is a Tailwind v3 engine, so installing it needed
  `--force` or a repo-wide `legacy-peer-deps`. The app is on Tailwind v4 since
  [ADR 0008](../adr/0008-uniwind-over-nativewind.md), so the conflict is gone.
  Vendoring stays for the two reasons below, which never depended on it.
- **A submodule is more apparatus than 11 KB of CSS deserves.** It would put a
  `--recurse-submodules` requirement on every clone and a `submodules: true` on
  every CI checkout, to deliver two files that change a few times a year.
- **The apps never needed the source at all.** Everything derived from these
  files is generated and committed, which is why the app renders correctly on a
  fresh clone. The source is needed for exactly two things: regenerating, and
  detecting drift.

Vendoring gives both of those everywhere, CI included, where the drift check used
to skip itself. The cost is having to notice upstream changes by hand.
That trade is recorded below.

## What is here, and what reads it

| File | Consumed by |
|---|---|
| `theme.css` | `packages/design-tokens/scripts/generate.mjs`, via `scripts/tokens-source.mjs` |
| `typography.css` | **nothing, programmatically.** Hand-transcribed into `apps/mobile/src/lib/theme/typography.ts` |

`utility.css` exists upstream and is deliberately not vendored: nothing in this
repo reads or mirrors it.

Both files are kept **byte-identical** to upstream, with no added header, so that a
plain `diff` against a fresh checkout is meaningful, and because `theme.css` is
embedded verbatim into the reader WebView via `@correctiv/design-tokens`
(`src/reader.generated.ts`).

### Known gap

`typography.css` is mirrored by hand, so drift there is invisible to the checks. It
is vendored anyway to make the reference reviewable in-repo and to leave the door
open for a generated typography scale later.

The dark-mode block in `theme.css` is **empty**: a bare
`@TODO define dark mode theme`. Until `9d4d922` it was a placeholder carrying the
light values under `@TODO Set this to the actual values`, which is worse than empty
— it would have compiled into a dark mode identical to light. The generator never
read it either way; see the note on `firstRootBlock()`.

The app's dark scheme is therefore hand-written in
`packages/design-tokens/palette.js`, which says so and explains where each value came
from. When upstream fills the block in, the generator can read it and that file
becomes a deletion.

### The colour tiers

Since `9d4d922` the colours come in three tiers: primitives (`white`,
`neutral-100…700`, `red-500`, `yellow-400`), semantic roles (`canvas`, `on-canvas`,
`stroke`, `accent`, …) and the deprecated v1 aliases (`grey-100…700`, `emphasis`,
`alternative`), which keep their values until upstream's consumers migrate. The app
is on the semantic tier as of
[ADR 0022](../adr/0022-three-tiers-of-colour-and-a-dark-scheme-that-names-roles.md);
what still sits on an alias, and why, is listed there.

## Updating

```bash
# 1. Has upstream moved? Compare against the commit recorded above.
git ls-remote https://github.com/correctiv/wp-design-tokens.git HEAD

# 2. Copy the files in (from any checkout of the token repo), then:
npm run tokens                     # regenerates the artefacts

# 3. Update the commit in the table above, and commit source + generated
#    files together.
```

The Figma board follows the generated theme rather than this file, and it does not
follow it by itself:

```bash
node tools/figma-plugin/sync-tokens.mjs   # then run the plugin from Figma
```

Skip that and the board keeps painting the last values it was given, which is how it
comes to disagree with the app about a colour while still looking finished.
See [`tools/figma-plugin/README.md`](../tools/figma-plugin/README.md).

Step 2 is not optional: `apps/mobile/__tests__/tokens.test.ts` regenerates
and byte-compares, so a token change without regeneration fails CI. That is the
check the vendoring exists to make possible.
