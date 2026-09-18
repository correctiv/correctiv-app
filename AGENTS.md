# CORRECTIV App, agent rules

Only what you cannot read off the code. Follow the links; do not restate them here.

- [ARCHITECTURE.md](ARCHITECTURE.md), core, ports, colour, where things live
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md), the traps, and **why a green check is not evidence**
- [adr/](adr/README.md), the decisions, and which of their claims have expired
- [SOURCES.md](SOURCES.md), every source the app reads, measured, beside the ones the
  scope asks for and nobody has named yet

## Where code goes

Behaviour goes in `packages/app-core`. The app holds screens, its store binding and
one file implementing the ports. Ask whether what you are writing is a screen; if
not, it belongs in the core. That the app is currently the only host is not a reason
to relax this, because the core is what survived the last change of view layer. The
core imports no UI framework and no platform SDK, so needing a platform means
declaring a port, not widening an allow-list. Derived state is an exported selector
taking state, never a store method.
([ADR 0006](adr/0006-one-core-two-hosts.md))

`apps/mobile` is the app. Its web export is published on every push to `main`, so
anything that lands there is public.

`apps/workbench` is the published site: the documentation, the source inventory, the
diagrams, the core's reference, and the app in a device frame at `/preview`. It
reads the repository's Markdown in place and holds no copy of any document, which is
the rule to keep: a second copy of `ARCHITECTURE.md` would be the one on the website
and the one nobody edits. "Handbook" is the documents area inside it, `/handbook`, and
nothing wider; the ADRs were written when it was the name of the whole site, which
`adr/README.md` says in a note.

**Its interface has a second audience, so part of it is German.** The home
configurator is designed for the newsroom to own ([ADR 0036](adr/0036-the-home-screen-becomes-data.md) §1).
The line is **the shell and the tools against a published page's body**: what frames
a view follows the language setting — header, rails, panel, settings, search, status
line, browser tab — and so do the preview and the configurator. The body of a page
that publishes does not: the landing prose, the handbook, the records, the reference,
the drawings and the sources board stay English, and that is the rule below holding
rather than an omission. The strings work exactly as the app's — an English
`defaultMessage` in the source, German as data in `apps/workbench/src/i18n/catalogue/de/`
— and the two catalogues are separate because the audiences are.
([ADR 0050](adr/0050-the-workbench-gets-a-second-audience.md))

The device frame reaches into the app by same-origin property access, so the two
halves have to be one origin. The Pages deploy assembles them into one artifact and
the dev server proxies `/app`; do not give the workbench a second origin, because the
browser refuses those property reads silently.
([ADR 0014](adr/0014-the-preview-shell-as-a-package.md),
[ADR 0024](adr/0024-the-handbook-owns-the-root.md),
[ADR 0037](adr/0037-the-whole-site-is-the-workbench.md))

**That coupling has one direction.** The workbench may read the app, and does;
`apps/mobile` and `packages/` may never read the workbench, because the app ships
through a store and the workbench is a developer tool on a public URL. Naming it
is not reading it: the `workbench:` override keys the app declares and every comment
that says where a seam's other end is are the permitted side of that line. What holds
the rule is `apps/mobile/__tests__/no-workbench-dependency.test.ts`, which reads the
manifests, the configuration and the workflow steps, and ci.yml's `independence` job,
which removes `apps/workbench` from the checkout and rebuilds the app. Two halves
because a path into a directory that is gone matches nothing and builds.
([ADR 0040](adr/0040-the-app-does-not-depend-on-the-workbench.md))

`tools/` is the third place, for what is neither a host nor a library the app ships:
`tools/figma-plugin` is what is left there.

Colours come from classes (`bg-canvas`), which follow the appearance setting on their
own. Reading a colour in TypeScript needs `useColors()`, or it is pinned to light.

Reach for a **semantic** token: `canvas`, `surface`, `on-canvas`, `on-canvas-muted`,
`stroke`, `accent`. Those follow the scheme.

The primitives behind them — `white`, `black`, `neutral-100…700`, `red-500`,
`yellow-400` — do **not**, so `bg-white` where you meant `bg-canvas` is a white page on
a dark phone. Use one only where a colour must not follow the scheme: text on the brand
red, a label on club yellow, a fill on a photograph. In `apps/mobile` that case is
still spelled `always-light` / `always-dark`, which is what all 49 existing call sites
use — a line of `apps/mobile/src` outside a comment that writes one of the two names,
which is the count a rename pass would have to make, and
`apps/mobile/__tests__/tokens.test.ts` takes it so this sentence cannot drift off the
code again. ADR 0022's 45 is the same measurement without `src/gallery/`, which is
where the other four are and which the check below does not read; neither number
supersedes the other. They are the older names for `white` and `neutral-700` and
ADR 0022 retires them, so prefer them there until it does rather than mixing both
spellings.

Because that case has a spelling of its own, a primitive in `apps/mobile/src` is the
mistake and nothing else, and `apps/mobile/__tests__/colour-tiers.test.ts` fails on
one — on a new deprecated alias too, against a per-file ratchet asserted in both
directions. What it reads is the token NAME, in four spellings: the class
(`bg-white`), the key (`colors['white']`), the prop (`color="white"`) and the
property (`colors.white`), the last three only on a line that also says colour.
It is blind to a class built at runtime, to a token reached through a variable
(`colors[token]`), and to any colour that is not a token at all — the hex in
`VideoFrame.tsx` and the `#ffffff` splash in `app.json` are invisible to it, and
`src/gallery/` is out of its scope. So it catches the mistake as the app writes it
today, and is no reason to skip looking in both appearances.

**Not in the core.** `always-light` and `always-dark` are this app's invention, so they
are absent from `tokens/theme.css` and therefore from the `--var-color-*` block the
article reader's WebView gets. `packages/app-core` has to use the primitives —
`var(--var-color-white)`, `var(--var-color-neutral-700)` — and a rule written with
`var(--var-color-always-light)` there is simply undefined in light mode. Both spellings
in the repo is that boundary, not an inconsistency to tidy.

`grey-100…700`, `emphasis` and `alternative` still resolve; they are upstream's
deprecated tier and nothing new should use one. Three of them have no successor yet,
are listed in the ADR, and are the only three the check above will excuse.
([ADR 0022](adr/0022-three-tiers-of-colour-and-a-dark-scheme-that-names-roles.md))

## Decisions

**`npm run adr:new` gives the number.** Not the highest in `adr/` plus one: on
2026-09-16 two agents read that off the same tree, wrote 0034 twice, and git merged
them without a conflict because the slugs differed. It fetches `origin/main` and reads
the open pull requests as well. It prints the number whichever of those it reached,
because somebody asking for it is about to write a record and a blank answer helps
nobody; what says whether the number was verified is the exit code and the line
beside it.

**Every decision inside a record carries a number**, `N. ` at the front of its
heading, so `ADR 0026 §6` still points at the same decision in a year. A heading that
argues for a decision takes none. `npm run adr:lock` appends each number's text to
`adr/decisions.lock.json`: the ledger keeps every text a number has carried and every
slug a record's file has carried, a removed decision leaves its number behind as a
gap, and nothing in the ledger is ever rewritten.

**What holds that rule is the comparison with `origin/main`**, in
`apps/workbench/test/decision-numbers.test.ts`: the working tree's ledger has to be an
*extension* of the published one, never a revision of it. It does not make a
renumbering impossible — a swap put through `adr:lock` appends and passes — it makes
one impossible to do quietly, because the append cannot later be taken out and the
diff shows both numbers carrying each other's heading. Every other check on the ledger
reads the working tree alone, and a renumbering that edits the records and the ledger
in one pass leaves a working tree that agrees with itself; two cold reviews went
straight through the version that claimed otherwise. Those checks are kept, for the
accident and the half-finished edit, and they are worth their line at that. They are
not a defence against somebody who means it. Do not write one that says it is.

`adr/` records **why**, not what. Add one when a choice would otherwise have to be
argued from scratch later: a dependency swapped, a boundary moved, a capability
measured and rejected. Not for ordinary work, and not for anything the code already
says.

**Keep them current, and only where it matters.** An ADR is a record, so it is never
rewritten to look right in hindsight. The reasoning is the part worth having, even
when the conclusion has moved on. When a later decision voids a claim in an earlier
one, strike that claim through where it stands, add one clause saying what voided it,
and link the ADR that did. Leave the argument around it intact. The newer ADR carries
a section naming every statement it retires, so the two halves cannot drift apart.

Do not strike through a claim that is merely old. Only one that is now **false**,
where someone reading it would act on it and be wrong.

**A record can also be wrong on the day it was written**, rather than overtaken, and that
is struck the same way with one difference: the clause says so plainly, with the day it
was measured, and links nothing. There is no later record to link, and a citation invented
to fill that slot is worse than the empty slot. `apps/workbench/plugin/decisions.ts` reads
the clause for record numbers, so one that names none leaves the record struck and voided
by nobody, which is the true picture rather than a gap in the board.

## Facts that expire

**First ask whether the figure needs to be there at all.** "The ports", not "the five
ports"; "the drawings", not "six drawings". A number that is not written cannot drift,
and needs neither a check under it nor a second copy held in step. Write one only where
the sentence would otherwise say less than it means: where the count *is* the claim, as
ADR 0026 §4's cache bounds are, or where what is being described is a mechanism rather
than a total. A figure that earns its place that way then earns the check below.

A figure measured against the outside world goes wrong quietly, and no reviewer
catches it because nothing about it looks wrong. A figure measured against **this
repository** goes wrong the same way, and faster. Facts like that exist here:

- ~~The measuring day, in `SOURCES.md` and in `apps/workbench/content/sources.manifest.ts`.~~
  Retired: the sources measure themselves now. A weekly job reaches all of them, writes
  `apps/workbench/content/sources.measured.ts`, and opens a pull request with what moved;
  the day comes out of that file and is typed nowhere. It reports and never gates,
  because a live source that is down is somebody else's outage and not this repository's
  fault. **This is the stronger answer whenever it is available**: a fact that can
  re-take itself does not need two copies held in step, and the pair below still does
  only because nothing can re-take it.
- A claim and the record that voided it, which is the pair above.
- The count of `always-light` / `always-dark` call sites, in the colour section above.
  It was exact when ADR 0022 typed it, four short a week later, and nothing failed.
  `apps/mobile/__tests__/tokens.test.ts` takes it from the source and holds this file
  to it, so it is one number in one place with a check under it.

Add the check with the fact, not afterwards. Where a check is genuinely not possible,
keep the number in one document and have the others point at it — the time
`npm run check` takes is measured in `ARCHITECTURE.md` and nowhere else for that
reason. That is the weaker arrangement and it is worth knowing why: a pointer stops
two copies parting, and nothing about it stops the one copy going stale. A figure that
depends on the machine it was measured on should be read as a bound, not a reading. "Keep the
documentation current" is not a rule that belongs here: it cannot fail, so nothing
enforces it, and a rule nobody can break is noise beside the ones they can.

## Language

English for everything a developer reads: code, comments, test names, CLI output,
commits, `.md`. The codebase is fully English as of 2026-08-12, so a German comment
now is a regression, not a leftover.

**The source a user reads is English too, and the German is data.** Every
user-facing string is a message descriptor — `defineMessages({ id, defaultMessage })`
in one obvious place per screen, not interpolated through the markup — and its
`defaultMessage` is English. That place is called `COPY`, one per file; a block
another file imports takes the name of what it belongs to (`HEADER_COPY`), because
the importer has a `COPY` of its own, and a `Record` of labels for a domain's values
is named for the domain (`TIER_LABELS`) rather than folded into the copy. The German,
formal *Sie*, is a package: `packages/catalogue/src/de/`, one file per id namespace.
It is not in the app at all, so `apps/mobile/src` now holds no catalogue and the walk
over it has no exception for one — bar the two strings named below, which are
excused by the check itself and not by this sentence
([ADR 0049](adr/0049-the-catalogue-is-a-package.md)).
The package holds the strings and nothing else: a descriptor stays where its string
is, the provider stays with the host, and the workbench keeps a catalogue of its own.
German is the only language that ships, and English is a catalogue so that the
second language can be looked at rather than asserted. **The locale is named by the
host**, not written in the core: `apps/mobile` passes `SHIPPED_LOCALE` to
`createAppStore()`, and a switch for a reader belongs in the workbench rather than in
the app ([ADR 0049](adr/0049-the-catalogue-is-a-package.md) §3 and §4). That switch is
the preview's `lg=`, which writes `workbench:locale` and reloads the frame, because the
locale is construction state and there is no action to dispatch; the app declares the
key in `apps/mobile/src/lib/locale.ts` beside the constant it overrides.
`apps/mobile/__tests__/localisation-seam.test.ts` is what enforces this. Two German
strings are exempt and it names each one, not the file it sits in, with the reason: a
channel's own name, and the recovery screen's lead, which cannot be a message because
that screen is rendered BY the error boundary, so the provider is inside the subtree
being caught. A third exemption arriving without a reason is the thing to argue about.
([ADR 0026](adr/0026-react-native-review-and-hardening.md) §6)

**That check reads the LANGUAGE, and an English literal walks straight past it.**
`<Text>Save</Text>` carries no umlaut, is no descriptor, and ships.
`apps/mobile/__tests__/rendered-literals.test.ts` is the half that never asks what
language a string is in: it parses the app and fails on a text child, or on a literal
handed to a prop a person reads. What it excuses is a **mark**, the wordmark and the
names of the products and the newsletters, because a name is the same word in every
language and so gets no id; the list of them lives in that check and each one carries
its reason. A second list, keyed by file and text rather than by word, excuses
content that is not a mark either — two strings in `EarlyAccessCard.tsx` today,
each with its own reason and the same two-sided ratchet. The pseudo-locale that
would find the same strings was considered and rejected, and that file says why.

**A descriptor carries a `description` where the string cannot speak for itself.**
It is never rendered; the extractor carries it into `en.json` and a translation tool
prints it above the entry field. Two cases are required rather than encouraged,
because in both of them the string alone is not answerable: an id whose English is
word for word another id's, where a translator cannot tell one decision from two
that happen to coincide in English, and an id carrying a placeholder, where nothing
says what goes in the hole. The description names each placeholder in its braced
spelling, `{count}` and not "the count", so that a field is answered rather than
filled in. `apps/mobile/__tests__/localisation-seam.test.ts` reads all three off
`en.json`, which is generated, so none of them can be satisfied by editing the file
the test reads. Where a reason for an id is written as a comment in the German
catalogue, ask which half of it a translator needs: that half belongs on the
descriptor, because `catalogue/de/` is a file the person writing the French will
never open.

**The core has vocabulary of its own and cannot use `defineMessages`.** What a
playback failure says, how a fact-check verdict reads, the words the reader document
prints: those belong to `packages/app-core`, which imports no React and so no
`react-intl`. A core descriptor goes through `coreMessage()` in
`packages/app-core/src/i18n/messages.ts`, **one call per descriptor** — measured:
`@formatjs/cli` reads that call's single argument and reads a bare
`{ id, defaultMessage }` literal, or a `defineMessages`-shaped block handed to the
same function, as nothing at all. The function's name is typed a second time in
`apps/mobile/package.json` under `i18n:extract`, so renaming it is two edits.
`packages/app-core/test/localisation-seam.test.ts` is the counterpart net, over the
core minus `src/data/`, which is content by the ADR's own question: *would this string
still exist if the content came from a CMS?* Its three exemptions are German as INPUT
rather than as output — a pattern matching correctiv.org's prose, a key in Yoast's
JSON, the quotation marks an entity decoder produces.

**A pull request is the exception, and German is the rule there.** Its title and body
are an argument with the team about work that has not landed, and the people having
that argument speak German. The line is the merge: what goes into the repository is
English, what is said about it on the way in is not. A commit message is on the
English side of that line, because it stays.

**A German body closes no issue**, and this is the one place the rule costs something.
GitHub reads `closes`, `fixes` and `resolves` and nothing else, so `Schließt #158` is
prose: the pull request merges and the issue stays open. Write the English keyword on
its own line if the merge should close it, or close it by hand afterwards with a
comment saying what landed. Both #158 and #166 were closed by hand after their pull
requests had merged, which is how this got written down.

German typography, not English, wherever German is written, a pull request included:
quotation marks are „…“, and the em dash does not appear at all. Where a sentence
wants a break, use a comma or a full stop; the Halbgeviertstrich – belongs only where
neither will do. English prose quoting a German label takes straight quotes on both
sides, and a German sentence leaves an identifier, a path and a command in their own
spelling.

## Checks

`npm run check` at the root: typecheck, oxlint, oxfmt, tests. How long it takes is
measured in [ARCHITECTURE.md](ARCHITECTURE.md) and is deliberately not repeated here,
because a duration typed in two places is two facts and one of them goes wrong on its
own. Do not introduce eslint or prettier.

**A check that reads this repository as text is written with
[`packages/prose-and-code`](packages/prose-and-code/README.md)** rather than by hand:
the walk, the floor that stops it passing on nothing, the excuse list asserted in both
directions, the drift check, the comment strippers with the guard that says when one
has eaten a file, and the number in a sentence held to what the code counts.
Its README says what each one catches, and that is the only place that says it — a
check here carries the argument for its own rule and not the argument for the
mechanism. The package is Apache-2.0 inside an AGPL repository
([ADR 0043](adr/0043-two-concepts-become-packages-and-the-shell-stays.md) §3), so it
may import nothing else in here; everything else here may import it.

**A green check proves nothing about how the app looks or whether it runs.** After a
route, a bundle config or a platform split, run `npm run build:web`, then
`node screens/tools/serve-clean.mjs apps/mobile/dist 8099` and open it. A plain
static server maps no clean URLs and makes a working app look broken. After layout,
screenshot it and look (`screens/tools/tour-android.sh`, compared against
`screens/`), or open `/preview`, which frames the web target at a phone or
tablet size and carries device, route, appearance and app state in its URL. Anything
touching colour has to be seen in **both** appearance settings *and* with the setting
on "System" against a dark device. That last combination is the app's default and is
the one that has already shipped broken.

**The workbench has two build paths and only one of them was ever checked.** Its
production build ran green for a day while `npm run workbench` served a blank page on
every route, which is the path a person uses to look at their work.
`npm run workbench:renders` and `npm run workbench:renders:dist` open each in a browser
and fail if the shell did not mount; run both after touching `vite.app.mjs` or any
module the workbench compiles out of `apps/mobile`.

**A picture that decided something goes into the pull request or the issue**, not only
into the working directory. `screens/evidence/` is where it lives and
[screens/README.md](screens/README.md) has the addressing rule, which is not obvious:
a body renders no repository path, so it needs a raw address pinned to a commit.
