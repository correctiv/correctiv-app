# ADR 0072 — Features are released by a commit and never by a fetch

Status: accepted, 2026-10-01, decided by the product side. Not built.

## Context

The app contains things that are not ready to reach a store build: the demolition atlas and
the callouts read sample data only, the Europe feed is broken, the quarterly report and the
club's diary are drawn over fixtures. Today "not ready" is a fact in people's heads and in
`SOURCES.md`; nothing in the code stops one of them being reachable from a release.

[ADR 0071](0071-screens-become-documents-and-the-tab-bar-becomes-one-too.md) makes the
layout something the newsroom edits and the app fetches. That raises the stakes of the
question, because a fetched document that can place any block anywhere would, unless
something else holds it, put an unfinished thing into a store build without a release. The
two have to be separate: **what is arranged** is layout, and **what may be reached** is a
release decision.

## Decision

### 1. A build has a channel, and the app sets it itself

The channel is `release` or `preview`, chosen by the host and handed to the store the way
`SHIPPED_LOCALE` is ([ADR 0049](0049-the-catalogue-is-a-package.md) §3), as a construction
parameter of `createAppStore()`. The core never reads an environment to find out.

| Channel | Where | What is reachable |
|---|---|---|
| `release` | Android and iOS release builds | only what is `an` |
| `preview` | the dev server, the web export on Pages, the workbench frame | `an` and `vorschau` |

### 2. Fail closed, and iOS needs no configuration of its own

A native build without `__DEV__` is `release` unless something explicit says otherwise.
Only the web export and the dev server say `preview`, and each says it in its own entry
point. So iOS, which has no release workflow of its own to configure, is safe by default,
and a forgotten setting makes a feature disappear rather than ship.

The Android release workflow may take a manual input for a tester build in `preview`. It is
an explicit act on a workflow run and is never the default.

### 3. A feature has three states: aus, vorschau, an

`aus` is reachable nowhere. `vorschau` is reachable in `preview` and not in `release`.
`an` is reachable in both. Three and not two, because "visible to the people who test it
and invisible to the readers" is the state the unfinished things are actually in, and a
boolean would force them to be either exposed or hidden from the testers who need them.

Features are grouped, and a group is the **ceiling of its members**: a group that is
`vorschau` cannot have a member that is `an`. A feature may also name features it requires,
and it is no more reachable than they are.

### 4. Data provenance is a ceiling

Every data source in the core declares whether it is `live` or `sample`. A feature whose
sources are all `sample` can be `vorschau` at most; `an` is not selectable for it, and the
feature's page in the workbench says why. **Effective state is the least of the declared
state, the ceiling from the data, the ceiling from the group and the state of what it
requires.**

The ceiling is enforced twice. A test refuses a committed `an` that the data cannot carry,
which is the check that matters because it fails before a release. The selector applies the
same minimum at runtime as a safety net, so a mistake that got past the test degrades to
`vorschau` and not to a half-working screen.

`Provenance` lives in the core. The workbench's source manifest has held this fact until now
and the app may not read the workbench
([ADR 0040](0040-the-app-does-not-depend-on-the-workbench.md)), so the manifest is checked
against the core by a workbench test, which leaves one fact and one check.

### 5. What a feature gates

A block, a tab, a route including a deep link, and an entry in search or in Entdecken. An
unreachable route resolves to the not-found screen, a tab with no reachable content is
dropped, an entry is filtered out. A block of an unreachable feature in a document is
**omitted silently**: the reader of a release build must not see a gap or a notice, and the
document stays valid so that the same file is correct in the preview.

In the tools the same block is **shown and labelled**, with the reason: in the palette, the
gallery and the component page, so a person arranging a screen sees what they cannot ship and
why. Hiding it there would repeat in the editor the invisibility this record exists to end.

Home is not a feature and cannot be turned off; its blocks can. Account, login and settings
are the fixed frame of the profile and stay outside this mechanism; the content blocks inside
it are gated like any other.

### 6. The release file is a commit, is bundled, and is never fetched

The states live in `packages/app-core/src/data/features.json`, change only by a commit, and
are read only from the bundle. **The app never fetches them.** The whole purpose of the
mechanism is that a store build contains a known answer to "what can a reader reach", and
an answer that can be replaced from the network is not one. A fetched layout can therefore
only arrange blocks the bundled release already allows; it can never unlock one.

The workbench may override the states for a person trying things, in the frame only and
through a `workbench:` key that the app declares and the workbench writes, the pattern the
home layout's preview override already uses (ADR 0057 §4). Releasing a feature is a
submission of `features.json` by the route of ADR 0058 and ADR 0061, so it is reviewed like
any other change.

### 7. Release and layout are separate files with separate writers

`features.json` and the documents of ADR 0071 are different files, parsed by different
code, with different ways in. This is the same separation as ADR 0057 §2 drew between
WordPress and the workbench: the two writers cannot break each other. A wrong layout shows
the wrong thing in the right place of a feature that was already allowed. A wrong release
file is a diff in a reviewed pull request and cannot be reached from the network.

## Why not the alternatives

**Remove the code from a release build.** It would give the strongest guarantee and costs the
most: the app has no dead-code elimination switched on
([ADR 0054](0054-a-block-declares-where-it-may-appear.md) §4),
and a build-time removal makes the preview and the release two programs. A run-time switch
over one program keeps what the testers see equal to what ships, minus a flag.

**Let the fetched document carry the state.** Refused in §6: it makes the store review
meaningless for exactly the things most in need of one.

**A boolean per feature.** Refused in §3.

**Derive reachability from the source manifest alone.** The manifest knows the data and not
the intent: a live source can still belong to a feature the product has decided to hold
back. The declared state and the ceiling are two inputs because they answer two questions.

## What it costs

**Every gated thing declares its feature, and a thing that does not is reachable.** The
default has to be a test, not a hope: feature ids are checked in both directions against
`features.json`, and the `release` channel is tested to reach nothing of a feature that is
not `an`.

**The release file and the layout can disagree on purpose.** A document may place a block of
a feature that is `vorschau`, and a release build then draws nothing there. That is intended,
and it is also the case where an editor believes they have shipped something they have not;
the tools label it for that reason.

**An old store build keeps its own answer.** Releasing a feature reaches readers with the next
build and not before. That is the cost of §6, and the point of it.

## What this retires

Nothing is struck. [ADR 0071](0071-screens-become-documents-and-the-tab-bar-becomes-one-too.md)
§6 says the layout is fetched; this record is the bound on what that fetch may do.
