# @correctiv/workbench

The published site: this repository's own documentation, an inventory of what the
app reads, the architecture drawn, a reference generated from the core and from the
app's components, and the app itself in a device frame.

It is what answers at the root of
[faktenforum.github.io/correctiv-app](https://faktenforum.github.io/correctiv-app/).
`pages.yml` publishes the app's web export beneath it, at `/app/`.

```
/                    landing
/architecture        ARCHITECTURE.md
/sources             the status board
/sources/measured    SOURCES.md, the record the board is built from
/decisions           the index · /decisions/0022 one record
/diagrams            the core and its host, the records, the core's layers
/reference           every exported symbol in packages/app-core
/components          every component in apps/mobile/src/components, with its props
/preview             the app in a device frame, with the inspector
/traps /conventions /readme /release
```

`/handbook` is the documents area and nothing wider. The package used to be called
that, when documents were all it was; the name stayed with the part it fits
([ADR 0037](../../adr/0037-the-whole-site-is-the-workbench.md)).

Two addresses moved and are still answered: `/workbench`, which the device frame had
until this package took the name, and `/preview.html`, which it had before that
([ADR 0014](../../adr/0014-the-preview-shell-as-a-package.md)). `MOVED` in
`src/router.tsx` sends both to `/preview` with the query and the hash intact. It is a
table and not a stub in `public/`, because a file called `preview.html` is what a host
serves for the clean URL `/preview` — `screens/tools/serve-clean.mjs` and GitHub Pages
both — so the stub that kept the old link alive would now redirect the live route to
itself.

## The rule this package is built around

**It holds no copy of any document.** `plugin/` reads `ARCHITECTURE.md`, `adr/*.md`,
`SOURCES.md` and the rest where they live, parses them at build time, and rewrites
every link: a relative `*.md` becomes a route here, and anything else becomes a link
into the repository **at the commit the page was built from**, so a page describing a
line keeps pointing at that line.

A second copy of `ARCHITECTURE.md` would be the one on the website, and it would be
the one nobody edits.

## Running it

```bash
npm run workbench   # this site at localhost:5173
npm run app         # the app it frames, at localhost:8081
```

Both, if you want the preview. Without the second command the frame is empty and the
status line says the store handle is absent.

The dev server proxies three paths to the app's server, so the browser sees one
origin: `/app` for the app itself, and `/apps` and `/assets` because the app's own
HTML asks for its bundle and its fonts absolutely, from the origin root, whatever base
path it is given. Proxying only `/app` left the bundle request answered by this server
instead, and the frame stayed white while the console said the script came back as
JSON. The `/app` rule is a regular expression rather than the plain prefix, because
Vite matches proxy keys as prefixes and `/app` is a prefix of `/apps`.

Against a static export instead, which is what Pages serves:

```bash
npm run build:web        # the app
npm run build:workbench  # this site
rm -rf site && cp -r apps/workbench/dist site && cp -r apps/mobile/dist site/app
node screens/tools/serve-clean.mjs site 8099
```

## Checking that it renders at all, on both paths

```bash
npm run workbench:renders        # starts the dev server and opens it
npm run workbench:renders:dist   # apps/workbench/dist, after npm run build:workbench
```

Each opens a headless browser and fails if the page did not render, printing whatever
the browser said. Three things have to hold: the shell mounted, what mounted is not
the error boundary standing in for a route that threw, and the browser logged nothing.
They exist because the two paths compile the same source differently and disagreed for
a day without a single check noticing: `npm run build:workbench` was green,
`npm run workbench` served nothing, and a `require()` in one file of `apps/mobile` was
the whole difference ([#160](https://github.com/faktenforum/correctiv-app/issues/160),
and `vite.app.mjs` for what it does about it).
[ADR 0035](../../adr/0035-a-check-that-opens-the-page.md) has the argument and what the
two modes cost, measured.

`renders:dist` reads `dist/` rather than building it, so it refuses to judge one older
than the working tree: run `npm run build:workbench` first, or it tells you to.

Not in `npm run check`, which wants no browser and stays a fast inner loop. CI runs
both in the job that already builds this site, so a blank page cannot reach `main`
again.

## The published app is a development build

`build:web` exports with `--dev`, so the deployed app keeps `__DEV__` true and leaves
its handle on its own global. That is what makes the preview work on the published
site rather than only against a local dev server: with a production export the
Appearance and Inspect tools are inert, each of them says so beside the control it
disables, and the status line names the build.

It costs about a third more JavaScript and the app carries React's development
warnings. The Console tool shows those rather than hiding them, which on a debugging
surface is the right way round.

## Same-origin, and why it is load-bearing

Everything the preview does to the app is a same-origin property access:
`contentWindow`, `matchMedia`, `documentElement.classList`, `localStorage`, and the
handle the app leaves on its own global. Across origins the browser refuses those
reads silently, so the failure is a tool that looks fine and answers nothing.

On Pages the deploy uploads both halves as one artifact, so `/` and `/app/` are the
same origin. In development the proxy above does the same job. Do not give this package a
second origin. [ADR 0014](../../adr/0014-the-preview-shell-as-a-package.md) records the
constraint, [ADR 0024](../../adr/0024-the-handbook-owns-the-root.md) records why the
site meets it this way.

## What is generated

| Command | Produces |
| --- | --- |
| `npm run api -w @correctiv/workbench` | `content/api.generated.json`, extracted with `typedoc --json` |

TypeDoc runs as a data extractor and never as a site generator. No HTML, no theme.
This site's own components render the model. A generated documentation site would
have arrived with its own navigation and its own design, and it would have become the
front door by accident.

Two runs, two halves, kept apart in the model under `core` and `components`. The core
compiles under its own tsconfig and the app under Expo's, with JSX and the `@/*`
aliases, so one run cannot cover both. They stay two sections on the site as well:
the core is a library reached by subpath from `@correctiv/app-core`, and a component
is reached by the `@/components` alias inside `apps/mobile` and from nowhere else.

Not committed. It is derived, it is large, and `npm run build` regenerates it first.

## Drawing the app's components here

`src/components/direct.tsx` imports components out of `apps/mobile` and renders them
in this site's own React tree, beside the same component drawn by the app's bundle in
the frame. `vite.app.mjs` holds what that takes — `vite-plugin-rnw`, `uniwind/vite`,
Metro's `.web.*` extension order — and is shared with the measurement so the two
cannot drift.

```bash
npm run measure-direct -w @correctiv/workbench   # one vite build per component, prints built / failed
```

It is a script and not a test: the number moves when `react-native`, `expo` or
Rolldown move, and a check that reddens for an upstream release gets switched off.
[ADR 0027](../../adr/0027-the-handbook-draws-the-apps-components.md) carries the
result, the recipe, and the dark-mode trap that comes with it.

## The tests, and what they are for

They exist because of a failure that had already happened and that no other
check could see.

| File | Catches |
| --- | --- |
| `test/docs.test.ts` | a document link pointing at a path that has moved, and struck-through claims counted twice or losing the clause that voids them |
| `test/sources.test.ts` | a file added to `packages/app-core/src/data/` with no entry in the manifest, so sample data reaches a screen and not the inventory |
| `test/routes.test.ts` | a page shadowing a document, which removes it from the site with no error |
| `test/styles.test.ts` | a colour value written here instead of taken from `packages/design-tokens`, which forks the palette invisibly, and the entry stylesheet importing the theme without the variants that choose between light and dark |
| `test/toolchain.test.ts` | the repository root hoisting a Vite older than this package's, which makes a plugin configure the wrong bundler and say nothing useful about it |
| `test/renders.test.ts` | the error boundary and `scripts/renders.mjs` losing the one attribute name they share, which turns the browser check green on a page that is nothing but the boundary |
| `test/direct.test.ts` | a drawn component that no longer exists, one reached through a barrel that drags Expo in behind it, a plugin order that leaves every drawing unpainted, and the two ways the appearance setting stops reaching a drawing — no `Uniwind.setTheme` call at all, or one fed from the class Uniwind itself writes |

## Colour

Taken from `packages/design-tokens`, not written here. `src/styles/app.css` imports
`theme.standalone.css`, which is the file the app consumes too, so `bg-canvas` means
one thing in both and a colour has nowhere to fork to. A hand-written copy had three
values wrong within the hour, one of them the brand red, which the dark scheme
lightens to `#ff6173` for contrast on a dark ground.

There is one stylesheet, and its own header says why: `src/styles/app.css`. The site
used to carry five, each drawn as a standalone page and styling `html`, `h1` and
`code` directly, which is correct in a standalone file and reaches every page here.
