# ADR 0077 — A scale key may not name a Tailwind utility of another kind

Status: accepted, 2026-10-02, built the same day. It retires two claims in
[ADR 0008](0008-uniwind-over-nativewind.md) and nothing else, and it leaves that
record's line in the generated theme where it was.

## 1. The rule

**A token key may be any name Tailwind also has, as long as the class it produces
means the same thing in both.** What it may not do is produce a class that means two
different things, which is a collision, and which Tailwind v4 makes easy to walk into:
it has logical SIDE utilities (`rounded-s` for the start side, `-e`, `-t`, `-b`, `-l`,
`-r`, `-ss`, `-se`, `-es`, `-ee`), and it emits a BARE form of every one of them
whenever the theme declares a `--radius` default — which Tailwind ships.

So the distinction that matters is not "is this a key Tailwind has". Overriding a
Tailwind default with this design system's value is what a theme is for: `--radius-xs`,
`--radius-sm` and `--radius-md` replace Tailwind's three, `--spacing-s` replaces
nothing and `--text-l` replaces nothing, and refusing them would be refusing the
package's entire job. The distinction is whether the two agree about the axis they set.
`rounded-sm` sets `border-radius` in both, so it is an override. `rounded-s` sets
`border-radius` here and `border-start-start-radius` there, so it is two utilities
wearing one name.

The check that holds this is
[`apps/mobile/__tests__/theme-scale-collision.test.ts`](../apps/mobile/__tests__/theme-scale-collision.test.ts),
and it asks the question in the only form with an answer: every scale key is compiled
twice, once against this package's theme and once against Tailwind's default theme
alone, and the CSS properties the class sets have to be the same in both. The baseline
is Tailwind's DEFAULT rather than this package's, so the answer does not depend on
which consumer is asking — which is the whole of §2.

Run against the theme as it stood, it named one key out of all of them: the radius
scale's `s`. Every other scale is clean, including the two that look likeliest:
`--spacing-s` does not collide, because Tailwind emits no bare side form for the
spacing scale at all, and `p-s` compiles to nothing in Tailwind's default theme.

## 2. Why the name, and not the line that was supposed to save it

ADR 0008 found this collision and answered it with `--radius: initial`, which clears
the DEFAULT key and so removes the bare form of all ten side utilities at once. That
answer was right about the app, and wrong about everything it claimed to cover.

**It is one consumer's import order, not a property of the theme.** The app imports the
generated theme and nothing after it, so `--radius` stays cleared and the ten side
utilities never arrive. The workbench declares its own:

```css
/* apps/workbench/src/styles/app.css */
@theme {
  /* One radius, so the components agree without each carrying its own number. */
  --radius: 0.375rem;
}
```

That is a deliberate choice — shadcn's components are written against a default radius,
and the comment says why — and it is a good one. But it re-declares the key, so the
bare side utilities come back, and the radius token named `s` was one of the ten that
arrived. Measured on the workbench on 2026-10-02, in the browser and not from the
compiler: the site carried `rounded-s` 33 times over 20 files, and every one of those
class names had three rules in the cascade,

```
.rounded-s { border-radius: var(--radius-s); }
.rounded-s { border-radius: var(--radius-s); }
.rounded-s { border-start-start-radius: var(--radius); border-end-start-radius: var(--radius); }
```

Two meanings for one name, and the second one is Tailwind's own utility for a different
axis. The doubled `border-radius` is this build's own habit — every theme utility is
emitted twice here, `.rounded-xs` and `.rounded-full` included — and it is the third
rule that is the collision. Nothing about the token's value is wrong, so no assertion on
the value, and no test on the emitted file, can see it. Compiled from the app's own
theme the class had exactly one rule and always did, `--radius: initial` at work, which
is why the visible damage ADR 0008 described was the app's and this sat unnoticed for a
month after that record found it.

**A name cannot collide; a variable one consumer may set is not a guarantee.** So
`--var-radius-s` reaches Tailwind as `--radius-sm`, which is Tailwind's own spelling of
the same step. The scale becomes `xs sm md` — three names that need no explaining, and
the two the spacing scale already carries (`--spacing-s` and `--spacing-sm` are both
real there, 12px and 16px). The token keeps its value, and every `rounded-s` on the site
becomes `rounded-sm`.

`--radius: initial` stays, because it does something no rename can: it keeps ten
radii nobody chose out of the app, and `apps/mobile/__tests__/tokens.test.ts` still
asserts the line. The two are layered, not alternatives. What retired is ADR 0008's
claim that the line resolves the collision by itself — which is the sentence a reader
would act on and be wrong by.

## 3. Where the rename could not reach

`tokens/theme.css` is vendored byte-identical from `correctiv/wp-design-tokens`, and
`--var-radius-s` is the design system's own name — its second block carries an
`@theme inline` with `--radius-s` in it, so the collision is upstream's too, and a CMS
that imports that file as a Tailwind theme has it today. It is not changed here: not by
the generator, not by anybody else until upstream does, and `tokens/README.md` says the
file must stay byte-identical so a plain `diff` against a fresh checkout means
something.

So the rename happens where this repository has control — in
`packages/design-tokens/scripts/generate.mjs`, which maps the token to the name it
reaches Tailwind under — and it happens in both artefacts at once, `theme.css` and
`radiusPx`, because they are written from one scale in one pass. The same rename had
three more places to reach, and all three would have failed quietly rather than loudly:

- **`apps/workbench/src/styles/palette.css`** restates the radius scale as a plain
  `:root`, off editor density, and had written `--radius-s: 0.375rem` for the step it
  means. That declaration was live — an unlayered `:root` beats the `@layer theme` the
  package declares its own values in — which is why nothing on the site looked wrong and
  why the rename would have broken it rather than fixed it: `rounded-sm` with nothing
  under that name would have fallen back to the package's 2 px, and the site has shown
  6 px since #286. Renaming the token and renaming this line is one change, and a
  half-done one is invisible in both directions. The block spells the two names it
  invents (`lg`, `xl`) the way Tailwind does and the three it shares the way the package
  does; that is now stated there, because a reader counting five keys would otherwise
  "fix" it back.
- **`tools/figma-plugin`** named the token as `@radius-s` in `spec.json`, in
  `measured.json` and in `kit.mjs`'s scale table, and `sync-tokens.mjs` derives its
  tokens from the generated theme — so the board and the comparison would have kept
  asking for a name that no longer exists.
- **`apps/workbench/src/lib/cn.ts`** could not register `s` in `tailwind-merge` at all,
  because `rounded-s` there is the start side with a group of its own. With the key
  renamed, all three radius names are Tailwind's own and the merge needs none of them.

## What this retires from ADR 0008

Two claims, both in that record's Consequences and struck through where they stand, with
the argument around them intact:

1. that `--radius: initial` "resolves it for all ten names at once … including ones the
   design system has not added yet", and that the test on that line is therefore what
   keeps the collision out;
2. that a guard refusing a radius token named after a side "would have thrown on a
   plausible future `--var-radius-l` and pushed the next person to either rename a
   design token or delete the line that does the actual work".

The second is right about the guard it rejected and wrong about the alternative, and
the record says so. What is kept is narrower than the guard that was thrown away: a key
is refused only when the class it names is a Tailwind utility of another kind, not when
it is one Tailwind happens to have. A future `--var-radius-l` — say — passes.

## What was checked

`npm run check` green, and `npm run workbench:renders` on the dev server, because a
green check says nothing about whether the workbench mounts (ADR 0031).

**The render does not move, and that is the finding rather than a null result.** The
landing's `packages/app-core` chip, before and after, cropped to the element at 3× so the
corners are legible: the two images are identical, `compare -metric AE` reports zero
changed pixels, and both read 6 px on all four corners. The workbench's own radius block
had already put 6 px under that class name, so the side rule beside it was redundant
rather than visibly wrong — which is exactly why nobody reported it, and why this is a
finding about the cascade rather than about a picture.

What changed is what the cascade contains. `.rounded-s` went from three rules to one:
the theme's `border-radius` is gone and what is left is Tailwind's own side utility,
meaning what it says. The token's class is `rounded-sm` now, and it means one thing.

The app was never visibly affected and still is not: compiled from its own theme, where
`--radius: initial` holds, `rounded-s` had exactly one rule before this and the small
radius is 2 px before and after.

The check itself was read red before it was read green: with the key spelled `s` again,
`radius key s -> .rounded-s means one thing` is the only assertion that fails, and it
names the key rather than a list of them.

Both crops are in [`screens/evidence/radius-scale-collision/`](../screens/evidence/radius-scale-collision/),
`chip-before.webp` and `chip-after.webp`.