# ADR 0037 — The whole site is the workbench, and the device frame is `/preview`

Status: accepted and carried out, 2026-09-16. `apps/handbook` is `apps/workbench`,
`@correctiv/handbook` is `@correctiv/workbench`, and the route `/workbench` is
`/preview`. The ADRs keep the names they were written with; `adr/README.md` says so in
a note.

## Context

A rename is not usually worth a record. This one is, because the argument that decides
it is not "the old name is untidy" but "the old name says the thing is something it
stopped being", and because two of its consequences — what survives as the word
"handbook", and what happens to the address people already hold — are choices somebody
would otherwise have to reconstruct from a diff.

[ADR 0024](0024-the-handbook-owns-the-root.md) built `apps/handbook` to publish the
repository's Markdown, and the name was exactly right on the day: it was documents, and
a device frame was one route at the edge of it. It has not been that for a while.
[ADR 0027](0027-the-handbook-draws-the-apps-components.md) made it compile the app's own
components and draw them. [ADR 0028](0028-one-shell-and-a-route-that-declares-its-context.md)
turned the whole thing into one shell in which the running app is a view like any other,
with an inspector, a console, a token override pass and an element picker.
[#114](https://github.com/faktenforum/correctiv-app/issues/114) gave it a source board
that re-measures itself weekly and opens a pull request with what moved. That is a
development environment with documentation inside it, and "handbook" describes the
documentation.

The word is not wasted, because the documentation is still there and still wants a
name. It has had one since the site was built: every document's breadcrumb reads
"Handbook / …", the rail has an item called Handbook, and `/handbook` is its index.
What changes is only its scope — the part, not the whole.

`/workbench` is a published address. `README.md` lists it as one of four worth going to
directly, `RELEASE.md` hands it out as the thing to send instead of `/app/`, and it is
in links people already have. Moving it is the same kind of break as the three board
anchors in [#151](https://github.com/faktenforum/correctiv-app/issues/151): nothing
fails, nobody is told, and somebody's link dies.

## Decision

### 1. The site is the workbench, and the directory is `apps/workbench`

`apps/handbook` → `apps/workbench`, `@correctiv/handbook` → `@correctiv/workbench`,
`HANDBOOK_BASE` → `WORKBENCH_BASE`, and the four scripts with it: `npm run workbench`,
`build:workbench`, `workbench:renders`, `workbench:renders:dist`. The two storage keys
the site writes on its own origin go with them, `workbench:appearance` and
`workbench:seeded`; the second is spelled in `apps/mobile/src/gallery/Gallery.tsx` as
well and `apps/workbench/test/preview/seed.test.ts` is what holds the two spellings
together, which is why renaming it is safe to do at all.

### 2. The device frame is `/preview`, and "handbook" keeps the documents

`/workbench` → `/preview`, `src/workbench/` → `src/preview/`, the view kind
`'workbench'` → `'preview'`. The code was already half-way there: the frame's own state
is `PreviewState`, its automation handle is `window.preview`, and the classes it injects
are `preview-highlight`, `preview-outline`, `preview-token-override`. The route was the
odd one out, not the new name.

`/handbook`, `pages/Handbook.tsx`, the rail item and the breadcrumb are untouched. A
reader who followed "Handbook / Architecture" before follows it now, and it means what
it always meant.

### 3. Both moved addresses are answered by the site, and by no stub file

`MOVED` in `apps/workbench/src/router.tsx` maps `/workbench` and `/preview.html` to
`/preview`. `main.tsx` applies it with `replaceState` before React renders, carrying the
query string and the hash across untouched — `/workbench#/artikel?d=iphone-15-pro&t=dark`
is what a frame link looks like, and a redirect that kept only the path would resolve to
the right page and the wrong everything else.

**`/preview.html` cannot go on being a file, and this is the measured part.** ADR 0024
kept that address alive with a redirect stub in `public/`. Serve a stub of that name
beside a `/preview` route and the host serves the stub *for the route*: GitHub Pages
resolves `/x` by trying `x.html` before falling through to `404.html`. Measured on the
live site on 2026-09-16, before this change landed:

```
$ curl -s -o /dev/null -w '%{http_code}' https://faktenforum.github.io/correctiv-app/preview
200
$ curl -s https://faktenforum.github.io/correctiv-app/preview | grep '<title>'
    <title>Moved to /workbench</title>
```

The stub, at the clean URL, with a 200. Kept and retargeted at `/preview`, it would have
forwarded the live route to itself for ever — a redirect loop on the one address this
whole change is about, built by keeping a promise. `screens/tools/serve-clean.mjs`
resolves the same way on purpose, so the loop is reproducible locally too.

So the file is deleted and the table answers instead. With no `preview.html` on disk,
both hosts fall through to `404.html`, which is a copy of `index.html`, and the shell
resolves the address client-side. That is how `/decisions/0022` has always worked.
`apps/workbench/test/routes.test.ts` asks three things of it: every target is a route
the site still publishes, no key is one (a live route in this table is the loop arriving
from the other side), and `public/` holds no file named after a target.
`.github/workflows/pages.yml` asserts the absence of `site/preview.html` where it used
to assert its presence.

### 4. The ADRs keep the names they were written with

0024, 0027 and 0029 carry "handbook" in their titles and keep it, and no path inside any
record is rewritten. An ADR is a record and is never rewritten to look right in
hindsight ([AGENTS.md](../AGENTS.md#decisions)). `adr/README.md` gets one note, the same
treatment the `apps/mobile-rn` → `apps/mobile` move has there, with the same warning not
to read it backwards — and here the backwards reading is the dangerous one, because
"the workbench" in an ADR written before today means the device frame, which is
`/preview` now, and not the site that carries the name.

## Why not the alternatives

**Leave the names alone.** Free, and it is what had been decided by default every day
until now. The cost is paid by every new reader: `apps/handbook` is where the app's
components are compiled and drawn, where the device frame lives and where the source
board runs, and a name that says "documents" sends people looking for all of that
somewhere else. The same mistake was made and corrected once already, with
`apps/mobile-rn` ([ADR 0011](0011-naming-the-app-for-release.md)).

**Rename the directory and leave the route.** Half the change and most of the
confusion: `apps/workbench` with `/workbench` meaning one view inside it, so the word
would name the whole and a part at once. The part already had a better name in its own
code.

**Call the documents area something else and keep "handbook" for the site.** It is the
site's own history that makes this wrong. The documents are what the name was coined
for, the breadcrumb has said it since the first commit, and moving a word off the thing
it fits in order to leave it on the thing it does not is a rename that has to be
explained twice.

**Keep `/workbench` as a second live route rather than a redirect.** Two addresses for
one view, for ever, and every link anybody writes from here on would be a coin toss
between them. A redirect is one address plus a promise kept.

**A `<meta http-equiv="refresh">` stub for `/workbench`, the way `/preview.html` was
done.** It is the mechanism that just produced the loop, and it has a second cost the
table does not: a stub is a file at a path, so it can only answer the exact path, and
every future move would add another file to `public/` that nothing in the build relates
to the routes. The table is data, sits beside the router, and has a test over it.

## What it costs

**Every mention outside the package had to move, and most of them are prose.** Measured
on this branch against `main` at `430b37c`: 47 tracked files outside `apps/handbook`
mentioned it and 56 inside did, and 46 files inside meant the route `/workbench`. The
issue's figures (95 and 39) were taken when it was written and several pull requests
have landed since; these are the ones the change was made against. Nothing about the
count is load-bearing — it is here because it is the honest size of the thing, and
because a rename whose cost is unstated reads cheaper than it is.

**Open work on the same files conflicts, and one such change landed mid-flight.**
[#168](https://github.com/faktenforum/correctiv-app/pull/168) merged while this was
being written; it touches `plugin/markdown.ts` and adds `test/decision-numbers.test.ts`,
both of which moved under it, and it brings `adr/decisions.lock.json`, the ledger the
four decisions above live in. Merged in, the test moved with the rest of the package and
`npm run adr:lock` appended this record's four entries. The paths in `scripts/adr.mjs`
and `scripts/adr-ledger.mjs` moved too.

**A reader's stored appearance is forgotten once.** `handbook:appearance` becomes
`workbench:appearance`, so the first visit after the deploy reads no key and falls back
to the device scheme, which is the default anyway. `handbook:seeded` becomes
`workbench:seeded` in the same breath, and both halves of that one are in this commit.

## What this retires

[ADR 0024](0024-the-handbook-owns-the-root.md), its decision line: "**The old address
keeps working.** `/preview.html` is a redirect stub in the handbook that carries its
query string to `/workbench`." **Both halves are false now and the promise is not.** The
stub is gone, because the file name collides with the live route as measured above, and
the address it forwarded to has moved to `/preview`. `/preview.html` still works, and
`MOVED` in `apps/workbench/src/router.tsx` is what makes it. Everything else in 0024 —
one origin assembled at deploy time, the app under `/app/`, the proxy in development,
`404.html` as what makes a deep link resolve — is untouched and is what this change is
built on.

[ADR 0024](0024-the-handbook-owns-the-root.md), in its account of what it retired from
0014: "The shell is a route of `apps/handbook` now, `/workbench`." The directory and the
route have both moved; the sentence's point, that the shell is a route of the site
rather than a package of its own, stands exactly as written.

Nothing else is struck. Every other "handbook" and every other `/workbench` in `adr/` is
a path or an address as it stood when the record was written, which is what a record is
for, and `adr/README.md`'s note is how a reader converts them.
