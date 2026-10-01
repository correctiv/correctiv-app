# ADR 0049 — The catalogue is a package, and the locale comes from the host

Status: accepted, 2026-09-18. **§1, §2, §5 and §6 built in [#219](https://github.com/correctiv/correctiv-app/pull/219); §3 and §4 in [#221](https://github.com/correctiv/correctiv-app/pull/221).** §4 has the second user it named since the preview gained `lg=` in [#226](https://github.com/correctiv/correctiv-app/pull/226): the phone passes `SHIPPED_LOCALE`, the workbench passes what its address says (`apps/workbench/src/preview/frame/locale.ts`). §4's "neither does yet" describes what #221 built and is what has moved, and is struck there now; the desktop host is still the one that has not arrived.

The split is deliberate and the line is behaviour: [#219](https://github.com/correctiv/correctiv-app/pull/219)
moves files and changes nothing a reader sees, so it can be reviewed as a move. §3 and §4
change what the app can do, and want reviewing as that.

## Context

[ADR 0026](0026-react-native-review-and-hardening.md) §6 asked for two languages from the
first string and got most of the way there. A descriptor's `defaultMessage` is English and
lives beside the component; the German that ships is data; extraction runs over the app and
the core; two checks hold the halves together. That shape has survived 317 ids and is not
what this record changes.

Three things it left, each found by looking rather than by reasoning:

**The core's German lives inside an app.** `packages/app-core` owns vocabulary — the three
audio failures, the ten fact-check verdicts, the words `buildReaderHtml` prints — and the
German for those `core.*` ids sits in `apps/mobile/src/i18n/catalogue/de/core.ts`. With one
host that reads as tidy. With two it has no answer: the GTK host on the `desktop` branch
resolves `@/*` to `../mobile/src/*`, so its translations already hang off the phone's source
tree, and the workbench would have to reach into the app for a word the core owns.

**The locale is a constant that four things pretend is a variable.** `settings.ts` has
`export type Locale = 'de'` and a selector whose comment says it is "a selector rather than a
constant, because that is the one shape a second language would not have to rewrite".
`Localisation.tsx` types its registry `Record<Locale, …>` so that a locale without a
catalogue fails to typecheck. Both are right. But `createAppStore()` takes enhancers and
nothing else ([ADR 0023](0023-the-host-constructs-the-store.md)), so there is no way for a
host to say which language it is in, and the value is therefore written into the core.

**Nothing compiles anything.** ADR 0026 §6 says "the compiled catalogues are build
artifacts". `formatjs extract` runs; `formatjs compile` has never run in this tree. `en.json`
is generated, committed, and imported by nobody — it is a check's input and a translator's
file, not a catalogue the app can render.

## Decision

### 1. The catalogues are a package of their own, `@correctiv/catalogue`

Every string the app ships, by locale, in one workspace package: `src/de/` one file per id
namespace as before, and `src/en.json` as the extractor writes it. Data only — no React, no
platform SDK, no descriptors.

The precedent is `packages/design-tokens` and not `packages/app-core`: a framework-free data
package with several consumers, a generated artefact and a drift check under it, consumed as
TypeScript source through an exports map. Nothing about it is new machinery.

**What this buys is one sentence: the core's German is no longer in an app.** Everything else
follows from that. A second host takes a dependency instead of reaching into a sibling's
source tree; the registry that pairs a locale with a catalogue is typed once for every host
rather than once per host; and the day a translation file has to leave this repository, there
is a directory to point at.

### 2. Four things do not move, and each would have been the tempting mistake

**The descriptors.** A `{ id, defaultMessage }` stays where the string is, in the screen or
in the core. Collecting them here would undo ADR 0026 §6's central decision — the one that
made the migration cheap — and turn every screen into an importer from a bag of words.

**The provider.** `Localisation.tsx` holds an `intl` instance and imports React. It is the
host's, it stays in the host, and this package imports no UI framework for the same reason
the core does not.

**`polyfills.ts`.** It looks like it belongs with the catalogues and it does not: it is about
Hermes, not about language, and `apps/workbench/vite.app.mjs` replaces that exact module by
directory and filename because its conditional `require` calls empty every page of the dev
server when a non-Metro bundler hoists them (#160). The plugin throws at build time if the
module is not where it expects it, which is the good failure, and moving the file would buy
nothing and cost that.

**The workbench's own strings.** A second audience and a vocabulary of its own, and the app
may never depend on the workbench ([ADR 0040](0040-the-app-does-not-depend-on-the-workbench.md)).
The workbench uses this package's *shape* and holds its own words.

### 3. English becomes a locale the app can actually render

`formatjs compile` turns `src/en.json` into the flat `Record<string, string>` the provider
already expects, committed beside the German and held current by a drift check, exactly as
`packages/design-tokens` does with `theme.css`.

It is not needed to make English *appear* — `defaultLocale="en"` already falls back to every
`defaultMessage`. It is needed to make English appear **without an error**: `onError` throws
on `MISSING_TRANSLATION` under `__DEV__`, so a run in English without a catalogue is 317
throws. The compiled file is what makes the second language a thing somebody can look at
rather than a thing that can be argued about.

**German is still the only language that ships**, and that is a product decision rather than
a technical one. The app's locale stays `'de'`, there is no user-facing switch, and the
switch for English belongs in the workbench where ADR 0026 §6 put it.

### 4. The locale is supplied by the host, not written into the core

`createAppStore()` gains one option. The phone passes `'de'`; the workbench **would**
pass what its address says and a desktop host what `GLib.get_language_names()` answers,
~~and neither does yet~~ — the workbench does, since
[#226](https://github.com/correctiv/correctiv-app/pull/226) made the preview's `lg=` what
it passes; the desktop host is still the one that has not arrived. What this section
builds is the seam, not its second user — a cold review caught the first wording claiming
all three in the present tense, which would have sent somebody looking for plumbing that
is not there.

**Why the store and not a port.** `CorePlatform` is what the core cannot do for itself —
storage, blobs, audio, error reporting. A locale is not a capability, it is state, and it has
a slice already. ADR 0023 says the host constructs the store and passes enhancers; this
widens that to one piece of initial state, which is the smaller change of the two available:
the alternative is a `hydrate` dispatch after construction, and a locale that is right one
render late is a screen that flashes the wrong language.

**Why not the device.** ADR 0026 §6's reason stands and is not weakened by this: a phone set
to English must not get an app half in English. What changes is only where the decision is
written.

**The core keeps a default, and that is not the same constant.** A cold review read "the
constant moves from the core to the host" and checked: `'de'` is still in the settings
slice. It is, and it has to be — a store built by a test, or by a host that has not
decided, needs one. What moved is the DECISION: `apps/mobile/src/lib/locale.ts` is where
this product says which language it ships, the store binding and the web export's
`<html lang>` both read it from there, and `apps/mobile/__tests__/tab-bar-labels.test.ts`
holds both ends so the language cannot be changed in one of them alone.

### 5. The checks split along the same line

The package checks what is true of a catalogue: every id in the file its namespace names,
every namespace merged, and a floor under both. The app keeps what is true of the app: no
German outside the catalogue, `COPY` as the one name for a block, `en.json` current against a
fresh extraction, and a description wherever the string cannot speak for itself
([#217](https://github.com/correctiv/correctiv-app/pull/217)).

One of them gets stronger by accident and it is worth naming. The app's German-character walk
excluded `i18n/catalogue/de/` by path. With the German gone from `apps/mobile/src` there is
nothing to exclude, so the walk now covers the app's source with no catalogue-shaped hole in
it.

### 6. `Locale` stays in the core, and the catalogue answers to it

The type could live in either. It stays in `packages/app-core/src/stores/settings.ts` because
it is the shape of a piece of state, and the package imports it to type its registry. So the
completeness check — a locale with no catalogue — fires in the package, once, instead of in
each host's provider.

Adding a language is therefore still two edits, a member and a catalogue, which is what ADR
0026 §6 promised. Deriving the union from the registry instead would make it one, and would
put a data package in charge of the core's type; that is the wrong direction for the saving.

## What this retires

- [ADR 0026](0026-react-native-review-and-hardening.md) §6, "`locale` is therefore a fixed
  value in the store rather than something read from the device": the second half stands and
  the first will not, once §4 is built. Its reason — that a phone set to English must not get
  an app half in English — is why the phone will still pass `'de'`.
  **Struck by [#221](https://github.com/correctiv/correctiv-app/pull/221)**, which is
  the pull request that built §4, rather than by the one that wrote this section. A
  record struck ahead of the change that voids it lies for however long the change
  takes, and #219 sat unmerged for an afternoon.
- [ADR 0026](0026-react-native-review-and-hardening.md) §6, "the compiled catalogues are build
  artifacts": **struck there now**, and not by this record — by the measurement. It was
  wrong on the day it was written rather than overtaken by anything, because nothing in
  this tree has ever run `formatjs compile`, so the clause beside it says so plainly with
  the day it was measured and links nothing, which is what [AGENTS.md](../AGENTS.md) asks
  for that case. §3 below is what would make it true; a claim waiting to become true is
  still a claim a reader would act on and be wrong about.
- [AGENTS.md](../AGENTS.md)'s "The German … lives in `apps/mobile/src/i18n/catalogue/de/`, one
  file per id namespace, and that directory is the only place under `apps/mobile/src` where a
  German character may be written." Both halves move: the directory is
  `packages/catalogue/src/de/`, and under `apps/mobile/src` there is now no such place at all.
- [ADR 0033](0033-one-text-size-for-the-whole-app-the-systems-by-default.md)'s "the German
  for it lives in `apps/mobile/src/i18n/catalogue/de/settings.ts`", the same move as the
  AGENTS.md sentence above. It was missed here and struck on 2026-09-24 in [#260](https://github.com/correctiv/correctiv-app/pull/260), the pull
  request that built 0033 and found it by reading the path.
- **Nothing in [ADR 0026](0026-react-native-review-and-hardening.md) §6 about
  `lib/format.ts`, and that is a correction.** An earlier draft of this record struck
  "those tables are deletable rather than parameterisable" there. A cold review pointed
  out that the sentence is not false: it is about the twelve month names and seven
  weekday names, it says to delete them rather than parameterise THEM, and they were
  deleted. Somebody acting on it today acts correctly. What §4 does is a later decision
  about a different object — the formatter, not the tables — and AGENTS.md is explicit
  that a claim which is merely overtaken is not struck. The strike is withdrawn.
