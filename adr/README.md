# Architecture decisions

Sixty-one records shaped this repo. Read them when you want to know *why* something
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
| [0033](0033-one-text-size-for-the-whole-app-the-systems-by-default.md) | One text size for the whole app, the system's by default | accepted; §1 built in [#260](https://github.com/correctiv/correctiv-app/pull/260), with the three steps and the 1.15 ceiling kept; retires the article scale's meaning and its field, and the check excuses the one opt-out it names; iOS unrun |
| [0034](0034-one-component-for-the-two-sided-row.md) | One component for the two-sided row, and a tab bar that stops pretending at 130 % | accepted and carried out the same day; retires the every-label claim in 0013, and is the prerequisite 0033 names |
| [0035](0035-a-check-that-opens-the-page.md) | A check that opens the page, because nobody forgot anything | accepted, built; retires nothing, and argues why 0031's four mechanisms could not have caught a page that mounted nothing |
| [0036](0036-the-home-screen-becomes-data.md) | The home screen becomes data, and the app survives what it does not know | accepted, partly built in #177 — the document, its parser and its default layout; §15 in #246, the fetch in #245 and the configurator through 0045 to 0053; the workbench's scenarios in #253, the election night first, with sample data that holds the pins and not the feeds; sixteen decisions from a product interview, retires nothing, narrows #163 to its last question and leaves that one to the source decision; five of its own claims retired by 0039 and four of §2's by 0045 |
| [0037](0037-the-whole-site-is-the-workbench.md) | The whole site is the workbench, and the device frame is `/preview` | accepted and carried out the same day; retires two of 0024's, renames nothing in here, and is why the note below exists |
| [0038](0038-one-tool-at-a-time-in-a-rail.md) | One tool at a time, in a rail | accepted and carried out the same day; six decisions, retires four of 0028's claims and names one it read and left standing, two open items named |
| [0039](0039-the-home-screen-is-a-day-not-a-timetable.md) | The home screen is a day, not a timetable | accepted and carried out the same day; eleven decisions, replaces the dayparts with a sequence of moments and deletes `lib/daypart.ts`, retires five of 0036's claims and names three it read and left standing, two of its own §10's locations retired by 0042 in #210, three open items named |
| [0040](0040-the-app-does-not-depend-on-the-workbench.md) | The app does not depend on the workbench | accepted and built the same day; four decisions from the architecture meeting in #200, both halves of its check exist — the configuration half in the app's suite, the build half as ci.yml's `independence` job, which really removes the directory and compares the two exports by module list and shape — retires nothing, names four records read for it, **strikes one of its own sentences**, which asked for a byte comparison the export cannot give, and leaves §4's server question to a record of its own |
| [0041](0041-a-change-may-name-an-audience.md) | A change may name an audience, and one file knows what the name means | accepted, built by 0060; five decisions, extends 0039's day with who, names two of 0039's claims read and left standing, three open items named including the audience list itself; its status, two claims and the list's open item struck by 0060 |
| [0042](0042-the-timeline-belongs-to-the-stage.md) | The timeline belongs to the stage, not the tools | accepted, **built in #210** with 0045 §1, §2, §3 and §5 as one change; five decisions, moves 0039 §10's track out of the tool panel and keeps it in `full` above 64rem only, struck nothing itself and named the sentence its carrying-out would strike — which struck that one and a second the record had not foreseen, two open items named |
| [0043](0043-two-concepts-become-packages-and-the-shell-stays.md) | Two concepts become packages, and the shell stays | accepted, partly built — the checks package is `packages/prose-and-code`, Apache-2.0 and used from here; the decision-record package is **not built**; seven decisions, two capabilities surveyed and declined as already published, Backstage measured and rejected, two gaps recorded as deliberately unfilled, four open items named |
| [0044](0044-the-workbench-drives-a-real-device.md) | The workbench drives a real device, in the same view | accepted in shape, **not built** and not measured; five decisions, the ground it stands on measured over Android and nothing at all on iOS, names the one experiment that decides whether the shape is worth building, four open items named |
| [0045](0045-the-home-editor-arranges-the-blocks-it-draws.md) | The home editor arranges the blocks it draws, and a module declares its own settings | accepted, **§8 and §9 built in #208, §1, §2, §3 and §5 in #210, §4 and §6 in #213, §7 in #214**, and §10 struck whole by 0048 rather than built; ten decisions, the #210 half carried 0042 whole in the same change because 0045 §1 makes the list and the frame two halves of one reading of the day, and the #214 half built §7 in the shape 0047 gave it rather than as it is written here; makes the day's arrangement the editor's and gives each module a declaration a generator carries into the core, retires four claims in 0036 §2 and names 0039 §3 read and left untouched, five open items named and three of them answered by 0046, and two of its own claims struck by 0053 |
| [0046](0046-what-the-editor-may-add-and-what-a-block-is-called.md) | What the editor may add, what a block is called, and what a drawn row costs | accepted, **carried out**: §5 and §6 in #210, §1 to §4 in #213; six decisions clearing 0045's carrying-out, measures the drawn list at 69 ms a playhead step against 37 ms without it and finds the shipped document changes nothing at 1438 of 1440 minutes, retires one check in the app and writes none to replace it, two open items left where they were, one claim struck by 0054 |
| [0047](0047-the-handle-is-the-pointers-and-the-arrows-are-the-keyboards.md) | The handle is the pointer's, the arrows are the keyboard's | accepted, **built in #214**; four decisions, gives each input a control shaped for it rather than one control shaped for both, retires two claims in 0045 §7 and leans on that section's own condition for the reason, two open items named including what a screen reader hears when the order changes |
| [0048](0048-the-gallery-points-at-the-editor-rather-than-copying-it.md) | The gallery points at the editor rather than copying it | accepted, **§3 built in #215**, which is one sentence and one link on `/components`; four decisions and three of them are to stop, so it stood as proposed for a day until the review kept all four and raised the question under §1, which is 0054; strikes 0045 §10 whole and answers its four open questions by not building the surface that raised them, three open items named |
| [0049](0049-the-catalogue-is-a-package.md) | The catalogue is a package, and the locale comes from the host | accepted, **§1, §2, §5 and §6 built in #219, §3 and §4 in #221**, and §4 has two of the three users it names since **#226**, the desktop host being the one still missing; six decisions, takes the strings out of the app so the core's own German stops living in one of its hosts, names four things that deliberately do not move with them, strikes one claim in 0026 §6 that was wrong when written and leaves a second for the record that voids it, retires one sentence of AGENTS.md, the one-language checks split between the package and the app |
| [0050](0050-the-workbench-gets-a-second-audience.md) | The workbench gets a second audience, and the scope of its German follows from that | accepted, **§1 to §4 built in #220** for the frame's controls and the day's track, §5 named and deferred and then moved by 0052; five decisions, names the one audience outside development and draws the line at the shell and the tools against a published page body, after an area line failed a cold review and a chrome line could not be finished, keeps two catalogues because the app may never depend on this site, and puts the setting where the appearance already is rather than in the address, and its default is struck by 0051, and its line is struck by 0052 |
| [0051](0051-the-workbench-starts-in-the-browsers-language.md) | The workbench starts in the language the browser asks for | accepted, **built in #227**; four decisions, an untouched browser gets the language it asks for instead of the language the source is written in, “System” becomes a third value of the setting the way the appearance already has one and follows `languagechange` live, one row of the picker is translated and it is the only one, and the constant that meant both the source language and the default is split in two; strikes one claim in 0050 §4 |
| [0052](0052-the-sites-own-words-follow-the-setting.md) | The site's own words follow the setting, the repository's are printed as they are written | accepted, **§3 built in #229, §1, §2 and §4 in #230**, which migrates the first area and leaves the rest in a ratchet, **§5 added in #231** after a later area found the gap, then **§6 in #234** and **§7 in #235**; seven decisions, replaces a line drawn by position with one drawn by author after measuring a page whose filter was English inside a German shell, holds it with the app's own language-blind literal check over a per-file ratchet, shares that walk through prose-and-code while each check keeps its own argument, leaves `content/` quoted rather than narrated with the open editorial questions named as the case against, and takes the home configurator's block labels last of all by handing that module a formatter rather than a tree of descriptors; strikes the line in 0050 §2 and the deferral in 0050 §5 and retires one sentence of AGENTS.md |
| [0053](0053-the-editor-is-the-screen-and-the-drag-is-the-answer.md) | The editor is the screen, and the drag is its own answer | accepted, **built in #236**; five decisions, drops the card so the panel is the home screen at the phone's own width and draws a switched-off block greyed instead of collapsing it, makes a drag show itself by offsetting every row with a transform into the place a release would write, so the list slides instead of lurching and the drop is a no-op on screen, after a first version that really reordered the DOM lost the pointer capture to React's `insertBefore` and a centre-based model jumped two places on `pointerdown`, puts a block's name, id and settings in a popover beside it rather than under it, reveals the controls over the block without making the keyboard's route conditional, and keeps one gutter so a list that looks like the app is not taken for it; strikes one claim in 0045 §2 and one in 0045 §8, and refuses in-frame editing on the model rather than on the mechanism |
| [0054](0054-a-block-declares-where-it-may-appear.md) | A block declares where it may appear, and the words stay with the tool | accepted in shape, **§2 and the field half of §5 built in #237** the day after; five decisions, from the review of 0048, which proposed a mechanism rather than disputing the outcome; keeps the declaration on the block rather than on a component because a block is a composition, gives it a list of screens rather than one, draws the line between the structure the app declares and the words the workbench says, refuses to plan for a bundler feature this repository has not switched on, and builds the field before the second screen and not the screen, three open items named including what a second configurable screen even is |
| [0055](0055-the-rail-takes-a-mouse-and-the-app-owns-the-affordance.md) | The rail takes a mouse, and the app owns the affordance | accepted, **built the same day**; four decisions, settles where a browser-only affordance belongs after measuring that a mouse drag over a rail selected text and opened an article, puts it in the app's web target because one platform pair there reaches both the framed app and this site's own drawings while the reverse reaches neither reader, and rejects the wheel translation and the grab cursor on measurements of their own; retires nothing, names ADR 0040 as read and unbroken and answers the core boundary AGENTS.md states more forcefully than that one, the open items named including the text selection a rail no longer offers and the rail card no keyboard can open |
| [0056](0056-a-string-is-picked-where-it-renders.md) | A string is picked where it renders, and the German is what is edited | accepted, **not built**; eight decisions, carrying the home configurator's shape to the strings after measuring what a rendered wording resolves to — text back to id with the owner chain as the tie-break, matched on the text node because a decorative arrow is a text node too, a pattern of pure holes excluded from the lookup rather than guessed at, the table kept as the half the picker cannot reach, and the edit confined to the German because the English is source; retires nothing, names `rendered-literals.test.ts` as what makes "no id" a true answer and holds the new override key to the power argument in `lib/locale.ts`, three open items named |
| [0057](0057-the-structure-comes-from-the-workbench-the-selection-from-wordpress.md) | The structure comes from the workbench, the selection comes from WordPress | accepted, **§4 built in #245**, the WordPress mark not chosen yet; five decisions, answers the one question 0036 left open and the one 0040 §4 reserved by splitting it, the screen's structure edited here and the choice of article flagged in WordPress, after measuring that `wp/v2/posts` can be asked for `sticky`, a category or a tag and for no meta or ACF field at all; keeps the document in the core so the published copy is not something the workbench operates, names what moves if the editor is ever built again as a WordPress plugin, strikes one sentence of 0036's open question and one clause of 0036 §4 and retires nothing in 0040, four open items named including which mark WordPress uses |
| [0058](0058-the-workbench-holds-no-power-and-github-is-who-you-are.md) | The workbench holds no power, and GitHub is who you are | accepted; §1 holds, §2 built in #246 and revised by 0061, §4 to §6 not built; six decisions, answers how a change reaches the repository after measuring that a credential in the page would sit on an origin shared with every Pages site of the organisation and one Markdown change from anything injected into it, so the workbench holds none and every authorised act leaves it by navigation; "Submit changes" ~~copies the document and opens GitHub's editor~~ (voided by 0061), GitHub carries identity, permission, record and offboarding, and the merge stays the lock; creates the private companion repository under the rule that the open one is complete without it, with the check arriving beside its first consumer, no code in it ever, and a fetch in CI rather than a submodule; strikes one sentence of 0036 §15, the close of 0036's open section and one clause of 0050's context, and with 0057 one clause of 0039, four open items named |
| [0059](0059-the-day-gets-a-date-and-the-newsroom-plans-in-editions.md) | The day gets a date, and the newsroom plans in editions | accepted, **§6 and §8 built in #247, §2's zooms in #258**, §7 not built; nine decisions from a design memo written for it, answering 0039's "whether a day is enough": an edition is a named layer over the day with its own start and moments, active for a span or on weekdays, the playhead becomes an instant and the address carries a date, the narrower window wins and an overlap is resolved rather than refused, an older app reads the day so the day must always stand alone, the document speaks Berlin time for everything including the day, and the full plan lives in the private companion while CI publishes a projection with a horizon and never clips an end; names the first slice and what it leaves out, and nine things not to build; strikes two clauses of 0039's open item, four open items named |
| [0060](0060-a-block-says-when-it-appears-and-an-editor-says-for-whom.md) | A block says when it appears, and an editor says for whom | accepted and built the same day; seven decisions, carries out 0041: a block's own condition is declared beside it and shown read-only, a module may name a default audience the document overrides, three audiences in the club's words and one file for them, the reader is the fold's third parameter and the preview is the state tool's fixtures, a place's audience sits beside the sections so an older app ignores it rather than dropping the place, and nothing is locked; "not yet a member" left out until #242 §4, strikes three of 0041's claims and one of its open items and a clause of 0053, four open items named |
| [0061](0061-a-submission-is-an-issue-and-ci-makes-the-pull-request.md) | A submission is an issue, and CI makes the pull request | accepted, **built the same day**; seven decisions, carrying out 0058 §1 and revising its §2 after the product owner found the clipboard and GitHub's editor unreasonable for the newsroom: one click opens a prefilled GitHub issue and a workflow ported from Learn6502 turns it into a pull request authored by the person, with a German summary derived from the diff of the two parsed documents; a submission's kind is its title prefix, `[startseite]` built and `[texte]` named for the German catalogue with ADR 0056's picker; it runs by itself only for the organisation and its collaborators, and a maintainer's manual run is bound to the text they read; CI on the pull request needs a token held by CI, and without it the workflow checks the file itself and says so; the address is bounded at 4000 characters after measuring GitHub's sign-in redirect, with the clipboard past it; nothing from the issue reaches a shell as code or the pull request's body as an instruction, held by tests that keep the security review's inputs; strikes the mechanism of 0058 §2, one sentence of its alternatives and its third open item, five open items named |

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
