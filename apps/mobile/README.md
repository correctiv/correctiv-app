# @correctiv/mobile

The CORRECTIV app on Expo and React Native: **iOS, Android and a web target**
([ADR 0004](../../adr/0004-react-native-pivot.md),
[ADR 0005](../../adr/0005-react-native-over-nativescript.md)). Its behaviour comes
from [`@correctiv/app-core`](../../packages/app-core). What lives here is the view
layer plus one adapter ([ADR 0006](../../adr/0006-one-core-two-hosts.md)).

## Stack

- **Expo SDK 57** (React Native 0.86, New Architecture), TypeScript,
  **expo-router** (tabs and stack), **Uniwind** (Tailwind v4 for React Native)
- **react-redux** binds the core's Redux store. **react-native-mmkv** (on
  **react-native-nitro-modules**) backs the core's two storage ports, in two separate
  instances so the bounded cache cannot evict what the reader chose; unchanged on
  web, where MMKV's own build is localStorage
- **expo-audio** behind the core's `AudioBackend` port. Not react-native-track-player:
  it needs a Kotlin patch to compile under RN 0.85 and then crashes at runtime under
  the New Architecture, and RN 0.85 offers no old-architecture option. expo-audio
  brings background playback, lock-screen controls and a web implementation.
- **react-native-webview** for the article reader, an **iframe** on web. Both sit
  behind `components/reader/ReaderView`, guarded by `__tests__/web-target.test.ts`.
- **htmlparser2, css-select, domutils**, because this app uses the core's DOM
  extraction backend, registered in `app/_layout.tsx`

## Development

`npm install` runs at the **repo root** (npm workspace), not here.

```bash
npm run web            # browser with Fast Refresh, no emulator, no Android SDK
npm run android        # build a dev build and install it (once)
npm start              # then: Metro with Fast Refresh (dev client, NOT Expo Go)
npm run build:web      # static export to dist/
```

Expo Go does **not** work, because of the native modules. Always a dev build or a
release APK.

iOS builds via EAS in the cloud, so no Mac is needed. `ios/` does not exist yet and
is produced by `expo prebuild`.

### The static export

`dist/` is what gets published to <https://faktenforum.github.io/correctiv-app/> on
every push to `main` (`.github/workflows/pages.yml`). Serve it with the repo's own
server, never a plain one.

```bash
node ../../screens/tools/serve-clean.mjs dist 8099
```

It maps clean URLs (`/artikel`, not `/artikel.html`) and serves `404.html` on a miss,
both of which GitHub Pages does. Without that, Expo Router matches nothing and shows
its unmatched-route page, which looks like an app bug and is the server.

To reproduce the published site exactly, add the base path. `app.config.js` turns
`EXPO_BASE_URL` into `experiments.baseUrl`. Without it every asset URL is absolute
from the domain root, which is correct locally and blank on a project Pages site.

```bash
EXPO_BASE_URL=/correctiv-app npm run build:web
node ../../screens/tools/serve-clean.mjs dist 8099 --base=/correctiv-app
```

See [TROUBLESHOOTING.md](../../TROUBLESHOOTING.md#the-web-target).

### Release APK (demo device)

```bash
cd android && ./gradlew assembleRelease                          # all ABIs
./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a   # a real device
adb install -r app/build/outputs/apk/release/app-release.apk
```

Self-contained, with the JS bundled and no Metro. Gradle signs it with a per-machine
debug key, which is fine locally. The release workflow re-signs with a stable key so
testers can update in place. See [`signing/README.md`](signing/README.md) and
[RELEASE.md](../../RELEASE.md).

## Layout

`src/app/` is the expo-router route tree, `src/components/ui/` the design system, and
the other `src/components/` folders are one per area: feed, home, discover, media,
player, participate, profile. `reader/` and `media/` are the two platform splits,
each a `.tsx`, a `.web.tsx` and a shared props type.

`src/lib/` is the wiring. `platform/expo.ts` implements the core's ports, `audio/`
puts expo-audio behind the `AudioBackend` port, `feeds/` puts React hooks over the
core's feed store, `store/core.ts` binds the core's Redux store, `theme/` re-exports
the tokens with `useColors()`, typography, fonts and sizes, and `articles/` holds the
reader CSS wiring and the in-app URL rules.

`app.config.js` is `app.json` plus the one value that cannot be static, the Pages
base path from `EXPO_BASE_URL`.

## Colour and dark mode

How the two schemes work is in
[ARCHITECTURE.md](../../ARCHITECTURE.md#colour-and-the-two-schemes). One rule is
this app's own:

`lib/theme/appearance.ts` passes the setting to Uniwind **verbatim**, `'system'`
included. Resolving it here would pin the app to whatever the device said at mount.
Under NativeWind the rule was the exact opposite, and getting it wrong shipped.
`__tests__/appearance.test.tsx` carries the story.

## Generated, never hand-edited

| Command | Produces |
| --- | --- |
| `npm run tokens` (repo root) | nothing here. All the artefacts belong to [`@correctiv/design-tokens`](../../packages/design-tokens/README.md) |
| `npm run fonts` | `src/lib/theme/readerFonts.generated.ts`, base64-subsetted reader fonts (needs `pyftsubset`) |
| `npm run offline-articles` | `src/lib/articles/offlineBundle.generated.ts`, a snapshot of every content feed plus pre-extracted articles, and `offlineCovers.generated.ts`, their covers inlined as data URIs (needs ImageMagick). On web the snapshots are the floor rather than the ceiling since [ADR 0015](../../adr/0015-reading-correctiv-org-through-its-rest-api.md): the REST API sends a CORS header, the RSS feeds do not |
| `npm run offline-podcasts` | `src/lib/podcasts/offlineBundle.generated.ts`, the curated Salon5 shows. Without it the Mediathek falls back to the core's sample seed, which is what a browser always gets otherwise, because Castopod still sends no CORS header |

## Checks

```bash
npm test           # jest: token snapshot, cascades, guards
npm run typecheck  # tsc (app) + tsc (tests)
```

Lint and format run from the **repo root** with oxlint and oxfmt (`npm run check`
covers every workspace). Two guards are worth knowing about.
`__tests__/web-target.test.ts` fails if anything web-incompatible lands outside a
`.web.tsx` split. `__tests__/no-numeric-utilities.test.ts` fails on any numeric size
or spacing class, because the scale is the design system's and steps 2 px, so `w-32`
does not mean 32 px. See TROUBLESHOOTING.md.

## Status

Every tab is real, with no stubs: onboarding, home, reader, discover and search,
media (live radio, seven Castopod series, PeerTube HLS, YouTube embeds, mini and full
player, with club bonus content playing in full for everyone), participate (three
CrowdNewsroom callouts with a multi-step form, Faktenforum, Abriss-Atlas), and club
and profile (contribution, Backstage, quarterly report,
saved articles, settings).

Verified in the browser: home with full content and all five tabs, the reader with a
real article in an iframe, discover with all 17 entries, every project page under its
own URL, media with real FunFacts videos, and the participate flow into step 1 of the
form. Playback itself is verified on a device, not in the browser.

Sharing an article uses the system share sheet natively and the Web Share API in a
browser, falling back to the clipboard where that is missing.
