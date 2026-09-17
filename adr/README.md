# Architecture decisions

Forty-seven records shaped this repo. Read them when you want to know *why* something
is the way it is; [`../ARCHITECTURE.md`](../ARCHITECTURE.md) describes *what* it is.

| | Decision | Status |
| --- | --- | --- |
| [0001](0001-monorepo-and-platform-free-core.md) | A monorepo with a platform-free core, and why the directory is `app-core` | accepted |
| [0002](0002-vite-8-rolldown-evaluation.md) | Stay on Vite 7 — Rolldown silently drops the NativeScript polyfills | moot since 0007; its decision struck by 0027; kept for the measurement |
| [0003](0003-audio-capability-spike.md) | What the audio stack can and cannot do, measured on a device | accepted |
| [0004](0004-react-native-pivot.md) | Move to React Native / Expo, with a web target | accepted |
| [0005](0005-react-native-over-nativescript.md) | Expo is the stack; what NativeScript was better at, and when to revisit | accepted, amended by 0006, carried out by 0007 |
| [0006](0006-one-core-two-hosts.md) | The core holds the behaviour; both apps stay for now | accepted; its second host is gone (0007), its core split is not; both storage cells of its ports table retired by 0026 |
| [0007](0007-removing-the-nativescript-host.md) | Removing the NativeScript host — the audit first, then the deletion | accepted; two claims retired by 0011 |
| [0008](0008-uniwind-over-nativewind.md) | Uniwind over NativeWind, and Tailwind v4 | accepted |
| [0009](0009-redux-toolkit-for-the-cores-state.md) | Redux Toolkit for the core's state | accepted |
| [0010](0010-design-tokens-as-a-shared-package.md) | The design tokens as a shared package | accepted |
| [0011](0011-naming-the-app-for-release.md) | Naming the app for release, and letting the old host go | accepted; retires two of 0007's |
| [0012](0012-a-list-virtualizer-for-the-unbounded-lists.md) | A list virtualizer, for the two lists that need one | accepted |
| [0013](0013-native-tabs-and-a-web-tab-bar-of-its-own.md) | Native tabs on the phone, and a web tab bar of its own | accepted; verified on Android, iOS unrun; its every-label claim retired by 0034 |
| [0014](0014-the-preview-shell-as-a-package.md) | The preview shell as a package that can reach the app | accepted; its package, its folder and its three costs retired by 0024, its same-origin argument intact |
| [0015](0015-reading-correctiv-org-through-its-rest-api.md) | Reading correctiv.org through its REST API, not its RSS feeds | accepted; retires the CORS item in 0006, unopened in a browser |
| [0016](0016-a-door-at-the-root-and-an-entitlement-not-an-amount.md) | A door at the root, and an entitlement rather than an amount | accepted; simulated sign-in, two of its statements retired by 0018 |
| [0017](0017-native-rendering-as-the-rule-a-webview-for-the-exception.md) | Native rendering as the rule, a webview for the exception | accepted; corrects a frame-header claim in `ReaderView.web.tsx`, one open question named |
| [0018](0018-removing-the-guest.md) | Removing the guest | accepted; carries out what 0016 left standing, retires two of its statements and one of 0004's |
| [0019](0019-identity-lives-in-the-session.md) | Identity lives in the session, the contribution in membership | accepted; retires two of 0018's, and the invented contribution with them. Its open question and five claims retired by 0020 |
| [0020](0020-no-contribution-in-the-app.md) | No contribution in the app, and one link out | accepted; answers 0016's join-flow question, deletes the membership slice, retires five of 0019's and one row of 0012's |
| [0021](0021-the-board-is-a-plugin-and-the-screens-are-data.md) | The design board is a plugin, and the screens are data | accepted; records two measured-and-rejected routes to Figma |
| [0022](0022-three-tiers-of-colour-and-a-dark-scheme-that-names-roles.md) | Three tiers of colour, and a dark scheme that names roles | accepted; adopts wp-design-tokens `8ed7a28`, retires two of 0010's |
| [0023](0023-the-host-constructs-the-store.md) | The host constructs the store | accepted; recorded after the fact, corrects one claim in `ARCHITECTURE.md` and four comments |
| [0024](0024-the-handbook-owns-the-root.md) | The handbook owns the site root, and the app moves under it | accepted; retires two of 0014's, its argument untouched |
| [0025](0025-the-published-app-is-a-production-bundle.md) | The published app is a production bundle, and the workbench gives up its handle | accepted; a capability measured and rejected |
| [0026](0026-react-native-review-and-hardening.md) | The React Native review, and which of it we are doing | accepted; nine decisions, two still carrying a named open item, retires two storage cells of 0006, three comments and three sentences of `AGENTS.md`; **three of its own sentences now struck** — two open items it declared have been built, and one measured claim was wrong |
| [0027](0027-the-handbook-draws-the-apps-components.md) | The handbook draws the app's components, and the app's rendering is the one that counts | accepted; retires 0002's decision, two of its own claims retired by 0028, three open items named |
| [0028](0028-one-shell-and-a-route-that-declares-its-context.md) | One shell, and a route that declares its context | accepted; retires two of 0027's and two code comments, answers #112, four of its own claims retired by 0038, three open items named |
| [0029](0029-the-handbook-keeps-its-own-primitives.md) | The handbook keeps its own primitives, and the app's stack stops at the specimen | accepted; retires nothing, measured and rejected |
| [0030](0030-the-platforms-header-and-ours-on-web.md) | The platform's header on the phone, and ours on web | accepted; carries out 0026 §9 with two named exceptions, retires one claim each in 0004 and 0026 plus half a code comment, **iOS unrun** |
| [0031](0031-four-mechanisms-for-this-must-not-be-forgotten.md) | Four mechanisms for "this must not be forgotten", strongest first | accepted; retires its own first version of the same day, and names three existing checks as standing lower on the ladder than they need to |
| [0032](0032-a-port-for-the-error-report-before-a-provider-for-it.md) | A port for the error report, before a provider for it | accepted and built the same day; leaves the provider, the production policy and every retry question to #95 |
| [0033](0033-one-text-size-for-the-whole-app-the-systems-by-default.md) | One text size for the whole app, the system's by default | accepted, **not built**; retires the article scale's meaning, needs #158 first, and names the one opt-out the accessibility check has to excuse |
| [0034](0034-one-component-for-the-two-sided-row.md) | One component for the two-sided row, and a tab bar that stops pretending at 130 % | accepted and carried out the same day; retires the every-label claim in 0013, and is the prerequisite 0033 names |
| [0035](0035-a-check-that-opens-the-page.md) | A check that opens the page, because nobody forgot anything | accepted, built; retires nothing, and argues why 0031's four mechanisms could not have caught a page that mounted nothing |
| [0036](0036-the-home-screen-becomes-data.md) | The home screen becomes data, and the app survives what it does not know | accepted, partly built in #177 — the document, its parser and its default layout; the fetch, the configurator and the workbench's scenarios are **not built**; sixteen decisions from a product interview, retires nothing, narrows #163 to its last question and leaves that one to the source decision; five of its own claims retired by 0039 and four of §2's by 0045 |
| [0037](0037-the-whole-site-is-the-workbench.md) | The whole site is the workbench, and the device frame is `/preview` | accepted and carried out the same day; retires two of 0024's, renames nothing in here, and is why the note below exists |
| [0038](0038-one-tool-at-a-time-in-a-rail.md) | One tool at a time, in a rail | accepted and carried out the same day; six decisions, retires four of 0028's claims and names one it read and left standing, two open items named |
| [0039](0039-the-home-screen-is-a-day-not-a-timetable.md) | The home screen is a day, not a timetable | accepted and carried out the same day; eleven decisions, replaces the dayparts with a sequence of moments and deletes `lib/daypart.ts`, retires five of 0036's claims and names three it read and left standing, two of its own §10's locations retired by 0042 in #210, three open items named |
| [0040](0040-the-app-does-not-depend-on-the-workbench.md) | The app does not depend on the workbench | accepted and built the same day; four decisions from the architecture meeting in #200, both halves of its check exist — the configuration half in the app's suite, the build half as ci.yml's `independence` job, which really removes the directory and compares the two exports by module list and shape — retires nothing, names four records read for it, **strikes one of its own sentences**, which asked for a byte comparison the export cannot give, and leaves §4's server question to a record of its own |
| [0041](0041-a-change-may-name-an-audience.md) | A change may name an audience, and one file knows what the name means | accepted, **not built**; five decisions, extends 0039's day with who, names two of 0039's claims read and left standing, three open items named including the audience list itself |
| [0042](0042-the-timeline-belongs-to-the-stage.md) | The timeline belongs to the stage, not the tools | accepted, **built in #210** with 0045 §1, §2, §3 and §5 as one change; five decisions, moves 0039 §10's track out of the tool panel and keeps it in `full` above 64rem only, struck nothing itself and named the sentence its carrying-out would strike — which struck that one and a second the record had not foreseen, two open items named |
| [0043](0043-two-concepts-become-packages-and-the-shell-stays.md) | Two concepts become packages, and the shell stays | accepted, partly built — the checks package is `packages/prose-and-code`, Apache-2.0 and used from here; the decision-record package is **not built**; seven decisions, two capabilities surveyed and declined as already published, Backstage measured and rejected, two gaps recorded as deliberately unfilled, four open items named |
| [0044](0044-the-workbench-drives-a-real-device.md) | The workbench drives a real device, in the same view | accepted in shape, **not built** and not measured; five decisions, the ground it stands on measured over Android and nothing at all on iOS, names the one experiment that decides whether the shape is worth building, four open items named |
| [0045](0045-the-home-editor-arranges-the-blocks-it-draws.md) | The home editor arranges the blocks it draws, and a module declares its own settings | accepted, **§8 and §9 built in #208, §1, §2, §3 and §5 in #210, §4 and §6 in #213, §7 in #214**, and §10 alone unbuilt; ten decisions, the #210 half carried 0042 whole in the same change because 0045 §1 makes the list and the frame two halves of one reading of the day, and the #214 half built §7 in the shape 0047 gave it rather than as it is written here; makes the day's arrangement the editor's and gives each module a declaration a generator carries into the core, retires four claims in 0036 §2 and names 0039 §3 read and left untouched, five open items named and three of them answered by 0046 |
| [0046](0046-what-the-editor-may-add-and-what-a-block-is-called.md) | What the editor may add, what a block is called, and what a drawn row costs | accepted, **carried out**: §5 and §6 in #210, §1 to §4 in #213; six decisions clearing 0045's carrying-out, measures the drawn list at 69 ms a playhead step against 37 ms without it and finds the shipped document changes nothing at 1438 of 1440 minutes, retires one check in the app and writes none to replace it, two open items left where they were |
| [0047](0047-the-handle-is-the-pointers-and-the-arrows-are-the-keyboards.md) | The handle is the pointer's, the arrows are the keyboard's | accepted, **built in #214**; four decisions, gives each input a control shaped for it rather than one control shaped for both, retires two claims in 0045 §7 and leans on that section's own condition for the reason, two open items named including what a screen reader hears when the order changes |

Ten notes for readers of the older ones:

- ADR 0026's "What this has not delivered" section is two thirds out of date, and the
  strikes there say so rather than the section being rewritten. Its storage half was
  built in [#136](https://github.com/correctiv/correctiv-app/pull/136) and its
  Rozenite half in [#149](https://github.com/correctiv/correctiv-app/pull/149).
  Running Rozenite also falsified a measured claim in §1 — that guarding the require
  inside a function keeps the package out of a release bundle, which keeps the
  implementation out but not the export NAMES — so read §1's requires as module-scope
  throughout. The reasoning around all three is intact and worth reading; only the
  conclusions moved.
- ADRs 0001–0004 were written in German and translated on 2026-08-11, so the repo
  reads in one language ([AGENTS.md](../AGENTS.md#language)). Only the wording
  changed; the German originals are in the git history.
- ADRs 0001–0004 cite a strategy paper (`APP-STRATEGIE.md`, revision 2, July 2026)
  that recommended staying on NativeScript. ADR 0004 reversed that recommendation and
  the paper was removed from the working tree on 2026-08-06; it is in the git history
  if you need the original wording.
- ADR 0005 scheduled `apps/mobile` for removal in a phase 5; ADR 0006 suspended that
  schedule; [ADR 0007](0007-removing-the-nativescript-host.md) carried it out on
  2026-08-12. Read 0006 for what the core is and why, not for how many apps there
  are — that half of it is history, and the reason it gives for the split is the
  reason the split survived the removal.
- The app directory was renamed from `apps/mobile-rn` to `apps/mobile` on 2026-08-28,
  and the package from `@correctiv/mobile-rn` to `@correctiv/mobile`
  ([ADR 0011](0011-naming-the-app-for-release.md)). Paths in the ADRs are left as they
  were written, so read `mobile-rn` as today's `mobile`. **Do not read it the other
  way round.** In 0005, 0006 and 0007 the bare `apps/mobile` is the *deleted*
  NativeScript app, which is why 0007's decision line reads "`apps/mobile` is deleted.
  `apps/mobile-rn` is the app" and means two different directories.
- The site directory was renamed from `apps/handbook` to `apps/workbench` on
  2026-09-16, the package from `@correctiv/handbook` to `@correctiv/workbench`, and the
  device frame's route from `/workbench` to `/preview`
  ([ADR 0037](0037-the-whole-site-is-the-workbench.md)). Paths and addresses in the ADRs
  are left as they were written, so read `apps/handbook` as today's `apps/workbench`.
  **Do not read it the other way round, and here that is the reading that bites.** In
  0014, 0024, 0025, 0026, 0028, 0035 and 0036 the bare `/workbench` is the *device
  frame*, which is `/preview` today, and not the site that now carries the name; the
  titles of 0024, 0027 and 0029 call the whole site "the handbook", which is today's
  workbench and not today's `/handbook`, which is the documents area inside it.
- The repository moved from the GitHub organisation `faktenforum` to `correctiv` on
  2026-09-17; the repository name and the Pages base path `/correctiv-app/` did not
  change. `https://faktenforum.github.io/correctiv-app/` now answers 404 and every
  address built on it is dead — read it as
  `https://correctiv.github.io/correctiv-app/` wherever an older record names it.
  `https://github.com/faktenforum/correctiv-app`, and every issue and pull request
  link built on it, still redirects to `https://github.com/correctiv/correctiv-app`,
  so those addresses in older records keep working and, same as the paths above, are
  left as written rather than edited to look right in hindsight.
- ADRs 0002 and 0006 describe a NativeScript app that is no longer in the tree. They
  are records, not descriptions: neither has been rewritten, and 0007 says which of
  their statements have expired.
- The same applies to 0004 and 0007 wherever they name **zustand**, **NativeWind**,
  `nativewind-env.d.ts`, `.dark:root` or `stores/create-store`. The state moved to
  Redux Toolkit ([0009](0009-redux-toolkit-for-the-cores-state.md)) and the styling
  engine to Uniwind ([0008](0008-uniwind-over-nativewind.md)); those passages are what
  was true when they were written.

- ADR 0022 counts the app's raw colour values and gets it wrong by two. That
  sentence is struck in place, dated, and says which two sites it missed. It is the
  one strike in here that no later decision caused: the claim was false when it was
  written.

[ADR 0022](0022-three-tiers-of-colour-and-a-dark-scheme-that-names-roles.md) retires
two claims in 0010 about the dark palette. Both were true when written: upstream's
dark block really did hold the light values, and `palette.js` really did assign every
grey by role. wp-design-tokens `8ed7a28` deleted the first and made the second
unnecessary. 0010's decision — the package is the shared one, the app writes nothing —
is untouched.

[ADR 0030](0030-the-platforms-header-and-ours-on-web.md) retires one claim in 0004 and
one in 0026. 0004's is the premise "this app sets `headerShown: false` throughout and
builds its own header rows": thirteen routes take the platform's header now, and the
conclusion 0004 drew from it — that the search screen is the wrong place for a native
search bar — is one of the two exceptions 0030 names, so the argument survives its
premise. 0026's is "every pushed route on the published web target sharing one
browser-tab title": they shared none, every page shipped an empty `<title>`, and the
difference decided what the fix was. Both are strikes about a claim rather than about a
conclusion; both conclusions were right.

[ADR 0028](0028-one-shell-and-a-route-that-declares-its-context.md) strikes two of
0027's claims, both of which 0027 wrote knowing the next change would make them false:
the three-frame cap on the old components page, and "the components page that is built
around this is the next change and is not here". It is that change. 0027's measurement
and its argument for a registry that cannot describe something it does not build are
untouched, and are why the registry now carries a list of *exceptions*.

[ADR 0027](0027-the-handbook-draws-the-apps-components.md) strikes 0002's status and
its decision line, "Stay on `@nativescript/vite@2.0.3` / Vite 7". Half of that
sentence was already moot under 0007, but 0002 was still the only record in here
saying which bundler this project runs, and the answer had changed without one. Its
measurement — a bundler dropping a polyfill and staying green — is untouched and is
why the record is kept.

[ADR 0015](0015-reading-correctiv-org-through-its-rest-api.md) retires the CORS item
in 0006 and four claims in the top-level docs. Read its last section for the list; the
short version is that "correctiv.org sends no CORS header" was true of the RSS feeds
and never of the REST API.

**How a decision is numbered, and why the number never moves.**

Every record numbers the decisions inside it. A decision opens its heading with a
figure — `### 6. German and English from the first string` — and is cited as
`ADR 0026 §6`, from another record, from a code comment, from a test. That replaces
citing a decision by the prose of its heading, which is what this repository used to
do and which dies silently the day somebody rewords the heading: rewording a heading
is not rewriting a record, so the strike rule below does not protect it and no check
notices.

**The numbers are append-only.** A number is never reused and never moved to a
different decision, a new decision takes the next free one, and a decision that is
removed leaves its number behind as a gap rather than closing it. Renumbering is the
one edit that invalidates every citation already written, everywhere, at once.
[`decisions.lock.json`](decisions.lock.json) is the ledger: for every record, each
slug its file has carried and, for every decision number, each text it has carried,
oldest first. `npm run adr:lock` appends to it and never rewrites it, and
[`apps/workbench/test/decision-numbers.test.ts`](../apps/workbench/test/decision-numbers.test.ts)
is what holds the records against it.

**One check in there is worth the rest put together**, and it is the one that reads
`git show origin/main:adr/decisions.lock.json`: the ledger in a working tree has to be
an *extension* of the published one. No record dropped, no number dropped, every
history a prefix of its new self. Appending is the only direction it permits.

**What that buys is permanence, not prevention**, and the difference is the part to
read carefully, because the first version of this section claimed the stronger thing.
A renumbering put through `npm run adr:lock` only appends, so it passes: §1 and §3
each gain the other's heading. What the check makes impossible is taking that back
out. The ledger then carries both texts under both numbers for good, and the commit
that did it shows two appends side by side, which is a shape no ordinary edit
produces. A number cannot be moved quietly; it can still be moved.

The rest of the checks read the working tree alone, and a renumbering that edits the
records and the ledger in one pass leaves a tree that agrees with itself perfectly.
Two cold reviews walked straight through them: swap two numbers and reword both
headings by one character, and `adr:lock` records two rewordings; swap two numbers and
swap their two histories, and it has nothing to add. The second is refused now. The
first is refused only where the reword is punctuation, because the within-record check
compares headings with their punctuation, spacing and case taken off; a swap whose
headings are genuinely rewritten is caught by nothing, and that is written down here
rather than left for the third review to find. These checks stay because they catch
the accident, the half-finished edit and the copy-paste for almost nothing, and
because they run in a checkout that has never fetched. They are not a defence against
somebody who means it. Nothing in a repository is, and a check that says it is, is
worse than no check.

**What takes a number is a decision, not a heading.** *Context*, *Consequences*,
*What it measured* and *What this retires* are the argument and the bookkeeping
around the decision. A number on one of those would make the number mean "heading",
and a number that means "heading" says nothing worth citing. So the numbered sections
of a record are its `## Decision` together with whatever `###` sections inside it
state a choice of their own; a `###` that only argues for the decision above it takes
no number, which is why ADR 0004's two and ADR 0017's two have none — 0017's sit
between its §1 and its §2, arguing for the first. Where the
`## Decision` block is one unsectioned paragraph — which is most of them — that block
is the decision and the number goes on the heading itself, `## 1. Decision`.

Two records keep a number outside `## Decision`, because the number follows the
decision and not the heading level. ADR 0003 has no `## Decision` at all, being a
spike; its conclusion is `## 1. Consequence for the stack decision`. ADR 0030 §2 is a
section whose own title says it is a decision. Nothing else outside `## Decision` is
numbered.

**On the site the number is the anchor.** `/decisions/0026#6` is §6, and
`apps/workbench/plugin/markdown.ts` mints that id from the figure rather than from a
slug of the heading's words, so a reword moves nothing. On GitHub the anchor is still
the slug of the whole heading text, because GitHub derives it from the text and
nothing in this repository can change that.

**And two records must never share a record number.** On 2026-09-16 two of them both
claimed 0034, written in parallel; the filenames differed by their slug, so git merged
them with no conflict and the duplicate was found by somebody happening to look. The
same test now fails on it. `npm run adr:new` prints the next free number, reading
`adr/`, the numbers claimed by open pull requests, and `origin/main` after fetching it
— the tree alone is what both agents read that day, and the tree alone was what agreed
with both of them. It prints the number whether or not it could read all three,
because somebody asking for it is about to write a record; the exit code and the line
beside the number are what say whether it was verified.

**How an expired claim is marked.** An ADR is never rewritten to look right in
hindsight — the reasoning is the part worth keeping. A claim a later decision made
**false** is struck through where it stands, with one clause saying what voided it and
a link to the ADR that did; the argument around it is left intact. The newer ADR
carries a section naming every statement it retires, so the two ends cannot drift
apart. See 0004's store and storage-port paragraphs, and 0006's ports table. The rule
is in [AGENTS.md](../AGENTS.md#decisions).

ADR 0004 is long because it doubles as the changelog of the pivot. Its "Offen"
section is superseded by ADR 0006's "What is still open", of which
[ADR 0007](0007-removing-the-nativescript-host.md) closes all but the CORS item —
which [ADR 0015](0015-reading-correctiv-org-through-its-rest-api.md) then closed too,
by finding that the missing header was a property of the RSS feeds and not of
correctiv.org.
