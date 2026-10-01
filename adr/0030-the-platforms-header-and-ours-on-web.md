# ADR 0030 — The platform's header on the phone, and ours on web

Status: accepted, 2026-09-14. Verified on an Android emulator 2026-09-14, which found
one fault in the first version of it and settled the largest open question in this
record; iOS remains unrun. See the last two sections.

## Context

[ADR 0026](0026-react-native-review-and-hardening.md) §9 decided the shape and
left three details open. This record carries them out and answers the three.

The argument is [ADR 0013](0013-native-tabs-and-a-web-tab-bar-of-its-own.md)'s, one
level up. A drawn tab bar imitated the system's appearance and then stopped; a drawn
header does the same thing with a smaller surface. What it cannot imitate is the
back gesture, the long-press on the back control that shows the stack, the
large-title collapse on iOS, and press feedback that belongs to the platform rather
than to us. None of that survives being redrawn, and none of it has to be written if
it is not.

## 1. Decision

**The platform's stack header on iOS and Android, configured; the app's drawn bar on
web.** One seam, `components/ui/ScreenHeader`, with `ScreenHeader.tsx` setting
`<Stack.Screen options>` and `ScreenHeader.web.tsx` drawing the bar, and one shared
props type, `screenHeaderTypes.ts`, so the two cannot drift apart. That is the
repository's existing platform-split pattern (`components/reader/`,
`components/media/`), and `__tests__/web-target.test.ts` now guards this pair the same
way it guards those.

**Web keeps the bar because nothing else draws one there.** This was measured again
against the installed `react-native-screens` 4.26.2:
`lib/module/components/ScreenStackHeaderConfig.web.js` is eleven lines, and every
export in it — the config, the left, centre, right and search subviews, the subview
base — is a bare `View`. `SearchBar.web.js` is `const SearchBar = View`. The one
exception proves the rest: the back-button image is a real `Image`, with no bar to sit
in and nothing that positions it. So on web this is not a preference between two good
options. It is the only half that draws anything.

**The drawn bar is its own file**, `components/ui/ScreenHeaderBar.tsx`, byte-identical
in its render to what `ScreenHeader` was. Three things render it — the web half of the
seam, the two named exceptions below, and the gallery — and a bar drawn in three places
would have been three bars within a release. The gallery keeps listing it under
`ScreenHeader`, because on web that is exactly what `ScreenHeader` draws, and because
that name is already the address `tools/figma-plugin` and the handbook use for it.

## The header draws no title, and that is what the emulator decided

The first version of this change put the route's title in the platform's header, which
is what a stack header is normally for. On the emulator every one of those screens then
showed its name twice: once in the header, and once again immediately below it, in
larger type, as the screen's own heading — which each of these screens already drew and
still draws. Seen on `/gespeichert`, `/einstellungen`, `/atlas`, `/spotlight`,
`/faktenforum` and `/backstage`; `/bericht` was the only one that escaped, because its
heading reads "Quartalsbericht 1/2026" while the route is called "Quartalsbericht".

**Nothing in this repository could have caught it, and that is the part worth keeping.**
Web keeps the drawn bar, which carries no title, so every browser screenshot was right
and none of them said anything about the phone. The tests assert that titles exist and
that no two routes share one, which was true throughout. A duplicated word is not a
crash, a layout break or a colour fault; it is a screen that looks slightly wrong to a
person and perfectly fine to a machine.

**So the header keeps the platform's back control and draws no title.** `headerTitle`
is set to the empty string, which is what keeps `getHeaderTitle`'s fallback chain —
`headerTitle`, then `title`, then the route's name — from putting it back. What the
platform's header is here for is the back affordance, the gesture and the animation,
and it keeps buying all three without a title. What a title would add is a second copy
of a word that is on the screen either way.

**The route's `title` is not removed.** It stays as route metadata, and it is what the
web half feeds to `document.title`, which is the other half of what this change fixes.
Only its drawing is switched off, and only on the platforms that have a header of their
own.

**What this defers.** The idiomatic answer is neither two titles nor one: it is the
platform's large-title pattern, where the screen's own large heading is the header's
title and collapses into the bar as the page scrolls — `headerLargeTitle` on iOS,
Material's large top app bar on Android. That is one heading instead of two and the
motion a user has already learned, and it is a design change to thirteen screens, each
of which currently draws its heading inside its own scroller with its own spacing. It
wants a designer, and it is not this record.

## 2. The two exceptions, named so they are a decision

**`/suche` keeps the drawn bar on every platform.** The native alternative is
`headerSearchBarOptions`, and it is a different interaction on each platform: on
Android the field collapses into an icon and takes the header over when it opens. This
screen owns two heterogeneous result sections and three empty states whose behaviour is
bound to the field it has — too short, searching, nothing found — and adopting the
platform's field means redesigning all of that. This change is not the place to also
redesign search.

**`/formular` keeps it too**, for the reason ADR 0026 predicted. Its
`backLabel="Abbrechen"` exists so that two controls called "Zurück" cannot mean two
things — the header's and the step-back button in the footer. `headerBackTitle` is
iOS-only; an Android stack header shows no back title at all, so on Android the label
would simply not exist and the two controls would collide again. Both of the route's
call sites keep the bar, not only the one with the label: a route that swapped header
kinds between its "not found" state and its form would be one route with two chromes.

Both exceptions are declared at the call site, not inferred. `ScreenHeaderProps` is a
name intersected with a union: `backLabel` and `children` typecheck only together with
`drawnBar`, so a fourteenth screen cannot pass a prop the platform's header would
silently drop. The branch that keeps the bar also states `headerShown: false` for
itself rather than leaning on the root layout's `screenOptions`, because an exception
that depends on a default set two files away is one nobody can read.

## The titles, and what was actually wrong

Fifteen route files use `ScreenHeader`, at sixteen call sites (`/formular` has two, one
per state). Fourteen of the sixteen passed nothing at all before this change, which is
the figure ADR 0026 predicted. After it, thirteen pass a title and nothing else, and
three — the two in `/formular` and the one in `/suche` — pass a title and `drawnBar`.
So thirteen call sites take the platform's header and three keep ours.

Five more routes have no header at all and are named directly, through
`lib/navigation/documentTitle`; the section after next says why they had to be.

`onBack` turned out to have **no caller in the app at all** — the gallery was the only
thing that ever passed it. It is gone from the seam and stays on the bar, because the
native header's back control is the platform's and a prop the seam could not honour
would be exactly the silent defect this change is meant to remove.

| Route | Title | Where it comes from |
| --- | --- | --- |
| `/artikel` | Artikel | `useDocumentTitle` |
| `/atlas` | Abriss-Atlas | `ScreenHeader` |
| `/aufruf/[slug]` | Mitmach-Aufruf | `ScreenHeader` |
| `/backstage` | Backstage | `ScreenHeader` |
| `/behauptung/[id]` | Behauptung | `ScreenHeader` |
| `/bericht` | Quartalsbericht | `ScreenHeader` |
| `/einstellungen` | Einstellungen | `ScreenHeader` |
| `/faktenforum` | Faktenforum | `ScreenHeader` |
| `/formular` | Mitmach-Formular | `ScreenHeader` |
| `/gallery` | Component gallery | `useDocumentTitle` |
| `/gespeichert` | Gespeicherte Artikel | `ScreenHeader` |
| `/onboarding` | Willkommen | `useDocumentTitle` |
| `/player` | Player | `useDocumentTitle` |
| `/projekt/[id]` | Projekt | `ScreenHeader` |
| `/serie/[id]` | Podcast-Serie | `ScreenHeader` |
| `/spotlight` | Spotlight | `ScreenHeader` |
| `/suche` | Suche | `ScreenHeader` |
| `/tagebuch/[id]` | Recherchetagebuch | `ScreenHeader` |
| `/video` | Video | `ScreenHeader` |
| `/+not-found` | Seite nicht gefunden | `useDocumentTitle` |

**Most of them are the word the screen already uses**, which is the rule, because a
synonym would be a second name for the same thing: `/behauptung` says "Diese Behauptung
gibt es nicht", `/serie` says "Diese Serie gibt es nicht" over a Podcasts section,
`/bericht` prints "Quartalsbericht 1/2026" as its headline, `/gallery`'s page heading is
"Component gallery", `/player`'s close control is labelled "Player schließen".

**Three are not, and are named here rather than left to be discovered.**
"Mitmach-Formular" appears nowhere in the app; the compound follows "Mitmach-Aufruf",
which is the screen the form is reached from, and the two have to be told apart in a tab
strip. "Willkommen" is a name for an onboarding whose three steps have three headings
and no name between them. "Seite nicht gefunden" is the 404 screen's own sentence
"Diese Seite gibt es nicht" turned into a name, because a browser tab is read out of
context and "Fehler 404" is the code rather than the condition.

**One is not German.** "Component gallery" is the heading of the page it names, and
that page is read by developers and designers: everything on it is English already, so
a German tab over an English page would be the odd one out
([AGENTS.md](../AGENTS.md#language)).

**ADR 0026 said the pushed routes share one browser-tab title. They do not — they have
none**, and the reason is worth writing down because it changes what the fix is.
Measured against expo-router 57.0.19, first on 2026-09-14 and re-measured on
2026-09-15 after a review found the middle item below to be wrong:

- `expo-router/build/ExpoRoot.js` hands its `NavigationContainer` a hard-coded
  `documentTitle: { enabled: false }`. react-navigation's own bridge from
  `options.title` to `document.title` is therefore off, and setting the option alone
  changes nothing in a browser.
- ~~`expo-router/head` is the path that leaves open, and it needs a `HelmetProvider`
  the app does not mount.~~ **False, and corrected here rather than struck elsewhere,
  because it is this record's own claim.** The app mounts one:
  `apps/mobile/index.js` → `expo-router/entry` → `entry-classic.js` →
  `build/qualified-entry.js`, which renders `<Head.Provider>`, and `Head.Provider` is
  `HelmetProvider` in `build/head/ExpoHead.js` — the unsuffixed file, which is the one
  web resolves, since `expo-router/package.json` has no `exports` map and there is no
  `.web` variant of either file. The evidence was in this record all along: the
  `data-rh="true"` on the empty `<title>` quoted below is Helmet's own marker
  attribute, and it is there precisely because a provider rendered it. Measured on
  2026-09-15 by putting a `<Head><title>Kopftest</title></Head>` in `/backstage` and
  tracing every write to `document.title` in the browser: Helmet wrote "Kopftest", and
  the header's own effect then wrote "Backstage" over it. That overwrite is the most
  likely shape of the original mis-measurement.
- Neither reaches the static export, and not because of the two above. The root
  shell renders `null` until the fonts are loaded and the store is hydrated, so
  `expo export` renders **no screen at all** — `grep -c "Abriss-Atlas" dist/atlas.html`
  returns 0, with or without this change, and every page ships
  `<title data-rh="true"></title>`.

**So both paths work in the running app, and the choice between them is not about
which one functions.** The title is set by hand because it is one write behind a prop
the header already takes, against a second declaration in every route file and a
vendored copy of react-helmet-async underneath it; and because the thing a `<head>`
component would really be worth having for — Open Graph tags on a shared article link —
is exactly what the third item above blocks, for either path.
`expo-router/head` is the right answer on the day that changes, and
`TROUBLESHOOTING.md` now says so instead of sending the next reader to mount a second
provider.

## Who writes the title, and why it is a list

`lib/navigation/documentTitle.web.ts` keeps the screens that are naming themselves in
mount order and writes the last one; `documentTitle.ts` beside it is the no-op a device
gets. The obvious implementation is a saved string — read `document.title` on mount,
write it back on unmount — and it is correct for a push and a pop, which is how it was
first written and how it was checked in a browser.

It is wrong when two screens go in one commit. React runs cleanups in tree order, so
the screen underneath restores first and the screen on top then writes the underneath
one's title back over it, at which point the tab names a screen that has just been
dismissed. The app has exactly one reachable path: `formular.tsx`'s
`router.dismissTo('/(tabs)/mitmachen')` over `(tabs) > /aufruf/[slug]` > `/formular`,
which would leave the Mitmachen tab reading "Mitmach-Aufruf". A
`if (document.title === title)` guard does not fix this class of fault; not reading the
document at all does. `__tests__/document-title.test.tsx` holds it, at the React level,
because the form's "Weiter" stays `aria-disabled` under synthetic input and the path
cannot be driven from a test that fills the form in.

**A route without a title of its own is worse than a route with none.** Five routes
have no `ScreenHeader` — `/artikel`, `/player`, `/onboarding`, `/gallery` and
`/+not-found` — and a pushed route that writes nothing leaves the tab reading the
screen underneath it. Opening the reader from Backstage left the tab saying
"Backstage", on the app's most-shared route, which is worse than the empty tab it had
before this change: an empty tab is uninformative, and a wrong one is a claim. Those
five call `useDocumentTitle` directly, and the alternative — making an untitled route
reset the tab rather than inherit it — was not taken, because there is no untitled
route left to reset for, and a mechanism with no case to serve is one nobody maintains.
`__tests__/screen-titles.test.ts` now fails on any route outside `(tabs)` that names
neither way, so the class is closed rather than the five instances.

## The back control does not route through `goBack`, and the floor stays

The native header's back control is `react-native-screens`', wired to the navigator.
`lib/navigation/goBack.ts` is not in that path. Whether the floor under
`app/_layout.tsx`'s anchor is still needed **was not settled**: the emulator pass
walked the app, and the deep-link case it would take to answer this —
`correctiv://gespeichert` followed by the native arrow — is not part of that walk.

It is still needed regardless, and that much is settled: the drawn bar routes through
`goBack`, and the drawn bar is what the whole web target and the two named exceptions
use. On the web target the floor was exercised — `/gespeichert` opened cold, with no
history behind it, and its back control landed on `/` rather than doing nothing. So
`goBack` is untouched by this change and cannot be removed by the check the issue asks
for; what that check can still decide is whether the *native* arrow ever reaches a dead
end the anchor does not cover, which is a question about one platform rather than about
the function.

## What it costs

**The header is now the platform's type, not the app's.** Only its colours are
configured, from `useColors()`, the same line ADR 0013 drew for the tab bar: the shape
and the typography are the platform's. A brand that ends at the header's edge is the
trade, and it is the trade that decision already made one level down. With no title
drawn, what is left of the app's own voice in that bar is the back label and two
colours.

**`headerBackTitle` is set to "Zurück" rather than inherited.** iOS's default back title
is the previous route's title, and until this change no route in this app had one; a
tab root still has none, so the control could have read whatever the router calls it.
Stating it is one line and removes a whole class of surprise. On Android it is inert.

**Four test suites now mock `Stack.Screen`.** A screen with a header reaches
expo-router for more than `router` now, and the suites that render one say so.

**The handbook's reference could not read a union.** `ScreenHeaderProps` is this
repository's first one, and `apps/handbook/scripts/api.mjs` walked intersections,
references and object literals but not unions, so the generated model carried no props
for `ScreenHeader` at all: the page printed "Props: None." and then "Plus everything in
`ScreenTitle & {…} | ScreenTitle & {…}`, which this repository does not own", about a
type declared in the same folder. Fixed here, with a merge rule — a name several
members carry gets their types joined, one that is absent or optional anywhere is
optional, and `never` drops out of a joined type — and `apps/handbook/test/api.test.ts`
is what keeps it. The props type is also written as one name intersected with a union
rather than as two members that both repeat `title`, which is both the better type and
the shape that lets the generator find the required prop.

## What this retires

**One paragraph in `components/ui/ScreenHeader.tsx`**, half of it. The sentence
"Deliberately NOT a native stack header — the app sets `headerShown: false` throughout
and builds its own bars, so that iOS, Android and web show the same brand" is struck
where it stands and names this ADR as what voided it. The rest of that paragraph —
"A native header looks different on every platform, and on web it does not appear at
all" — is left standing, because it is still true, was re-measured above, and is the
reason the web half exists. This is the strike ADR 0026 named in advance and deferred
until the code changed.

**The same sentence in [ADR 0004](0004-react-native-pivot.md)**, in its search-screen
paragraph, where it is the premise of "a native header search bar would be the wrong
route". The premise is false now. The conclusion is not, and this record is what
confirms it: `/suche` is one of the two exceptions above, for the reason 0004's next
sentence gives.

**One claim in [ADR 0026](0026-react-native-review-and-hardening.md)**: "every pushed
route on the published web target sharing one browser-tab title". They share none; each
one ships an empty `<title>`, and the difference is what decided that writing the
titles is only half the fix. The conclusion 0026 drew — that the titles have to be
written — was right, and is carried out here.

**One claim of this record's own**, corrected in place above rather than struck
elsewhere, because there is nowhere else to strike it: that `expo-router/head` needs a
`HelmetProvider` the app does not mount. It does not; the app mounts one. The decision
it was used to justify survives, on the argument written out above.

**One line of `ARCHITECTURE.md`**, corrected rather than struck, because it is a living
document: the component-level platform splits are three now, not two.
`lib/navigation/documentTitle` is a fourth pair but not a fourth component — it is a
module, and it is listed beside `lib/articles/covers.ts` in
`__tests__/web-target.test.ts`, which is where module pairs are guarded.

## What this has not delivered

**iOS is unrun.** No simulator and no device. Every claim above about how the header
looks on iOS — the back label, the swipe gesture, the collapse behaviour it does not
have — is read off the API and off ADR 0013's precedent, not off a screen.

**The Android pass was a walk, not a matrix.** It ran a debug build over Metro on
`Medium_Phone_API_36` (Android 16, API 36) on 2026-09-14, with `screens/tools/lib.sh`,
and it answered the questions this record's first version could not: the header
appears, its colours arrive, and the title was duplicated on six screens. What it did
not answer:

- `correctiv://gespeichert` and the native arrow, against `goBack` — the ten-minute
  check the issue asks for, and the one open item of ADR 0026 §9 that is still
  open;
- how the bar behaves at large accessibility text sizes. The header is the system's
  font at the system's size now, not Source Sans 3 at ours, and it is the first part of
  this app that grows with the OS setting;
- whether anything flashes between mount and the first layout effect, which is when
  `<Stack.Screen options>` reaches the navigator.

**The web target was verified on its own.** `npm run build:web`, served through
`screens/tools/serve-clean.mjs`, at 540×1200, on 2026-09-15: twenty routes opened cold,
each of them naming itself in the browser tab and no two alike; then the push this
change exists to fix, `/backstage` → "Jetzt lesen" → `/artikel`, where the tab reads
"Artikel" rather than "Backstage", and back again, where it reads "Backstage" rather
than nothing. The drawn bar is unchanged in all three appearance combinations, measured
on `/gespeichert`: setting "Hell" gives a bar of `srgb(255,255,255)` with
`srgb(51,51,51)` on it, and both setting "Dunkel" and setting "System" against a device
reporting `prefers-color-scheme: dark` give `srgb(26,26,26)` with `srgb(242,242,242)` —
the light and dark `canvas` and `on-canvas` tokens. That last combination is the app's
default and the one that has shipped broken before.

**The shipped HTML still carries no title on any route.** Every page of the export
serves `<title data-rh="true"></title>` and the name appears only after hydration, so
a crawler, a link unfurler or anything without JavaScript sees exactly what it saw
before this change. What this change fixes is the running app. Fixing the export means
either a base title in the HTML shell or a root that renders something before the
fonts and the store are ready, and both are separate decisions.

**The five tab roots still have no title,** and neither does the app's own entry page:
they have no `ScreenHeader` and nothing pushes them, so nothing in this change reaches
them. `/` therefore still shows its address in the browser tab, and popping the last
pushed route returns the tab to the empty string the document was served with. Giving
the tabs and the root a title is a separate, smaller change.

**`/artikel` names the route and not the article.** The reader is the app's
most-shared route and the one that most wants its own headline in the tab; what it has
is the fixed word "Artikel", which is enough to stop it naming the screen it was opened
from. Two things are in the way and both are small: the headline arrives asynchronously,
so the tab would change under the reader a beat after the page opens, and
`__tests__/screen-titles.test.ts` reads the route files as text, so a title has to be a
string literal today. A per-article title means deciding what the tab says while the
article loads, and then teaching that test the difference.

**A keyboard offset was not implemented.** A native stack header has a height, and a
`KeyboardAvoidingView` under one has to account for it through `useHeaderHeight()` from
`@react-navigation/elements`. The two screens with inputs are the two exceptions and
keep the drawn bar, so this does not arise today; it arises for the first screen with
an input that takes the platform's header.
