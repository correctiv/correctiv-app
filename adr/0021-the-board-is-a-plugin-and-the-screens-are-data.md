# ADR 0021 — The design board is a plugin, and the screens are data

**Status:** accepted · **Date:** 2026-09-03 · **Affects:** `tools/figma-plugin`, nothing
that ships

## Context

The app needed a design board: every screen at 360x800, once as a faithful replica and
once as a wireframe, so that a layout can be argued about without reading TypeScript.

Two routes existed before writing anything, and both were tried. This ADR exists
because their ceilings were **measured**, and a measurement nobody records is a
measurement somebody repeats.

## What was measured, and rejected

**Figma's cloud MCP server: 20 tool calls per month** on the Starter plan. Three tools
are exempt (`create_new_file`, `whoami`, `add_code_connect_map`); everything that draws
is not. That budget builds roughly thirteen screens and then stops until the next
month. The quota was exhausted proving this.

**figma-linux-next's built-in MCP server: no budget, but seven fixed write
operations** — `create_frame`, `create_text`, `create_rectangle`, `update_node`,
`delete_node`, `reparent_node`, `set_variable`. What that vocabulary cannot express is
not marginal: no vectors, so no pencil outlines; no ellipses; no
`layoutSizing* = FILL` on a child, so no column that fills its parent; and
`update_node` cannot change a font. It is also one HTTP round trip per node, against
screens that run to hundreds of nodes each.

Its **read** side has neither problem and is still the right way to check a result.
That is how these screens were compared against `screens/android/`.

## 1. Decision

A Figma plugin, because a plugin is the only channel with the whole Plugin API and no
quota. It lives in `tools/`, which is where something that is neither a host nor
behaviour belongs ([ADR 0014](0014-the-preview-shell-as-a-package.md)).

**The plugin is an interpreter, not a builder.** `code.js` knows nothing about the app;
it draws whatever `spec.json` describes, and `spec.json` is served over localhost by a
tiny HTTP server the plugin's iframe polls. Two consequences, and they are the reason
for the split:

- Changing the board never means changing code, and never means re-importing the
  plugin. Figma's dev-plugin import is the slowest step in the loop by a wide margin.
- **Only a JSON document ever crosses the wire.** No code is sent to be evaluated. An
  earlier attempt at an eval bridge was blocked, twice, and the interpreter is the
  answer to that rather than a way around it. It is also the better design: the
  vocabulary is a contract, and a contract can be audited.

**Generated from the app, not transcribed from it.** The component kit, the design
tokens and the type scale are read out of `packages/design-tokens` and
`apps/mobile/src/components` by `kit.mjs` and `sync-tokens.mjs`. The board is
therefore a second place where a token change shows up, and `kit.mjs` refuses to
write at all rather than emitting a component that quietly lacks a prop its source
has. A third script, `use-kit.mjs`, reads neither package: it only rewrites the
board's own description, turning copies into instances of what the other two made.

## What is deliberately not solved

**The screen content is hand-transcribed** from the screenshots in `screens/android/`.
That is the part that rots: change a headline in the app and nothing here notices.
Deriving it would mean rendering the app, which is what the screenshots already are.

**A Figma instance takes no children and no colour override.** So a card that carries
content cannot be a component, in Figma or in the kit. ~~The same wall stands in the app,
where seventeen call sites write an `Overline` over a `Card` inline and that shape has
no name.~~ **Named on 2026-09-10**: a React component does take children, so the shape is
`SectionCard` in `apps/mobile/src/components/ui` and sixteen of those call sites are it,
the seventeenth being Backstage's "Termine", one label over a card per event, which the
component cannot absorb and which stays inline.

**A second Figma variable mode is a paid feature.** The tokens carry a light and a dark
value; on a Starter plan `addMode` throws and the collection stays light-only.

## Consequences

Nothing here ships and the app does not depend on it, so a broken board is never a
broken release. The cost is that `tools/figma-plugin` is a second consumer of the token
packages, and a rename there now breaks a generator as well as the app.

Running it on Linux needs figma-linux-next, and three of its traps cost an hour each.
They are written down in the tool's README rather than here, because they are facts
about a client version and not a decision.
