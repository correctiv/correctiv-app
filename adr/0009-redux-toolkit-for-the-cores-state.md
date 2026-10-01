# ADR 0009 — Redux Toolkit for the core's state

Status: accepted, 2026-08-27. Expires statements in
[ADR 0004](0004-react-native-pivot.md) and [ADR 0006](0006-one-core-two-hosts.md);
see the end of this file.

## Context

`packages/app-core/src/stores/` held ten hand-written observable stores on an
81-line `create-store.ts`. Its file header explained why it was not zustand:
zustand's package exports list a `react-native` condition before `import`, and
`@nativescript/vite` does not set `import`, so it resolved the CommonJS build and
Rollup failed with `"createStore" is not exported by node_modules/zustand/vanilla.js`.
Typecheck and the Expo build both passed; only the NativeScript bundle broke.

**That reason expired with [ADR 0007](0007-removing-the-nativescript-host.md).**
There is one host, and it is Metro. So the question was no longer "custom store or
zustand" but "keep maintaining a bespoke store, or use something standard".

A bespoke store is a maintenance liability precisely because it is invisible. That
one had a `[...listeners]` snapshot in its notify loop carrying the comment "the
copy IS the point — removing it fails the test". Load-bearing, unreviewed, and
exactly the kind of line someone tidies away.

The deciding factor is not technical. CORRECTIV is advised by an external agency
which may take over maintenance, and that agency recommended Redux. **A vocabulary
every React developer already knows is worth more here than any property of the
implementation**, and this ADR should say so rather than dress the choice up as a
measurement.

## 1. Decision

Redux Toolkit, one store, ten slices. The host binds with `react-redux`.

## The honest cost, measured

The commit before and after this migration, both built:

| | raw | gzip |
| --- | --- | --- |
| before | 4 002 328 | 1 284 859 |
| after | 4 075 578 | 1 308 178 |
| | **+73 KB** | **+23 KB (+1.8 %)** |

And the alternative that was not taken: **zustand was already in the bundle** — the
app bound the old stores with its `useStore`. Pointing the core at `zustand/vanilla`
would have deleted the same 81 lines for roughly nothing, with less ceremony. On
bundle size and on ergonomics, that was the cheaper trade. It loses on the one axis
that decided this: an external maintainer's first day.

Also paid, and worth recording: the migration introduced three defects that did not
exist before — a `persist()` debounce that any unrelated dispatch could postpone, a
`persisted()` id typed as a plain string where a typo silently stopped all writes,
and a `toggle` that removed one match where its sibling removed all. All three were
caught by review, none by a green build.

## Consequences

**Plain thunks, not `createAsyncThunk`.** Its value is the pending/fulfilled/rejected
triple and not one of these cascades wants it: `feeds.fetch` shows stale items
*while* loading, `podcasts.fetchAll` decides between ready/partial/offline after the
fact, `media.fetch` enters `loading` only when it has nothing to show. They set their
own status at their own moments. Multi-argument actions also survive this way.

**`prepare` keeps reducers pure.** `membership.join` and `participation.submit` stamp
a timestamp in `prepare`, where impurity is allowed, while the reducer only decides
whether to keep an existing `memberSince`.

**The storage layout is unchanged.** `persist()` still writes `store.<id>` holding
only the declared keys, so an installed app kept its settings, saved articles and
membership across the migration.

**`immutableCheck` is off.** It walks the whole state tree on every dispatch, and the
audio position tick dispatches twice a second against six feeds, seven podcast series
and three video channels. What it would catch — a reducer mutating a bundled offline
snapshot — Immer's auto-freeze already throws on, at the mutation rather than a
dispatch later. `serializableCheck` stays, with the three network-payload slices
skipped to bound its cost.

**The audio side effects are a listener middleware.** `dispatch`/`getState` are gone
from function parameters, and `pause()` is a listener on `failed` — a listener effect
cannot run before the reducer, so "state first, command second" is structural rather
than a rule to remember. That ordering was the only thing between the old code and
`RangeError: Maximum call stack size exceeded` on a device. Two module variables
remain: the watchdog handle and the backend-listener memo. Both were measured to be
load-bearing — the app's test suite nulls the backend's listener while keeping its
object identity, and an unclearable timer leaves an open handle — so
`resetAudioController()` stays and still does real work.

**The storage port became asynchronous, and that is a consequence of this decision
rather than a separate one.** `KeyValueStore` was synchronous because `persist()`
read it while a store was being constructed, which forced the Expo host to keep an
in-memory mirror, hydrate it at startup, and warn in two files that reading before
hydration starts the app on empty state and then overwrites the real state on the
first write. Redux moved store construction to module load and made `persist()` a
separate, later call the host already awaits — so there was nothing left to be
earlier than. The port is async, and the mirror, the hydration step, the write-behind
flush and that whole failure mode are gone: 45 lines. In production `keyValue` had
exactly one caller, which is why the blast radius was that small.

**What this decision has NOT yet bought.** Redux DevTools are not wired up, there is
no middleware beyond the audio listener, and nothing replays or time-travels. That is
most of what Redux is usually chosen for. Wiring DevTools is the cheapest way to stop
paying 23 KB for nothing.

## What this expires elsewhere

- **[ADR 0004](0004-react-native-pivot.md), "The core is framework-free"** — "The 8
  stores run on `zustand/vanilla`" was already wrong before this change (they ran on
  the core's own `create-store.ts`); there are ten slices on Redux Toolkit now, and
  the host binds with `react-redux`, not zustand's `useStore`.
- **[ADR 0004](0004-react-native-pivot.md), "The port was synchronous"** — the
  in-memory mirror it describes no longer exists.
- **[ADR 0006](0006-one-core-two-hosts.md), the ports table** — `KeyValueStore` is
  not "small settings, synchronously" backed by "AsyncStorage + a hydrated mirror";
  both ports are asynchronous and the adapter is a passthrough.
- **[ADR 0006](0006-one-core-two-hosts.md)** — "`KeyValueStore` stays synchronous
  because `persist()` reads it while a store is [constructed]" is the exact premise
  this decision retired.

Those files are records, not descriptions, and are not rewritten — see the notes in
[the index](README.md).
