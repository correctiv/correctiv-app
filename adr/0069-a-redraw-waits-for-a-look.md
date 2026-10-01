# ADR 0069 — A redraw waits for a look

**Status:** accepted, built the same day · **Date:** 2026-10-01 · **Affects:**
`tools/figma-plugin`, nothing that ships

## Context

`kit.mjs` regenerates `spec.json` from the app's source, and the plugin redraws the
`Bausteine` page from it. A person who has changed something on that page by hand — a
radius, a fill, a label — loses it the next time the kit runs, and nothing says so. The
board and the spec are two descriptions of the same page, and the difference between them
is exactly what a person changed.

The return channel already exists: `server.mjs` accepts `POST /report` and `ui.html`
posts there after every draw. ADR 0021's rule holds throughout — only a JSON document
crosses the wire, no code is evaluated, and reading and reporting is not building.

The comparison needs a stable identity per node, because Figma ids do not survive a
redraw: the owned frames are deleted and rebuilt, so an id from the last draw names
nothing on this one. `setPluginData` gives one instead. The plugin stamps every node it
draws with its path in the spec and reads the key back while describing the board, so the
two sides speak the same vocabulary. The key is derived from the spec and re-stamped on
every draw, which is why it survives a redraw, and why it survives a move and a rename
too.

**The comparison is a pure function.** `diff(generated, reported, tokens)` in
`tools/figma-plugin/diff.mjs` takes two JSON documents and returns the differences. It
imports nothing from Figma and nothing from the network, so `tools/figma-plugin/test`
exercises it directly. The half that cannot be tested is the half that needs a running
Figma: `code.js` describing the board is Plugin API calls, and the record says so rather
than pretending a fixture proves it.

## Decision

### 1. The generated page `Bausteine` alone, never the hand-transcribed screens

**The comparison covers `Bausteine` and never the screens.** `Bausteine` is built from
the app's source by `kit.mjs`, so a difference there means something: the code and the
board disagree, and one of them is a person. The screens are transcribed from
screenshots (ADR 0021), so a difference there reports drift caused by the app moving,
not a designer. Diffusing the warning across both would devalue it — a warning that
fires on every app change is a warning nobody reads, and the one change that matters, a
person's own edit, would be lost in the noise. So the plugin describes the one page, and
the record is explicit that the other page is left alone on purpose.

### 2. The vocabulary of the spec is the ceiling, and a node's path in the spec is its name

**Two descriptions of the same thing, in the vocabulary the spec already speaks, keyed
by the spec path the plugin stamped.** Both halves are the same claim. The board is
described as frames, fills, radii and text because that is the only vocabulary both sides
share, and two nodes are the same node because their keys are equal. A difference the
spec cannot express reads as "changed, cannot say how" — enough to stop an overwrite,
not enough for an agent to act on.

The ceiling is the Plugin API as much as the spec. What the API cannot read back is
invisible to the diff by construction, and that limit is a property of the instrument
rather than a choice to be revisited per node. Two of them are named here because they
are the ones that cost something:

- **An instance's children are not described.** They belong to the component it points
  at, and the spec has no way to reach them. What is compared is `of` and `set`.
- **`layoutSizingHorizontal` / `layoutSizingVertical` are only readable on auto-layout
  frames, their children, and text nodes** (Figma's own wording on the property). A
  frame outside auto layout therefore has no readable sizing mode, and its size is
  compared as the number it measures rather than as an intent the API will not give
  back.

### 3. In sync is not adoptable, so every difference carries a class

**The redraw is refused while any difference is unresolved, and each difference is
classified as `expressible` or `off-scale`.** In sync is not the same as adoptable. A
radius set off the token scale is rejected, not copied: `kit.mjs`'s `px()` already throws
on an unknown token, and the board must not become a second place where a number is
decided. `expressible` means the board's value is a known token and could be written into
the spec as one; `off-scale` means it is a literal, a hex or a number the token table
does not have. Structural differences — a node added, removed or renamed — are
`structural` and are not values at all.

The class is information, not permission. Both classes block, because the point is the
warning rather than the adoption; what the class buys is that an off-scale value cannot
be quietly promoted into a decision by whatever reads the diff next.

Colours are compared as names and never resolved to hexes, which is the one place the
comparison could have been made easy and wrong: `@color-accent` and `@color-red-500`
resolve to the same light value often enough that resolving them would make a difference
a design system exists to keep compare equal. Spacing tokens ARE resolved to numbers,
because `@spacing-2xs` and `6` are the same padding and the scale's names are its point.

## Order of operations

The plugin stamps every node it draws. It describes the `Bausteine` page after every
draw, so the server holds a baseline, and again before every redraw, so the server holds
what the board says now. The server diffs the two and refuses the redraw while the
result is non-empty. The count surfaces in the plugin's UI, which already polls every
700 ms — the poll was there, and this is what it now decides.

The spec's own changes since the last draw are a **separate** diff and do not block:
they are the board being out of date, which is the ordinary case `kit.mjs` exists for.
Only a difference between what was drawn and what is on the board blocks, because only
that one is somebody's work.

## What is deliberately not solved

**The baseline lives in the server's memory.** A server that restarts has no baseline, so
the first redraw after a restart proceeds unguarded. Persisting it would mean writing
board state to disk, and this is a tool whose whole argument is that the board is
described rather than stored.

**A moved node is not detected.** The key survives a move and a rename, so a node that
only changed position still matches its spec entry and compares equal. Detecting a move
means comparing the board's own hierarchy against the spec's, which is what the key was
deliberately designed not to encode. A move is rare on a kit page and cheap to redo; a
false warning on every regeneration is not.

**Nothing is adopted.** The diff says what differs and stops. Turning an `expressible`
difference into a spec edit is a person's decision, and the record does not pretend
otherwise.

## What this retires

**The unconditional redraw.** Three claims said the board is rebuilt on every
regeneration, without a person in the loop. All three are now conditional on there being
nothing to lose:

- `tools/figma-plugin/README.md`: "edit `spec.json`, save, and it redraws within a
  second." It redraws within a second **when the board has not been changed by hand**,
  and waits with a count when it has.
- `code.js`, in `drawPage`: "Converge instead of stacking: drop what this document owns,
  then rebuild it." The convergence is unchanged; what changed is that it no longer
  begins without asking. The `owned` bookkeeping and the reason for it — a renamed
  component must not accumulate on the page — are untouched.
- ADR 0021 §1, "The plugin is an interpreter, not a builder… it draws whatever
  `spec.json` describes." Still true of what a draw does. What it no longer licenses is
  the assumption that a draw is always safe to start; the interpreter and the JSON-only
  rule it argues for are untouched.

**Not retired: ADR 0021's claim that the hand-transcribed screens are the part that
rots.** It stands, and §1 above says why it cannot be addressed here: a difference on
the screens reports the app moving, and gating on that would refuse a redraw for the
screenshot having fallen behind — noise wearing the costume of a warning.

## Consequences

The plugin stamps what it draws, describes `Bausteine` after every draw and before every
redraw, and a person who has changed something is asked to look before the board is taken
away. The server prints the count in the same `/report` line it already printed, and
`spec.json` on disk is unchanged by any of it.

The cost is that a description of the whole kit page crosses the wire twice per
redraw cycle, about 85 kB of JSON. It is a description, not the document: no code is
evaluated, and the file Figma holds is still the board.