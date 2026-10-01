# ADR 0006 — One core, two hosts

Status: accepted, 2026-08-06. Amends [ADR 0005](0005-react-native-over-nativescript.md):
the stack decision stands, the removal schedule does not.

> **Superseded in part by [ADR 0007](0007-removing-the-nativescript-host.md)
> (2026-08-12):** the second host is gone; the core, ~~its four ports~~ its ports (five
> since [ADR 0032](0032-a-port-for-the-error-report-before-a-provider-for-it.md)) and the two
> extraction backends are not. Everything below about *what the core holds and why*
> still applies — that argument is the reason the removal cost one adapter and a
> screen folder. Everything about *two apps* is now history, and this file has not
> been rewritten to hide that.

## Context

ADR 0005 chose Expo / React Native and scheduled `apps/mobile` (NativeScript) for
removal in phase 5. Its case against keeping both rested on two costs:

1. **Parity is the cost** — a comparison only means something if both apps keep
   feature parity, which doubles every screen and every change.
2. **The core is already not shared** — the NativeScript app carried its own audio
   and podcast stores, and the core's new podcasts store went unused there. "The
   drift happened inside one session, with nobody doing anything wrong."

The second cost was not a property of having two hosts. It was a property of the
core stopping halfway. An audit found the duplication had grown well past those two
stores:

| Concern | `apps/mobile` | `apps/mobile-rn` |
| --- | --- | --- |
| Article extraction | regex, in the core | htmlparser2, in the app (175 lines) |
| Article model | `ArticleDetail` | its own `Article`, cut differently |
| Reader document | `template.html` + builder | a template literal (136 lines) |
| Fact-check vocabulary | English slugs | German slugs |
| HTTP cache | core, synchronous port | `cachedFetch`, AsyncStorage |
| Feed state | Pinia store (147 lines) | `client` + `useFeed` (113 lines) |
| Podcast state | Pinia clone (78 lines) | the core's store |
| Audio | store + service (282 lines) | its own store (269 lines) |
| Offline bundle script | one | another |

Every row is one behaviour with two implementations, and several of them had
already diverged in ways a user would notice. The Expo audio store fixed two bugs
the NativeScript one still had — a club preview that a second tap released in full,
and an error state that flipped back to a spinner. The NativeScript feed store did
stale-while-revalidate and borrowed bundled cover images offline; the Expo one did
neither. Neither app knew what the other had learned.

## 1. Decision

**`packages/app-core` holds the behaviour; the two apps hold their view layer and
their platform adapters. Both stay, `apps/mobile-rn` is still the app going
forward, and no removal date is set.**

Concretely, the core gained the article domain (one model, one fact-check
vocabulary, one reader document, one load cascade), the feed store, the audio state
machine, one cached fetch, and the collection half of the offline-bundle scripts.
What is left in each app is its screens, its bindings, and one file that implements
the ports.

~~Four ports~~, all declared in `packages/app-core/src/ports/index.ts`. A fifth,
`ErrorReporter`, was added by
[ADR 0032](0032-a-port-for-the-error-report-before-a-provider-for-it.md) and is not in
the table below; the argument for what a port IS, which is what this section is for,
is unchanged by it:

| Port | What the host answers | NativeScript | Expo |
| --- | --- | --- | --- |
| `KeyValueStore` | small settings, ~~synchronously~~ asynchronously since [0009](0009-redux-toolkit-for-the-cores-state.md) | `ApplicationSettings` | ~~AsyncStorage + a hydrated mirror~~ ~~AsyncStorage~~ MMKV, in a store of its own, since [0026](0026-react-native-review-and-hardening.md) |
| `BlobStore` | the HTTP cache, asynchronously | `File` in `documents/cache/` | ~~AsyncStorage~~ a second MMKV store, bounded and evictable, since [0026](0026-react-native-review-and-hardening.md) |
| `ContentBundle` | what shipped inside the app | JSON in the app folder | a generated TS module |
| `AudioBackend` | playback, as status ticks | `TNSPlayer` + a polling timer | expo-audio's status events |

`BlobStore` was `FileStore` and synchronous, which was NativeScript's `File` shape
leaking into the contract: it forced the Expo adapter to pull its entire cache into
memory before the first frame just to answer a read. It is asynchronous now, and
~~`KeyValueStore` stays synchronous because `persist()` reads it while a store is
being constructed~~ — that premise expired when Redux moved store construction to
module load, so both ports are asynchronous now
([0009](0009-redux-toolkit-for-the-cores-state.md)).

## Two extraction backends, on purpose

The one thing that is deliberately *not* single is HTML extraction. The core ships
both, behind one `ArticleExtractor` type:

- `articles/extract/string.ts` — regular expressions, no dependencies. Runs in the
  NativeScript runtime, whose bundler resolves parser packages to their CommonJS
  builds and then fails on them, and in a plain Node script.
- `articles/extract/dom.ts` — htmlparser2 + css-select. Sanitises the body with a
  tag **allowlist** instead of a denylist, which is measurably cleaner markup for
  the reader, at the cost of four dependencies.

Everything downstream of extraction is shared — the model, the vocabulary, the
reading time, the reader document. And the two backends are pinned to each other:
`test/articles.test.ts` runs both over the same captured page and asserts they agree
on every field except body markup, so the choice cannot quietly become a fork.
A second test asserts that nothing outside `extract/dom.ts` imports the parser, so
the NativeScript bundle cannot acquire it by accident. Verified: the parser appears
0 times in the built NativeScript bundle.

## What sharing a state machine costs, once

Moving the state machine into the core means the two hosts now drive the *same*
code — and that surfaced a bug neither app had on its own.

The store calls `AudioBackend.pause()` when it stops a track. The NativeScript
backend emitted a status tick from inside `pause()`, so the store re-entered its own
handler mid-decision, reached the same conclusion again and called `pause()` again. On
a device: `RangeError: Maximum call stack size exceeded`, a minute into an episode.
Everything was green — expo-audio does not re-enter, so the Expo tests could not see
it, and the crash needs a minute of real playback to appear.

The re-entrant fake written to pin it then found a **second** instance on the error
path, where the sticky-error guard sat after the branch it was supposed to protect.

Two things came out of it, and they are the general lesson rather than the specific
fix:

1. **The port needed a contract, not just a shape.** `AudioBackend` now states that a
   command must never call the status listener synchronously, and says why. An
   interface that only lists methods lets each host invent its own re-entrancy rules.
2. **A fake that is too polite tests nothing.** `test/audio-store.test.ts` drives the
   store through a backend that deliberately reports back from inside `pause()` — the
   awkward shape, not the convenient one. It reproduces the device crash against the
   old code.

The store also sets its state *before* issuing a command now, so a re-entrant backend
finds the new state rather than the old one.

## Consequences

- **The parity cost is now the view layer only.** That is real and unchanged: a new
  screen still has to be built twice. What no longer doubles is the behaviour behind
  it — a fix to the audio state machine, the feed cascade or the reader lands in both
  apps at once. Both apps are checked by the same `npm run check`.
- **Pinia is gone** from `apps/mobile`. Its last three stores were the duplicated
  ones; the core's stores plus the existing Vue binding cover them, so the
  dependency went with them.
- **Both apps gained the other's fixes.** NativeScript got the sticky error state;
  Expo got stale-while-revalidate, the bundled-cover fallback and one shared feed load
  across screens.
- **The 60-second club preview is gone** (2026-08-06, product decision): bonus content
  plays in full for everyone, which also puts audio in line with "closeness, not a
  paywall". The `CLUB` badge stays as a label. `apps/mobile`'s `ClubInviteSheet.vue`
  was the invitation it opened and had no other trigger, so it went with it — in the
  git history if the ask is ever wanted back in another form. Worth knowing: the Expo
  app never showed that invitation at all, before this refactor either, because
  nothing consumed `usePreviewEnded`.
- **The root `package.json` no longer favours one app.** `npm run android` is the
  Expo app; the NativeScript scripts are prefixed `ns:`. Previously the unprefixed
  scripts silently built the app that was being replaced.
- **The scripts run under `tsx`.** That retired the `.mjs` + hand-written `.d.mts`
  pairs in the core (`extract`, `rss-parse`), whose declarations nothing checked
  against their implementations.
- **`SavedArticle.topline` is now `kicker`.** Persisted state, so articles saved by
  an older build lose their badge — they keep their title and URL. Acceptable in a
  prototype; worth a migration if this ever ships.
- **When ADR 0005's removal happens**, it is a smaller change than it was: deleting
  `apps/mobile` now removes screens and one adapter, not a second data layer. The
  reason to revisit ADR 0005 is unchanged (no web target needed plus a Mac
  available); nothing here argues for NativeScript on the merits.

## What is still open

- **CORS on the web target.** `correctiv.org`, `salon5.correctiv.net` and
  `youtube.com/feeds` send no `Access-Control-Allow-Origin`, ~~so no feed is ever live
  in a browser~~ — true of the RSS feeds and not of the site, retired by
  [ADR 0015](0015-reading-correctiv-org-through-its-rest-api.md): `wp/v2` reflects
  whatever `Origin` it is given, so the app reads correctiv.org through the REST API
  and the browser build has a live path. Fixed as far as the port can fix it: the Expo
  host bundles a snapshot of every content feed, the store's cascade lands on it, and
  the browser demo has a real front page that says it is a snapshot. ~~What is still
  open is the header itself — until CORRECTIV ops send one, the web build's articles
  are as old as the last `npm run offline-articles`.~~ Nothing was open; the header was
  there on a different endpoint the whole time.
- **Lock-screen metadata on NativeScript.** `TNSPlayer` offers none, so
  `AudioBackend.load` accepts `nowPlaying` and the NativeScript backend drops it.
  Named in that file rather than silently missing.
- **iOS live radio on NativeScript.** `AVAudioPlayer` cannot play a live stream; it
  needs an `AVPlayer` wrapper. Unchanged by this ADR, and Expo is unaffected.
