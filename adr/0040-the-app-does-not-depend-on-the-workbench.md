# ADR 0040 — The app does not depend on the workbench

Status: accepted, 2026-09-17, from the architecture meeting held in
[#200](https://github.com/correctiv/correctiv-app/issues/200). **Built the same day**, in
both halves, and the two questions this record leaves open about how are answered here.

The configuration half is `apps/mobile/__tests__/no-workbench-dependency.test.ts`, in the
suite and therefore in `npm run check`, because it is a source read that costs under a
second and the mistake it catches is written at a desk. The build half is ci.yml's
`independence` job, beside `web`, because it costs two installs and three web exports, two
of them from a cache of their own so that neither can replay the other, and because **the
deletion is real**: `apps/workbench` is moved out of the checkout, `npm ci`
runs again so the tree is the one npm would have installed had the directory never been
there, and the app's export is compared with the earlier one. A runner's checkout can be
destroyed and a working tree cannot, which is the whole of why that half is not in the
suite. That comparison is the bundle's module list plus the shape of everything else, and
not its bytes; §2's sentence about the bundle is struck where it stands and
`scripts/export-shape.mjs` holds the measurement that struck it. Simulating the deletion
was rejected for the reason §2 gives for the configuration half existing at all: an
exclusion list is a list, and a stale list is the failure being tested.

Two of the three questions under "What is still open" are answered by that paragraph, and
both are struck where they stand. The third, where the home document is served from, is
untouched, and §4 stays a decision with a record rather than a check: nothing in either
half can tell a URL the workbench operates from correctiv.org's REST API, and a check that
cannot fail is not written.

## Context

The note was "Workbench and app should remain independent from each other".

Read literally that is already false, and it cannot be made true without giving up the
best thing on the site. `apps/workbench/vite.app.mjs` compiles components out of
`apps/mobile/src`; `/components` draws the app's real components rather than copies of
them ([ADR 0027](0027-the-handbook-draws-the-apps-components.md)); `/preview` frames the
app's own web export ([ADR 0037](0037-the-whole-site-is-the-workbench.md)). The workbench
is a tool for looking at the app, and a tool that cannot reach the thing it looks at is a
brochure.

What the note means, and what the interview afterwards settled, is that the coupling has
to have **one direction**. Today it does, and nothing says so. It holds because nobody has
broken it, which is the state every rule in this repository is in just before it stops
being true.

**Four places where the two halves touch today, and what each one's direction is.**

- `apps/workbench/vite.app.mjs` reads `apps/mobile/src`. The workbench reaching into the
  app.
- `apps/workbench/test/environment.test.ts` holds the workbench's provider list against
  `apps/mobile/src/lib/env/AppEnvironment.tsx`, because the workbench's copy of that list
  drifted once and a drawn specimen lost its `react-intl` provider. The workbench holding
  itself against the app.
- `apps/mobile/src/gallery/Gallery.tsx` declares `workbench:seeded`, and
  `apps/workbench/src/preview/frame/seed.ts` writes it. Two spellings of one string,
  held together by `apps/workbench/test/preview/seed.test.ts`. The same shape again for
  `workbench:home-layout` and `workbench:home-time`
  ([ADR 0039](0039-the-home-screen-is-a-day-not-a-timetable.md) §8), under
  `apps/workbench/test/preview/home-document.test.ts`.
- `apps/mobile/src/global.css` carries `@source './'`, one line saying where this app's
  class names are written, put there because a second bundler compiling the same
  stylesheet scanned its own root and emitted a sheet the app's classes were missing
  from. `apps/workbench/test/environment.test.ts` fails if the line goes.

Every one of them is the workbench reading the app or the workbench holding itself to the
app. Not one is the app reading the workbench, and in three of the four the check that
holds the pair is **inside the workbench**, which is the direction already written as code
rather than as prose.

**Why the direction is worth a record rather than a habit.** The app ships, to a phone,
through a store. The workbench is a developer tool on a public URL with no access control
([ADR 0036](0036-the-home-screen-becomes-data.md)'s Context says so and is why the
configurator is ours). A dependency from the app to the workbench puts a tool inside a
release bundle, and this repository has already measured how quietly that happens:
[ADR 0026](0026-react-native-review-and-hardening.md) §1 found that three of five ways of
writing a guarded `require()` leaked the devtool's export names into a production export
while every one of them looked guarded in the source.

## Decision

### 1. One direction, and it is not symmetric

The workbench may read the app. The app may never read the workbench.

That is the whole rule, and the asymmetry is the content: "independent from each other"
would cost the component gallery, and the gallery is the thing that makes the site worth
having. A workbench that could not reach the app would draw its own copies of the app's
components, and the one time it kept a copy of something the app owned, the copy drifted
and nobody noticed until a specimen threw.

### 2. What the check has to assert, and why building without the directory is not the whole of it

The obvious phrasing is right and it is the backstop: **with `apps/workbench` deleted, the
app still typechecks, its suite still passes, and `npm run build:web` still produces ~~the
bundle it produces now~~ the same app.** Struck on 2026-09-17, the day it was built, as
wrong when it was written and not overtaken: **`expo export` does not emit the same bytes
twice.** Given a cache of its own, twenty exports of one unchanged tree produced twenty
different bundle hashes, and two of the twenty a different bundle LENGTH as well. The
check's first version took this sentence literally, passed only when the second export
replayed the first out of a warm transform cache, and went red on a pull request that
changed nothing but Markdown. What IS invariant across those twenty is the module list,
the stylesheets and the assets, and that is what "the same app" means here;
`scripts/export-shape.mjs` carries the measurement and names what the comparison cannot
see. That is the strongest half, because it asks the real toolchain rather than a regular
expression, and because it catches the couplings nobody thought to list.

It is not sufficient, and the reason is that several ways of depending on the workbench go
**green** when the directory is gone rather than red:

- **A resolved import.** `@correctiv/workbench` in `apps/mobile/package.json` or in a
  package's — the workspace symlink makes the import compile. That one does fail when the
  directory goes. What does not fail is the manifest entry on its own, sitting there
  before anybody has written the import, and a dependency declared is a dependency that
  will be used.
- **A configuration glob that matches nothing.** Tailwind's `@source`, jest's
  `moduleNameMapper`, Metro's `watchFolders`, a `paths` alias in `apps/mobile/tsconfig.json`.
  A glob pointing into a directory that is not there **matches nothing and builds**, and
  what comes out is an app missing whatever that glob was contributing. This is not
  hypothetical from the other side: `src/global.css` records a stylesheet that built green
  while dozens of the app's utilities were missing, so every row stood on end. A check
  that only builds cannot see it.
- **A script.** An npm script of `@correctiv/mobile` shelling into the workbench
  workspace, or a workflow step that builds the workbench before exporting the app.
  `build:web` is `expo export` and a copy today, and `.github/workflows/ci.yml`'s `web`
  job runs that and nothing else. A build step added for a good local reason is how this
  is lost.
- **A generated file the app reads, taken out by copy rather than by path.** An import of
  `apps/workbench/content/*.generated.*` dies with the directory; a script that copies one
  into `apps/mobile` first does not.

So the check is in two halves, and each covers what the other cannot see:

1. **Read the app's manifests and configuration.** Nothing under `apps/mobile` or
   `packages/` may name `@correctiv/workbench`, and no path any of the app's toolchains
   reads may point into `apps/workbench`. This is the half that catches what builds green.
2. **Build without it.** The backstop, for the couplings this list does not name, which is
   the set that matters most because nobody can enumerate it.

The first half is a list, so it carries [ADR 0031](0031-four-mechanisms-for-this-must-not-be-forgotten.md)'s
obligations for a mechanism-4 check: each entry says why that file is on it, and the check
says at itself what it cannot see — a configuration file added after it was written is
invisible to it, and that is exactly what the second half is for.

**Why this is mechanism 4 and cannot be lifted higher.** There is no type that fails: an
import from the app into the workbench compiles perfectly, because both are TypeScript in
one workspace. There is no primitive to take away: npm workspaces make every package
reachable from every other by construction. The second half is the nearest thing to a
higher rung available — it asks the toolchain rather than the source, the way the drift
checks ask the generator rather than the committed file.

### 3. A shared spelling is not a dependency, and the check must not report one

Several things in the app name the workbench today and every one of them is correct: its
comments, the `workbench:` prefix on the override keys, `src/gallery/`, and
`@source './'`.

The rule that separates them from a dependency is **which side the check is on**. The app
may *declare* a seam that the workbench uses; it may not *read* the workbench in order to
know what to declare. `HOME_LAYOUT_OVERRIDE_KEY` is a constant in `apps/mobile`, and the
test that holds the workbench's spelling to it is in `apps/workbench`. Move that test into
the app's suite and nothing about the app's bundle changes, but the app's suite now fails
when the workbench changes, which is the dependency wearing a different coat.

A comment is on the same side of that line. It names the other half so that the next
reader knows the seam has two ends, and it compiles to nothing.

### 4. No app server, unless that is decided on its own

The meeting's note — "No app server unless agreed otherwise" — is recorded here rather
than in a record of its own, because it is the one thing that could invert §1 above without
anybody writing an import.

The app is a static export and the workbench is a static site; the Pages job assembles
them into one artefact at one origin ([ADR 0024](0024-the-handbook-owns-the-root.md),
[ADR 0037](0037-the-whole-site-is-the-workbench.md)), which is what makes the frame's
same-origin property reads work at all. A server would be a third thing, and the first
thing anybody would put on it is the home document that
[ADR 0036](0036-the-home-screen-becomes-data.md) §4 has the app fetching and whose home
0036 leaves open. From there the shortest path is the workbench writing that document and
the app reading it back, and the app would then depend on something the workbench
operates — which no check on imports or configuration would see, because there is no
import.

So: a server for the app is a decision with a record, not a step in somebody's
implementation. ADR 0036 §15 — a job writes a file, a pull request carries it — is the
answer that needs no server, and it is the answer for as long as we are the ones editing.

## Why not the alternatives

**Make both directions illegal, which is what the note literally says.** The gallery goes,
and with it the reason the site convinces anybody. The workbench would draw its own copies
of the app's components, and this repository has measured what happens to a copy: the
workbench held its own list of providers, that list drifted, and a drawn specimen lost the
`react-intl` provider it needed to format a message. `AppEnvironment.tsx` exists because of
that. One shared thing is one thing to keep in step; two copies is a thing that goes wrong
on a day nobody is looking.

**Move the workbench to its own repository now.** The direction then needs no check at
all — the repository boundary is the check, and it is a much stronger one than anything
here. It also inverts the cost immediately: the workbench needs the app's source to draw
its components, so the app becomes a published dependency, and every change to a component
becomes two pull requests in two repositories with a version between them. The gallery is
worth more than the enforcement, today, at this size.

**Leave it to review.** Review is what was in place when two agents wrote ADR 0034 twice
on one tree, and when a German string shipped in the file a review had just rewritten. A
rule with no way to fail is not a rule; it is a preference with good manners.

## What it costs

**A move to a separate repository will be more expensive than it would have been.** The
workbench reads `apps/mobile/src` in four ways, so extracting it means publishing the app
as a package, or vendoring its source, or giving up the gallery. That cost is accepted
knowingly and it is the cost of the asymmetry in §1 above, not an oversight in it.

**The configuration half of the check is a list, and a list rots.** The honest statement is
that it is a list of the files the app's toolchain reads *today*, that a new one is
invisible to it, and that the build-without-it half is what stands behind that blind spot.
Written beside the assertion, per ADR 0031, and not only here.

**Building the app twice is not free.** The second half of the check is a web export with a
directory removed, which is minutes rather than seconds, and `npm run check` is measured in
[ARCHITECTURE.md](../ARCHITECTURE.md) because it is short enough to run constantly. Where
that half runs is named below as open.

## What is still open

**Where the two halves of the check run.** The configuration half is a source read and
belongs in the suite. The build half costs an export and probably belongs in
`.github/workflows/ci.yml` beside the `web` job, which already builds the app once. ~~Not
decided, and it decides whether the rule fails at the desk or fails in CI.~~ Decided on
2026-09-17, the day this was written, and the status line at the top says which way and
why: the configuration half in `npm run check`, the build half as ci.yml's `independence`
job. The paragraph above it is what the decision was made from and is left standing.

**Whether the deletion is simulated or real.** Removing the directory in a working tree is
the honest version and is destructive; an alternative is a build with the workspace
excluded, which is cheaper and tests something slightly different. ~~The difference matters
and this record does not settle it.~~ Settled the same day, in favour of the real
deletion, for the reason this section is about to give itself: an exclusion list is
another configuration list, and a stale one is the failure the other half exists to catch.
The status line carries it.

**Where the home document is served from in production.** ADR 0036's open question,
untouched. §4 above says only that answering it with a server is a decision of its own.

## What this retires

**Nothing is struck.** No record in `adr/` claims the app may read the workbench, and none
claims independence in both directions.

Four were read for it and all four stand.
[ADR 0014](0014-the-preview-shell-as-a-package.md)'s same-origin argument is why the two
halves share an origin and is untouched by a rule about imports.
[ADR 0027](0027-the-handbook-draws-the-apps-components.md)'s "the app's rendering is the
one that counts" is §1 said from the other end, a year earlier and about pixels rather than
about dependencies. [ADR 0029](0029-the-handbook-keeps-its-own-primitives.md) is the
matching rule for the other direction — the workbench keeps its own primitives and does
not reach into the app for chrome — and is why §1 is not a licence for the workbench to
take whatever it likes. [ADR 0037](0037-the-whole-site-is-the-workbench.md) is what made
the workbench the site rather than a page inside one, and says nothing about which half may
import which.
