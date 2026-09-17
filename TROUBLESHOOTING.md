# Troubleshooting

Every entry here is an incident that actually happened in this repo, with what it
looked like and what to do instead. They are grouped by where they bite.

## A green build is not evidence

Defects reached a branch past a green build, typecheck and test run: a webview
that does not exist on web, a dev bundle that died before rendering, a 404 on every
dynamic route, a startup crash from a duplicated React, an empty article list. Each
was found by opening the app in a browser. None by CI.

So after touching a route, a bundle-level config or anything platform-split:

```bash
npm run build:web
node screens/tools/serve-clean.mjs apps/mobile/dist 8099   # NOT python3 -m http.server
```

And a screenshot is only evidence about **the part of the screen it shows.** The
reader's floating back and bookmark controls were `opacity: 0.92` with no border:
invisible against the article's white background, so once the hero image had scrolled
past, the chevron sat inside a word. Every committed shot of that screen is of its
first viewport, where the controls are over the hero and look right. → Scroll before
you judge, and on a route whose content is an `<iframe>` (the reader on web) scroll
**the frame**. Scrolling the page moves nothing and every shot comes out identical,
which reads as "checked" and is not.

A shot can also be of the wrong screen altogether, and look like a defect.
`npm run dev -w @correctiv/workbench -- --port 5180` passes the number to Vite as its
**root directory**, not as its port: the server starts, says nothing, and answers every
address with a bodyless 404. Headless Chrome then saves Chrome's own error page, which
is a picture of a working tool that appears to be broken. Write `--port 5180
--strictPort`, and open the shot before you report anything from it. Nothing in this
repository can tell the two pictures apart; only looking can.

Extracting text is the weak version of this. `uiautomator dump` and
`document.body.innerText` prove the right words are on screen and nothing about how
it looks. Nine further defects hid behind exactly that, among them a video card
grown into a full-screen black rectangle. So after touching layout, **take a
screenshot and look at it**. `screens/tools/tour-android.sh` walks a build on the
emulator, and [`screens/README.md`](screens/) says what makes one of those pictures
evidence.

And it is worse than weak for anything that *changes*: **`uiautomator dump` returns a
stale tree.** A React Native text node that ticks, a player position or a countdown,
keeps reporting its old value until something else invalidates the accessibility tree.
Watching a mini player's `0:00 / 1:37` this way produced three wrong conclusions in a
row: "playback never started", "the app is frozen", "the refactor broke audio". The
audio had been playing the whole time. → To observe a changing value, ask the system
that owns it, not the UI tree. For audio that is
`adb shell dumpsys audio | grep "u/pid:<uid>"`, which reports `state:started` /
`state:stopped` per player. `adb shell dumpsys window`, `pidof` and logcat are the
equivalents for focus, liveness and errors.

**The workbench has two build paths and they do not agree.** `npm run build:workbench`
ran green while `npm run workbench` served an empty `#root` on every route, and the
green one is the only one CI had. The cause was one file compiled twice:
`apps/mobile/src/i18n/polyfills.ts` calls `require()` inside a runtime condition, the
production build hoisted that to a namespace import and printed a warning the file
itself documented as expected, and the dev server hoisted it to a **default** import
of a module that exports nothing — a link-time `SyntaxError`, which kills the whole
graph before a line of it evaluates. It stood for a day, in which two agents built
themselves ways around the blank page instead of reporting it: one served `dist`
statically, the other wrote an entry point importing a single page. Both worked, which
is the part worth noticing. → After anything that touches `vite.app.mjs`,
`vite.config.ts`, or a module `apps/workbench` compiles out of `apps/mobile`, open
both:

```bash
npm run workbench:renders        # starts the dev server, asserts the page rendered
npm run build:workbench && npm run workbench:renders:dist
```

`apps/workbench/scripts/renders.mjs` is what those run, and it is the only check in the
repository that opens a browser. Three things have to hold, and the second is the one
that is not obvious: the shell mounted, what mounted is not the error boundary standing
in for a route that threw — it wraps the main area only, so a broken route still leaves
a header, a rail and a page full of words — and the browser logged no error. The second
command is in that order on purpose: `renders:dist` reads `dist/` and refuses to judge
one older than the working tree. It says in its own header what it cannot see, which is
everything about how the page looks.

## Expo / React Native

- **`react-native-webview` has no web build.** It renders "React Native WebView does
  not support this platform.", and `expo export --platform web` still succeeds, so
  CI goes green on a broken route. → Platform-split behind
  `components/reader/ReaderView`, enforced by `__tests__/web-target.test.ts`.
- **A dynamic route exports as one `[id].html`,** so on a static host without
  rewrites every real URL under it 404s. `/projekt/klima` did, while the build and
  every test stayed green. → Export `generateStaticParams()` from the route; the
  export then pre-renders one file per id. Native never notices, because it has no URLs.
- **Importing `BottomTabBar` from `expo-router/tabs`** to build a custom `tabBar`
  pulls a second React instance into the bundle. The whole app then dies at startup
  with minified React error #321 ("invalid hook call") while build, typecheck and
  tests all stay green. → Don't. Put anything that has to sit above the tab bar in an
  absolutely positioned overlay inside `(tabs)/_layout.tsx`. That is what the mini
  player does. Found only by loading the export in a browser.
- **`react` must match the renderer React Native bakes in *exactly*.** RN 0.85.3
  ships `react-native-renderer@19.2.3` and refuses 19.2.7, while its own peer range
  says `^19.2.3` and accepts it. The app dies on launch on device; web, jest and
  typecheck all pass. → Pin `react`/`react-dom` in the **workspace root**. An
  app-level pin loses to `react-dom`'s own `react ^19.2.7`, and npm 11 silently
  ignores `overrides` here.
- **`disableHierarchicalLookup`** (needed so a hoisted package is not also loaded
  from a local copy) stops Metro from reaching a dependency's *own* nested copy. RN
  declares `pretty-format@^29`, npm hoists v30 for jest, and RN's HMR client then
  reads `prettyFormat.default.default` off `undefined`. The **dev bundle dies at
  startup** and `npm run web` serves a blank page, while `expo export` (no HMR
  client) stays fine. → Resolve that one package from RN's directory in
  `resolver.resolveRequest`. `resolver.alias` does **not** work: standard resolution
  succeeds, so the alias is never consulted.
- **Metro's `getDefaultConfig` assumes a single-project layout,** so in this
  workspace `packages/app-core` is invisible and hoisted deps do not resolve. →
  `watchFolders` + `resolver.nodeModulesPaths` + `disableHierarchicalLookup` in
  `apps/mobile/metro.config.js`.
- **Autolinking gives a package's native module, but only its config plugin edits the
  native projects**, and a plugin has to be listed in `app.json`. `expo-audio` was
  not, so the generated manifest had no `FOREGROUND_SERVICE_MEDIA_PLAYBACK` and no
  media service: background playback and lock-screen controls could not work, with
  everything green. → List every package that has a config plugin in `app.json`
  `plugins`, then **read** the generated `android/app/src/main/AndroidManifest.xml`
  and `ios/*/Info.plist` to check what it actually wrote.
- **`options.title` does not reach the browser tab.** expo-router 57 hands its
  `NavigationContainer` a hard-coded `documentTitle: { enabled: false }`
  (`build/ExpoRoot.js`), so react-navigation's own title bridge is off. Setting the
  option looks right in code and changes nothing anybody can see. → The app writes
  `document.title` itself, in `lib/navigation/documentTitle.web.ts`, which keeps a list
  of the mounted screens naming themselves rather than a saved string, because two
  screens can leave in one commit
  ([ADR 0030](adr/0030-the-platforms-header-and-ours-on-web.md)).
- **`expo-router/head` works here; the provider is already mounted.** This entry used
  to say the opposite, and it was wrong: `expo-router/entry` → `entry-classic.js` →
  `build/qualified-entry.js` renders `<Head.Provider>`, which is `HelmetProvider` in
  `build/head/ExpoHead.js`, the unsuffixed file web resolves. The `data-rh="true"` on
  the empty `<title>` every exported page ships is that provider's own marker. Measured
  on 2026-09-15: a `<Head><title>` in a route did write the browser tab. → **This is
  the path for `<meta property="og:…">` on shared article links**, not a second
  provider. What it will not do is reach the static export, for the reason below, so a
  crawler that does not run JavaScript still sees nothing.
- **The static export contains no screen at all.** The root shell renders `null` until
  the fonts are loaded and the store is hydrated, so `expo export` pre-renders the shell
  and stops: `grep -c "Abriss-Atlas" dist/atlas.html` is 0, and every page ships
  `<title data-rh="true"></title>`. Nothing a route renders — a title, a meta tag, a
  headline — is in the HTML, and the page looks perfect in a browser, because the
  browser runs the bundle. → Judge anything meant for a crawler or an unfurler with
  `curl` or `grep` over `dist/`, never in a browser.
- **Typed routes are generated by `expo start`, not by `expo export`**, and
  `.expo/` is gitignored. A new route therefore fails `tsc` locally until Metro has
  run once, while CI (no `.expo/types`) typechecks every href permissively and cannot
  catch a wrong one at all. → After adding a route, start Metro once before trusting
  the local typecheck; treat a green CI typecheck as no evidence about hrefs.
- **A YouTube embed loaded as a WebView's top-level document sends no referrer,** and
  YouTube answers **Error 153, "Video player configuration error"**. It is a black frame with an
  error line, no exception, nothing in the logs. The same URL fails
  identically in a plain browser tab, so it is not a WebView quirk. → Put the embed
  in an `<iframe>` inside a minimal page and give the WebView
  `source={{ html, baseUrl: 'https://correctiv.org' }}`; the iframe request then
  carries a referrer. The web target never had this, because there the embed always was an
  iframe in a real page.
- **Bottom tabs default to `animation: 'none'`,** so a tab switch replaces the screen
  with no transition at all. On five sibling tabs that reads as a redraw, and it is
  easy to mistake for "React Navigation just looks like this". → Set
  `animation: 'shift'` (or `'fade'`) in the `Tabs` `screenOptions`. The option lives
  on the vendored `expo-router/build/react-navigation/bottom-tabs`, not on a
  `@react-navigation` package. SDK 57 has none installed.
- **expo-image gives a failed thumbnail its own broken-image glyph on a black
  field,** which reads as an app defect. On this project failing thumbnails are
  routine (see the TLS chain entry below). → Wrap remote previews in
  `components/ui/Thumbnail`, which degrades to an empty frame.

## The core's ports

- **A port needs a re-entrancy rule, or the next implementation invents one.** The
  core's audio state machine calls `AudioBackend.pause()` when it stops a track. A
  backend that emitted a status tick from inside `pause()` made the store re-enter its
  own handler, decide the same thing again and call `pause()` again. That is `RangeError:
  Maximum call stack size exceeded`, on a device, a minute into an episode.
  expo-audio does not re-enter, so every test stayed green. Found by playing a bonus
  episode on the emulator and waiting. → Three things, and the order matters: a
  command must never call the status listener synchronously (stated on
  `AudioBackend` in `ports/index.ts`); the store sets state **before** issuing a
  command; and the guard that makes an error state sticky sits **first** in the
  handler, so the error path cannot recurse either. `test/audio-store.test.ts` drives
  the store through a deliberately re-entrant fake. A polite test double would have
  missed this too, and the second recursion was only found because that fake exists.

- **The bundle resolved a package only because npm happened to hoist it.** Metro
  runs with `disableHierarchicalLookup`, so it consults exactly the paths in
  `nodeModulesPaths` and never walks up from a module's own directory. That worked
  for `packages/app-core`'s four parser packages while npm hoisted them to the root,
  and stopped the day the workspace list changed and npm put them back under
  `packages/app-core/node_modules`. The web export then failed on `dom-serializer`,
  a package nobody had touched, in a commit that touched no dependency. → The core's
  `node_modules` is named in `nodeModulesPaths`, and `resolveRequest` retries from
  the requesting file's directory **after** normal resolution fails, which also
  covers a package npm deliberately nested because of a version conflict
  (`react-dom` → `scheduler`). Hoisting is a layout, not a contract.

## The web target

- **A development bundle ignores the base path when it matches routes, and the
  door hides it.** The workbench publishes the app one directory below itself, at
  `/app/`, and `experiments.baseUrl` is what tells Expo Router to strip that
  prefix. A `--dev` bundle applies it to asset URLs and not to route matching, so
  every route under the base falls through to the app's own 404. What makes this
  hard to see is that the door still renders: `_layout.tsx` draws it outside the
  router, so a signed-out visitor sees a working app and a signed-in one sees
  nothing but 404. Measured on 2026-09-05, one URL, one fixture, two builds:

  | build | signed in at `/app/entdecken` | dev handle |
  | --- | --- | --- |
  | `--dev` | the app's own 404 | present |
  | production | Entdecken renders | absent |

  → `build:web` exports production, and `pages.yml` fails the deploy if the
  handle is present, which is the tell for a `--dev` bundle. The published
  preview therefore has no store handle, and it says so on the panels that
  need one. The same limit applies to the dev server, which is a `--dev` bundle
  by definition, ~~so locally the route field reaches the app's first screen and no
  further~~. Driving the app's own router instead of its address bar was tried on
  2026-09-05, by putting `router` on the dev handle: it moved the URL and not
  the rendered tree, for `replace`, `navigate` and a group-qualified path alike,
  ~~so it is not the fix and was not kept~~.

  It is the fix, with a second half the 2026-09-05 attempt did not have.
  Re-measured on 2026-09-10 against both servers: the route field walks the whole
  app, and a reload inside the frame stays in it. `driveRoute` in
  `apps/workbench/src/preview/frame/handle.ts` sends the frame through the app's
  router; `keepFramePath` puts the base back on the address afterwards, because the
  **same fork skips `appendBaseUrl` in development too** — so every navigation, the
  shell's and a tap in the app alike, writes a path on the *workbench's* origin, and
  a reload from there leaves the app entirely. That base-less address stands for at
  most one poll tick: sampled every 50 ms, the base was back within 50 ms of a driven
  route and within 250 ms of a tap. Nothing closes that window from the app side,
  because `router.navigate` only queues an action and the address has not moved yet
  when the call returns. The poll must therefore ignore the route it reads inside the
  window, or it writes the frame straight back to where it came from.

  What still has no way in is a route opened in its own tab: `/app/entdecken` typed
  into the address bar renders the app's own 404 against the dev server, which is
  what the preview's "open in a new tab" button does and what the Build panel now
  says. For that, open the app's own dev server directly at `localhost:8081/` and
  give up the inspector while you do, or serve a static export with
  `screens/tools/serve-clean.mjs`.

  **Any other frame has to do the same, and `about:blank` answers every question
  wrongly on the way.** `/components/<group>/<name>` draws its component in a frame
  (`preview/AppFrame.tsx`), so the mechanism above is shared rather than copied, and
  getting there cost three measurements on 2026-09-10. A frame whose `src` is set by
  script fires `about:blank`'s `load` before the app's, and even on the app's the
  handle can be on the window while the router is not mounted yet: that first
  `navigate` is dropped in silence, and the same call by hand twelve seconds later
  worked. Poll instead of handling `load`. Then take neither reading of the address on
  its own. An empty document reports `readyState` "complete" from the first tick, so
  "complete" alone called a frame that had loaded nothing done and left the app's 404
  standing; and `about:blank`'s *path* is the bare string `blank`, which carries no
  base path, so "the base is gone" alone called a frame that had been nowhere a frame
  the app had taken over. Each needs the other half beside it: the protocol, and the
  address read from `document.URL`. `location` does not lie about the address in the
  meantime, which was worth knowing and is not the trap — sampled every 4 ms through a
  400 ms navigation, by `location.replace` and by `src` alike, `location.href` and
  `document.URL` never disagreed, and a `Location` reflects the active document, so it
  cannot. `document.URL` is asked because it is the reading that survives a browser
  where one ever does. And more than one `navigate` reaches the router before a tick
  can see the first one arrive, so `keepFramePath` has to run for a few ticks rather
  than once, or one frame in three keeps a base-less path.

  **Do not probe the frame to find out which build it is.** The handle appears *after*
  the document is complete: measured with a warm bundle, `readyState` "complete" at
  1,240 ms and `__correctiv` at 1,399 ms. Re-measured the same day the gap was 45 ms,
  which is the point — it is a race, not a duration to wait out. For however long it
  and a cold bundle take, "no handle yet" and "no handle at all" are the same reading,
  so a frame that asks calls the dev server a production export and gives up. Read it
  off this site's own build (`import.meta.env.DEV`): the two halves are one deployment.
- **Serving a static export without clean URLs** makes Expo Router render its
  *unmatched route* page. That looks like an app bug and is a server bug. → Map `/artikel` →
  `artikel.html`. A plain `python3 -m http.server` will not do;
  `screens/tools/serve-clean.mjs` does, and also serves `404.html` on a miss the way
  GitHub Pages does.
- **A default export writes URLs absolute from the domain root** (`/_expo/…`,
  `/assets/…`), and a GitHub Pages *project* site is served from
  `faktenforum.github.io/correctiv-app/`. Every asset then resolves one directory
  too high and 404s: a blank page from a build that exported cleanly, passed every
  assertion in `ci.yml` and looks perfect on `localhost:8099/`. → `experiments.baseUrl`,
  set from `EXPO_BASE_URL` in `apps/mobile/app.config.js` so only the Pages build
  carries the prefix. Verify it the only way that means anything, by building with the
  variable and serving underneath the prefix:
  ```bash
  EXPO_BASE_URL=/correctiv-app npm run build:web
  node screens/tools/serve-clean.mjs apps/mobile/dist 8099 --base=/correctiv-app
  ```
  `pages.yml` greps the built `index.html` for the prefix, because this failure has
  no other symptom before it is public.
- **Two Vites in one tree, and a plugin reading the wrong one.** `apps/workbench`
  builds with Vite 8 and Rolldown. `vitest` has `vite` as a regular dependency,
  range `^5 || ^6 || ^7`, so npm used to hoist **7.3.6** to `node_modules/vite` and
  leave the workbench's 8 in `apps/workbench/node_modules/vite`. A *plugin* resolves
  `vite` from where the plugin is installed, which is the root — so `uniwind/vite`'s
  own `require('vite/package.json')` reported 7 and it configured a Vite 8 build for
  esbuild. Everything still built; it was simply the wrong half of the plugin.
  → The tell is a warning that names a plugin: `` `optimizeDeps.esbuildOptions`
  option was specified by "uniwind" plugin ``. A `resolve.alias` `customResolver`
  deprecation is **not** the tell, because Uniwind emits that on both code paths.
  The check is `npm ls vite` from the repository root, and what it must show is
  8 at the top and vitest's 7 nested under `node_modules/vitest/node_modules/vite`.
  → The fix is `vite` in the **root** `package.json`'s devDependencies, which is
  what makes npm hoist the right one. Not `overrides`: that would force vitest onto
  a major it does not declare. `apps/workbench/test/toolchain.test.ts` fails if the
  root ever hands out a 7 again.
  ([ADR 0027](adr/0027-the-handbook-draws-the-apps-components.md))
- **`react-native-web`'s `Switch` reads a different prop for the ON thumb.** Its
  `thumbColor` covers the OFF state only; ON comes from `activeThumbColor`, whose
  default is Material teal `#009688` (`exports/Switch/index.js`). So every enabled
  toggle showed a green thumb, a colour the palette does not contain, while the
  emulator, where `thumbColor` covers both states, looked correct. → Pass
  `activeThumbColor` as well; `components/profile/SettingRow.tsx` spreads it from a
  `Platform.OS === 'web'` variable, since the prop is not in RN's `SwitchProps`. The
  general shape of this: a prop RN honours and RNW quietly reads differently is
  invisible to typecheck, tests and every native screenshot.
- **`correctiv.org`'s RSS feeds send no `Access-Control-Allow-Origin`,** so a browser
  blocks every RSS request. **The header is a property of the format, not of the
  server**, which took until 2026-09-01 to notice: `wp/v2/posts` reflects whatever
  `Origin` it is given (`localhost:8081`, `localhost:8099`, `faktenforum.github.io`,
  an arbitrary host, even `null`) and answers the `OPTIONS` preflight, while the feeds
  under `/feed/` send nothing. This entry read "no feed is ever live on web" for
  months on the strength of testing one of the two.
  [ADR 0015](adr/0015-reading-correctiv-org-through-its-rest-api.md) moved the app to
  the REST API, so a browser has a live path, and native was never affected because
  there is no CORS there. → The Expo host also bundles a snapshot of every content
  feed (`npm run offline-articles`), which is still the reader's floor with no network
  at all. It says so on screen: "Ohne Verbindung. Sie sehen gespeicherte Artikel."
  - **The demo's articles are as old as the last generator run only when the network
    path fails.** Re-running it before a demo is still worth doing, because it is what
    an offline reader sees.
  - **The one header a browser will not let you set is the one this repo sets.**
    `http.ts` sends a browser `User-Agent` to get past WordPress's bot challenge. A
    page cannot override that header, and were a browser to honour the attempt it
    would promote a simple request to a preflighted one — which correctiv.org
    rejects, because its `Access-Control-Allow-Headers` lists only `Authorization,
    X-WP-Nonce, Content-Disposition, Content-MD5, Content-Type`. → `fetchJson` sends
    no user agent (`browserAgent: false`), measured unnecessary: all four JSON
    endpoints answer 200 without it. Only the HTML and RSS paths keep it. Nothing
    about this is visible in a test, on a device, or in a green export.
  - Article images survive an offline start because an `<img>` is not subject to CORS
    and the bundled articles carry their real cover URLs. A live list gets its images
    from `cvui_featured_image` in the same response, in four sizes.
  - **CORS is per host, and the browser is the only place you see the whole set.**
    Measured from `localhost:8099` on 2026-09-01 with the export loaded:

    | Host | header | what the app does |
    | --- | --- | --- |
    | `correctiv.org/wp-json` | reflects the origin | articles and Spotlight are live |
    | `tube.funfacts.de` | `*` | FunFacts videos and HLS are live |
    | `correctiv.org/…/feed/` | none | the RSS fallback cannot run in a browser |
    | `salon5.correctiv.net` | none | all seven podcast feeds fail, the bundle answers |
    | `icecast.correctiv.net` | none | the station status fails, the banner keeps its subtitle |
    | `youtube.com/feeds` | none | "Videos derzeit nicht erreichbar." |

    Each degrades as built, so nothing here is a defect — but half the media on the
    web target is a fallback, and two of those hosts are CORRECTIV's own.

- **A field the list does not carry costs a request per card, and the browser is
  where you find out.** `ArticleHero` called `useArticleMeta`, which fetched the whole
  article page (about 115 KB) for one number, the reading time, because `FeedItem` had
  no field for it. The doc comment said so and was true when written. After the move
  to the REST API the response carried the reading time and `toFeedItem` threw it
  away, so the fetch stayed — and on the web target it is blocked by CORS, meaning the
  lead item silently lost its reading time and logged an error. Every test stayed
  green, because no test renders Home against a network. → Found by opening the export
  and reading the network panel: four requests succeeded and one failed. Whenever a
  card fetches something per item, ask what field would remove the fetch.
- **A cache written by the previous build makes the new one look unchanged.** After
  fixing the above, the same page still made the failing request: the feed cache from
  the earlier visit held items without the new field, and the guard reads the item.
  Fifteen minutes of TTL is enough to make a fix look like it did not work. → Clear
  site data between builds when checking a change to a cached shape, or the thing you
  are looking at is the previous build's data.

## Android builds and the emulator

- **Gradle's JS bundle task does not treat `node_modules` as an input,** so after a
  dependency change it reuses the previous bundle and the APK ships stale JS, so the
  same crash keeps appearing after the fix. → Delete
  `android/app/build/generated/assets/react` (and `intermediates/assets`) before
  rebuilding.
- **A debuggable build on an emulator does not go through `adb reverse`.** React
  Native asks `AndroidInfoHelpers` for the dev server, and on an emulator that is
  `10.0.2.2:8081` — the host, directly — so `adb reverse tcp:8081 tcp:8090` redirects
  nothing. With a second checkout's Metro already holding 8081, the app keeps loading
  *that* checkout while your own Metro logs nothing, and a tour then photographs
  somebody else's branch under your branch's name. It looks exactly like a change
  that had no effect. → Point the app at your own server instead of the port:
  force-stop it, then
  `adb shell run-as org.correctiv.app cp /data/local/tmp/prefs.xml shared_prefs/org.correctiv.app_preferences.xml`
  with a `<string name="debug_http_host">10.0.2.2:8090</string>` in it, and delete
  that file when you are done or the next person's emulator points at a server that
  has gone. **Your Metro printing `Android Bundled … apps/mobile/index.js` is the
  proof**, and it is the only one: the app on screen looks the same either way.
- **On Fedora the AVD dies with SIGSEGV before boot.** SwiftShader JITs shaders onto
  the heap and SELinux denies `execheap` (`AVC denied { execheap }
  comm="RenderThread"`). `-gpu off` does not help, because that only affects the *guest*
  GPU; the emulator loads SwiftShader for its own display regardless. → Start it
  **with a window**: real Mesa renders, SwiftShader is never loaded, boots in ten
  seconds. Headless would need `setsebool -P selinuxuser_execheap 1`, i.e. relaxing
  a hardening default.

## Design tokens and styling

- **The spacing scale is the design system's, not Tailwind's,** and it steps 2 px
  per unit (`--spacing: 0.125rem` in `packages/design-tokens/theme.css`, against
  Uniwind's rem base of 16). Every numeric
  utility therefore means something else than it says. `w-10` is 20 px and `w-32` is
  64 px. Under NativeWind the scale also stopped at 48 and anything above it was
  dropped in silence, so the element sized to its content. `w-64` on a rail card turned into a full-screen black
  rectangle, because `aspectRatio` scaled the height off the title's width. Build,
  typecheck and 120 tests stayed green. → Named tokens for spacing (`p-s`, `gap-m`),
  pixel sizes from `src/lib/theme/sizes.ts`, and
  `__tests__/no-numeric-utilities.test.ts` fails on any numeric size or spacing class.
  Found by putting emulator screenshots next to the intended layout, see
  [`screens/`](screens/).
- **A token bridge that searches *upwards* for its source can find a foreign
  checkout**. Here one at `17b87c8` while the repo's own copy was `501ee10`, so a
  developer and CI generated from different sources and called it agreement. →
  Tokens are vendored into [`tokens/`](tokens/README.md) and resolved to exactly one
  path by `scripts/tokens-source.mjs`; the drift check is unconditional.
- **Counting `../` levels to reach a shared file breaks on the next move.** A
  hard-coded depth silently broke the token bridge when the app moved into `apps/*`.
  → Resolve via a marker (root `package.json` name + `workspaces`), not by depth.
- **A colour read in TypeScript does not follow the appearance setting.** Classes go
  through CSS variables that the active theme redefines, so `bg-grey-100` switches on
  its own; `colors['grey-700']` handed to an `<Ionicons color>` is a string that was
  resolved once, at import. Nothing warns, and the icon is simply invisible in the
  other scheme. → `useColors()` from `lib/theme` for anything read in TS. Importing
  `colors` is still correct for `always-light` / `always-dark`, which are the same in
  both schemes by construction.
- **The grey scale is not semantic, so a dark palette cannot be an inversion.**
  `grey-100` is the page surface *and* white text on the brand red; `grey-700` is
  body text *and* the video stage. Assign dark values by shade and half of those uses
  break: a white video stage, invisible text on the coral button. → Each grey takes
  the dark value of its majority role, and the minority uses move to `always-light` /
  `always-dark`. ~~`packages/design-tokens/palette.js` records which is which;~~
  `__tests__/tokens.test.ts` fails if the role colours ever start switching.

  > The struck clause is voided by
  > [ADR 0022](adr/0022-three-tiers-of-colour-and-a-dark-scheme-that-names-roles.md):
  > upstream's semantic tier answers this now, so `palette.js` no longer carries the
  > grey-by-grey record. The trap above is exactly why that tier is worth adopting —
  > the page surface is `canvas` and the white on the red is the primitive `white`,
  > and those can move independently. Reach for a semantic token and the mistake is
  > not available.
- **The appearance setting and the styles can disagree about which scheme is
  active, and nothing warns.** Under NativeWind this was a shipped bug: with
  `darkMode: 'class'`, `setColorScheme('system')` left the JavaScript side following
  the device while the CSS waited for a `dark` class nothing added, so `useColors()`
  returned the dark palette while `bg-grey-100` kept its light value: near-white text
  on a white page, on the *default* setting. Typecheck, lint, 145 tests, the Android
  build and the web export were all green, and a browser walk missed it too: it
  flipped the setting to `'dark'` explicitly and emulated `prefers-color-scheme:
  light`, exercising both paths that work and neither that breaks. → Uniwind closes
  that gap by construction. `setTheme` takes `'system'` and resolves it itself, and
  it emits both the class and the `prefers-color-scheme` path, so
  `lib/theme/appearance.ts` now passes the setting through VERBATIM and resolving it
  by hand would be the new bug. **Check a colour change in all three settings, and
  check `'system'` against both device schemes**. That is four combinations, and only
  the fourth was broken.
- **A framed app cannot see the appearance of the page around it, and the class on
  `<html>` does not cross.** The site and the app share an origin here, so nearly
  everything crosses (ADR 0014), and this is the exception: the scheme travels as a
  class on the *document's* root element, and the framed app has a root element of its
  own. Both sides default to `'system'`, so they agree until a reader picks light or
  dark on one of them — and then the reference drew a black phone on a white page,
  which is the app's own default against a dark device and the combination this file
  already calls the one that ships broken. There is no handle to dispatch through in
  the published export, and seeding `settings` would clobber whatever the reader had
  stored. → **`color-scheme` on the embedding element**, which is what
  `prefers-color-scheme` resolves to inside the embedded document. Measured on
  2026-09-10: setting that one property on the `<iframe>` moved the framed app's own
  `light` / `dark` class within a tick, no reload, no handle, so it works in the export
  too. `preview/AppFrame.tsx` carries it as `scheme-light dark:scheme-dark`, which
  puts the site's own three states behind it. The app stays the authority when its
  setting is explicit, because Uniwind then writes the class from the setting and never
  consults the query.

  **Do not check this with `Emulation.setEmulatedMedia`.** It forces the feature in
  every frame of the page, so `prefers-color-scheme` inside the frame answers the
  emulator rather than the embedding element, and the propagation looks inert.
  Measured both ways on 2026-09-10: emulated, a light site framed a dark app and the
  class appeared to do nothing; with the machine's own scheme left alone and only the
  site switched, the framed app followed the site in all three of its settings. Set the
  site's appearance and use the real device scheme.
- **Persisting a setting from the effect that applies it is a delete on every page
  that opens.** The workbench's `useAppearance` wrote the reader's choice to
  `localStorage` in the same effect that stamps the class, so the write ran on mount
  as well as on a change — and because "system" is the key being *absent*, a document
  that had read "system" wrote it by calling `removeItem` on somebody else's choice.
  One document would be harmless; this site runs more than one on the origin, because
  `preview/AppFrame.tsx` frames `<base>/app<route>` and a static host answers every
  path the app's export does not contain with the site's own `404.html`, which is a
  second copy of the site. Issue #131: the setting came back on the device scheme and
  the key was gone, with nothing in the bundle that names the key except the site's own
  hook. Typecheck, lint and 137 workbench tests were green throughout, and so was every
  single-tab browser walk. → **A read is not a fact about what the reader wants**, only
  about what the store said when that document started, so only a click may write.
  `theme.ts` keeps one writer, `rememberAppearance`, reached from the setter alone, and
  `test/theme.test.ts` fails if a write finds its way back into the effect.
- **`userInterfaceStyle` in `app.json` is a promise to the OS, and on iOS it is
  binding.** It was `"light"`, which `expo prebuild` writes into
  `ios/<name>/Info.plist` as `UIUserInterfaceStyle = Light`. iOS then reports light
  to the app whatever the device is set to, so the appearance setting on `'system'`
  could never resolve to dark and the hand-written dark palette was unreachable on
  that platform. Android is not affected: prebuild leaves `AppTheme` on
  `Theme.AppCompat.DayNight`, which is why an emulator check finds nothing. → It is
  `"automatic"` now. When changing it, read the generated `Info.plist` rather than
  trusting the prebuild log, and remember that the Android project regenerates
  byte-identically either way, so an Android screenshot is not evidence about this.

- **`t=dark` in a preview URL does nothing on a static export, and says nothing while
  it does nothing.** `expo export` sets `__DEV__` false, so the export carries no dev
  handle: `/preview`'s appearance panel disables itself, and the shell accepts
  `t=dark` in the hash and ignores it. A screenshot round driven that way produces
  "dark" images that are all light. → Drive the scheme from the browser instead —
  `emulateMedia({colorScheme:'dark'})`, or DevTools — with the app's own setting left
  on `system`. That is combination 4 above, which is the app's default anyway. The
  tell, if it has already happened: every dark diff count equals its light one
  exactly.

- **The design tokens ship no dark values.** ~~`tokens/theme.css` carries a
  `@media (prefers-color-scheme: dark)` section marked `@TODO Set this to the actual
  values`, holding the *light* values.~~ Generating from it would produce a dark mode
  that compiles, ships and changes nothing on screen. → The palette is hand-written in
  `packages/design-tokens/palette.js` until upstream fills that block in; a test
  asserts the two schemes actually differ.

  > Struck by
  > [ADR 0022](adr/0022-three-tiers-of-colour-and-a-dark-scheme-that-names-roles.md):
  > wp-design-tokens `8ed7a28` deleted that block down to a bare `@TODO`, so the
  > light-values-as-dark hazard is gone from the source. Everything after the arrow
  > still holds, and the generator still refuses to read the dark block — see the note
  > on `firstRootBlock()` for why that restriction outlives the placeholder.

## Data sources

- **WordPress feeds: only `/category/<slug>/feed/` URLs deliver article streams.**
  `correctiv.org/faktencheck/feed/` returns the landing page as a single item. → See
  `packages/app-core/src/data/feeds.config.ts`; a test guards the one feed that is
  legitimately empty upstream.
- **Icecast answers HEAD requests with 400,** so availability cannot be probed. →
  Availability means: try to play.
  - **True of the stream, and it was read as true of the server.** The server's own
    status document is a public GET: `icecast.correctiv.net/status-json.xsl` lists
    every mount with its bitrate, current and peak listeners, and the title on air.
    `services/radio.service.ts` reads it, and the Mediathek banner prints what is
    playing instead of a fixed subtitle. Whether the *stream* will play is still only
    answerable by playing it. Added 2026-09-01,
    [ADR 0015](adr/0015-reading-correctiv-org-through-its-rest-api.md).
  - Two things that document revealed. `source` is an **array** with several mounts
    and a bare **object** with one, so a reader that assumes either breaks when the
    other happens. And `title` joins artist and track with " - " and keeps the
    separator when the artist is empty, so the real value arrives as
    " - Salon5 Mitschnitt 2024 04 05, 17 Uhr 02".
- **Ops, and it affects real clients:** `icecast.correctiv.net`,
  `salon5.correctiv.net` and `tube.funfacts.de` serve Let's Encrypt's new **YR**
  chain (ISRG Root YR, cross-signed May 2026). Clients with an older trust store fail
  the TLS handshake, so radio and podcasts are unreachable while `correctiv.org`
  (Sectigo) works. Measured on an Android 16 emulator image, 2026-08-05. → Not an app
  defect. Let's Encrypt can serve the alternate chain terminating at ISRG Root X1.

