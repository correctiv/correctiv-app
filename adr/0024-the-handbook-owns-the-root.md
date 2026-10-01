# ADR 0024 — The handbook owns the site root, and the app moves under it

Status: accepted, 2026-09-04.

## Context

The repository's documentation is the part of it that no code review would produce.
`SOURCES.md` carries figures ~~measured by hand against live sources~~ — measured by a
weekly job since #114, which opens a pull request with what moved — and ten editorial
questions nobody has answered. `adr/` carries a chain of records and, more usefully,
a chain of which claims each later one made false. None of it is reachable without a
clone, and the people who most need the source inventory are the ones least likely to
have one.

GitHub Pages already publishes the app's web export, at the site root.
`pages.yml` has always said in its own comments that the root is the wrong place to
send anyone, because the app has no desktop layout and a full browser window is the
wrong shape to judge it in. The address handed out is `/preview.html`, the device
frame from [ADR 0014](0014-the-preview-shell-as-a-package.md). So the root has been
an address nobody wanted for as long as the site has existed.

[ADR 0014](0014-the-preview-shell-as-a-package.md) built that frame into
`apps/mobile/public/`, and its reason is worth restating because it is correct.
Everything the shell does to the app is a same-origin property access, and across
origins the browser refuses the property, silently. Building into the
app's `public/` folder puts the shell on the app's origin at the dev server, at
`serve-clean.mjs` and on Pages, all three, with one setting.

The trouble is that the conclusion is narrower than the argument. `public/` is *one*
way to be same-origin, and it is the one way that also forces the shell to live
wherever the app's export lives. A site root the app does not occupy is impossible
under it.

## 1. Decision

**The handbook is the site. The app is a directory inside it.**

`apps/handbook` is a new host, a Vite and React application. It reads the
repository's own Markdown at build time and publishes it, together with the source
inventory, the diagrams, a reference generated from the core, and the app itself in
its frame. `pages.yml` builds both and uploads them as one artifact, the handbook at
`/` and the app's export at `/app/`.

**Same-origin is kept by assembling one origin, not by sharing one folder.** Both
halves are in one Pages artifact, so `/` and `/app/` are the same origin and nothing
the inspector does changes. In development the handbook's Vite server proxies `/app`
to the app's dev server on port 8081, with `ws: true` so the app's own reload socket
survives, and the browser again sees one origin. Against a static export, the
assembled tree is served whole.

~~**The old address keeps working.** `/preview.html` is a redirect stub in the handbook
that carries its query string to `/workbench`, because that address is in `RELEASE.md`
and in links people already have.~~ The promise is kept and the mechanism is not: the
stub is gone and both `/preview.html` and `/workbench` are answered by a table in the
site's own router, because a file called `preview.html` is what GitHub Pages serves for
the clean URL `/preview`, which the frame now lives at
([ADR 0037](0037-the-whole-site-is-the-workbench.md), measured).

## Why not the alternatives

**Leave the app at the root and put the handbook under `/docs/`.** Cheapest, no
workflow surgery, no moved addresses. It also fails the thing it was for. The root
stays an ungated web export that the workflow's own comments call the wrong shape,
and the introduction sits somewhere you have to already know about.

**Build the handbook into `apps/mobile/public/` too, the way the preview shell is.**
This was the first plan and it cannot work: what is in `public/` is copied to wherever
the export is served, so a handbook built that way lands at `/app/` with the app, and
the root is exactly as unreachable as before.

**A documentation generator, Docusaurus or VitePress.** Less work for the prose. But
the site is not only prose: it carries a filterable inventory, four hand-drawn
diagrams, a symbol reference and a live device frame with an inspector, all of which
are an application. And it would put a second toolchain, webpack with its own MDX and
its own React, into a repository that refuses eslint and prettier and whose
[ADR 0002](0002-vite-8-rolldown-evaluation.md) is about declining a bundler change
that quietly broke something.

**TypeDoc as a site.** The core's doc comments are prose and carry arguments, so a
reference has value here. A generated site would have arrived with its own navigation
and its own design and become the front door by accident, and a TypeDoc theme is more
work than the reference is worth. `typedoc --json` extracts the model, the handbook
renders it, and there is no theme to maintain.

## What it costs

The app's export moves to a two-level base path. `experiments.baseUrl` takes any
depth and `apps/mobile/app.config.js` reads one environment variable, so this is one
line, and it was built and checked before the decision was made rather than after: 70
routes, correct asset prefixes, no unsupported-platform stubs.

`frame/handle.ts` derives the app's path from the shell's own directory, which is
correct only while the two sit together. That becomes an explicit `/app` when the
shell moves into the handbook.

The handbook is a single-page application on a host that cannot rewrite, so it ships
`404.html` as a copy of `index.html`. That is what makes `/decisions/0022` resolve.

## What this retires

[ADR 0014](0014-the-preview-shell-as-a-package.md), its decision: "It builds into
`apps/mobile/public/`" as the *requirement* for reaching the frame. **Narrowed by
this ADR.** Same-origin is still the requirement and 0014's argument for it is
untouched and is the reason this one is written carefully. What is no longer true is
that the app's `public/` folder is the only way to satisfy it: one artifact at deploy
time and a dev-server proxy are a second way, and the shell no longer has to live
where the app's export lives.

0014's second claim, that giving the package a dev server of its own loses every
capability "silently, because the browser simply refuses the property access", stands
exactly as written. It is why the proxy exists rather than a second port.

[ADR 0014](0014-the-preview-shell-as-a-package.md), its decision line: "A workspace
package, `tools/preview`". **Struck in place**, because the package is gone. ~~The shell
is a route of `apps/handbook` now, `/workbench`.~~ Both names have moved,
`apps/workbench` and `/preview` ([ADR 0037](0037-the-whole-site-is-the-workbench.md));
that it is a route of the site rather than a package of its own is unchanged. Its
reasoning for not being a host, that `apps/*` means a host of the core and a dev tool
is not one, is why it sat in `tools/` and is worth reading; the handbook is a genuine
second thing with screens, which is the difference.

0014's "What it costs" section named three costs that the move removed: the build
step before the app runs (`npm run preview`), the generated output in the app's tree,
and the `pages.yml` assertion about a shell inside the export. **All three struck in
place.** None of them exists any more, and a reader planning work around them would be
planning around nothing. Its "Same-origin is the constraint" opening, which said one
build answers at `localhost:8081/preview.html`, is struck for the same reason; the
constraint it argues for is untouched and is why this ADR exists.

Nothing else in 0014 is affected. The device frame and what it can and cannot
simulate are unchanged, and its note that the published export carries no dev handle
is true again: publishing a development bundle was tried and measured, and
`TROUBLESHOOTING.md`, "The web target", records why it cannot be.

`README.md` and `RELEASE.md` name `/preview.html` as the address for the demo. Those
are living documents and are rewritten rather than struck; the stub keeps the old
links working either way.
