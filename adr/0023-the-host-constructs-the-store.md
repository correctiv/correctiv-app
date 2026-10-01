# ADR 0023 — The host constructs the store

Status: accepted, 2026-08-27. Recorded 2026-09-04, after the fact.

## Context

[ADR 0009](0009-redux-toolkit-for-the-cores-state.md) put the core's state on one
Redux Toolkit store, and `@correctiv/app-core/stores/store` exported a ready-made
instance of it. The argument was the ordinary one: modules that are not components
need to reach the same store the screens are subscribed to, and an exported singleton
is the cheapest way to guarantee that.

Two things then made it unnecessary. `media/exclusive-playback.ts` works through
callbacks the host registers rather than by importing the other store, and the audio
watchdog moved inside the listener middleware, which gets its `dispatch` from the
store it belongs to. After both, every remaining reference to `stores/store.ts` from
inside the core is an `import type`.

A third thing made it impossible. Wiring Redux DevTools (#55) means passing an
enhancer, and `configureStore` takes its enhancers at construction. A module that
builds its store while it is being evaluated leaves no moment between "this file is
imported" and "the store exists" for anyone to hand one in.

## 1. Decision

**`@correctiv/app-core/stores/store` exports `createAppStore()` and no instance.**

The host calls it once and owns the result. `apps/mobile/src/lib/store/core.ts`
builds `coreStore` and passes the DevTools enhancer in development, which is the
whole reason the call is there and not here.

## What it costs, and what it buys

The singleton did not disappear, it moved: `core.ts` exports one, and with it an
invariant that has no other enforcement. The Provider must hold the same instance the
bound `coreActions` dispatch into, or a component reads one store and writes to
another and simply stops updating. Nothing about that failure is visible to a
typecheck, so it is pinned twice — `__tests__/root-layout.test.tsx` for the Provider
being handed that very instance, `__tests__/core-store-binding.test.tsx` for a
component's own writes landing in the Provider's store.

Against that, it removes a seam rather than adding one. While the core exported an
instance, a test that rendered screens against its own `createAppStore()` read one
store and wrote to another, and both halves succeeded.

## Why this is recorded after the fact

The move landed inside a pull request about typography generation and DevTools, and
nothing named it. It is a boundary move in the sense
[AGENTS.md](../AGENTS.md#decisions) means, so it should have had an ADR on the day —
and the cost of not having one is exactly what happened next: four comments and one
top-level document went on describing the old arrangement for eighteen days, in a
codebase whose comments are otherwise load-bearing.

## What this retires

No ADR made the claim, so nothing in `adr/` is struck through. Five places in the
code and the docs restated it, and all five are corrected in place — they are
comments and prose, not records:

- `ARCHITECTURE.md`, "Three conventions in the core", 1: "`stores/store.ts` explains
  why the core owns the instance rather than the host." **False since #55** — that
  file's own heading reads "The host constructs it, and there is no singleton here".
- `apps/mobile/src/lib/store/core.ts`, header: "`@correctiv/app-core` owns the store
  and the slices". It owns the slices. The store is the host's.
- `apps/mobile/src/lib/store/core.ts`, the note on `coreActions`: "the same reason the
  core owns the store instance at all, which the doc comment in
  `@correctiv/app-core/stores/store` sets out."
- `apps/mobile/__tests__/core-store-binding.test.tsx`: "The core exports a singleton
  and the binding dispatches straight into it."
- `apps/mobile/__tests__/root-layout.test.tsx`: "The Provider has to hold the core's
  singleton."
