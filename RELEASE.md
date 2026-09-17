# Release & CI

GitHub Actions workflows live in `.github/workflows/`:

| Workflow | File | Trigger | What it does |
| --- | --- | --- | --- |
| **CI** | `ci.yml` | every PR, push to `main` | Checks and the web export, always. An Android release APK as a compile check, only when the change could reach it: the first job reads the changed files, and a change confined to the workbench, `tools/`, the ADRs, the screenshots or a root `.md` skips a quarter of an hour. No secrets needed. |
| **Pages** | `pages.yml` | push to `main` (or manual) | Builds the workbench and the Expo web export, assembles them into one artifact, and publishes it to <https://faktenforum.github.io/correctiv-app/>. The workbench is the root; the app is at `/app/`. No secrets needed. |
| **Release Android** | `release-android.yml` | push of a `v*` tag (or manual) | Builds the APK and signs it, with your upload key when the secrets are set and otherwise with the bundled **test key**. Attaches it to the GitHub Release. |

## The web preview

**The published web export is a production bundle, and has to be.** It was a
development one for a while, to keep the app's dev handle on the published site so
the preview's appearance control and inspector would work there. That trade was
not the one it looked like: a `--dev` bundle applies `experiments.baseUrl` to asset
URLs and not to route matching, and the app is published under `/app/`, so every
route past the door rendered the app's own 404 while the door itself went on looking
fine. `pages.yml` now fails the deploy if the bundle carries the handle, because that
is the tell. The published preview has no store handle and says so on the panels
that need one; see TROUBLESHOOTING.md, "The web target".

A web version of the app at <https://faktenforum.github.io/correctiv-app/preview>,
for clicking through without an install. Every push to `main` republishes it; there is
nothing to tag and nothing to commit. Three things are worth knowing before pointing
anyone at the URL:

- **Hand out the site root, or `/preview`, not `/app/`.** The app is built for a
  phone and has no desktop layout, so the site's root shows it stretched across the
  whole browser window; `/preview` frames it at a phone or tablet size instead, and
  the root introduces both. The two older addresses, `/workbench` and `/preview.html`,
  are answered by the site itself: it replaces them with `/preview` and keeps the query
  string and the hash, so every link already handed out still works
  ([ADR 0037](adr/0037-the-whole-site-is-the-workbench.md)).
  The root stays reachable, nothing hides it, so the framed link is the one to
  send.
- **Its articles are live**, since [ADR 0015](adr/0015-reading-correctiv-org-through-its-rest-api.md).
  This bullet used to say they were as old as the last `npm run offline-articles`,
  because a browser cannot reach an RSS feed for want of a CORS header. The app reads
  the REST API now, which sends one. The bundled snapshot is still there and still
  worth refreshing before a demo, because it is what the page falls back to when a
  request fails, and it is what an offline reader sees.
- **It opens on the door.** Since
  [ADR 0016](adr/0016-a-door-at-the-root-and-an-entitlement-not-an-amount.md) the app
  is for members whose membership includes it, and the published copy starts signed
  out. Sign-in is simulated and the screen prints the rules: any address gets in, one
  containing "frei" shows the upgrade state. `/preview#/?s=signed-in` skips the
  form, `s=onboarded` lands on Home.
- **The site is a project site**, served from `/correctiv-app/`, so the export needs
  `EXPO_BASE_URL` to prefix its asset URLs. `pages.yml` takes that value from
  `actions/configure-pages` and asserts it reached the built HTML. The failure is
  otherwise invisible until the site is live and blank.

Pages was previously served straight off `main:/docs`. Pointing it at this workflow
instead is a **repository setting**, made once and not by the workflow itself.
`actions/configure-pages` reads an existing site but never changes its build type:

```bash
gh api -X POST repos/faktenforum/correctiv-app/pages -f build_type=workflow
# or: Settings → Pages → Build and deployment → Source: GitHub Actions
```

Until that is done, the deploy step fails with *"Not configured to use GitHub
Actions"*. The build and every assertion above it still run, so the failure is
loud and specific rather than a silently stale site.

## Cutting a release

```bash
git tag v1.2.3
git push origin v1.2.3
```

This creates a GitHub Release for the tag with auto-generated notes and attaches
`correctiv-app-v1.2.3.apk`.

The tag also drives the app version: `vX.Y.Z` becomes `versionName X.Y.Z`, and the
workflow run number becomes the `versionCode` (Play requires it to increase on every
upload). `apps/mobile/app.json` is patched only inside CI. The change is not
committed.

That is also why a release builds the app again from nothing rather than picking up
the APK `ci.yml` already built for the same commit: both numbers are compiled into
the artifact, and the tag does not exist yet when CI runs. The release build is also
the wider one, all four ABIs against CI's two, so the two are not the same APK even
before the version. What can be saved is the build CI runs when it has nothing to
say, and it now skips those.

The APK is re-signed after Gradle builds it. Gradle signs the release variant with
the Expo template's debug key, which is **generated per machine**: two builds of the
same commit would carry two identities, and a tester could not install one over the
other. `apksigner` replaces that signature with a stable one, either the test key or your
upload key when the secrets are set.

## Signing modes

The release build works **with or without** your own signing key:

| | Secrets set? | Output | Use |
| --- | --- | --- | --- |
| **Real release** | yes | APK **+ AAB**, signed with your upload key | Google Play + sideloading |
| **Test fallback** | no | APK only, signed with the in-repo **test key** (`signing/`) | Sideloading / sharing test builds |

The test fallback needs no setup. Every `v*` tag (or manual run) produces an
installable, consistently-signed test APK (clearly marked as a test build). It must
never go to the Play Store. To produce real releases, add the secrets below.

## Switching to real (Play Store) releases

For Play-ready releases, set up your own **upload keystore** and the repository
secrets below. Without them the workflow falls back to the test key described above.

### 1. Create an upload keystore (if you don't have one yet)

```bash
keytool -genkeypair -v \
  -keystore correctiv-upload.jks \
  -alias correctiv-upload \
  -keyalg RSA -keysize 2048 -validity 10000
```

Keep this file and its passwords safe. Losing it means you can no longer update the
app on Google Play. Do **not** commit it.

### 2. Add the secrets

Replace the values, then run (requires the GitHub CLI, `gh auth login`):

```bash
base64 -w0 correctiv-upload.jks > keystore.b64

gh secret set ANDROID_KEYSTORE_BASE64   < keystore.b64
gh secret set ANDROID_KEYSTORE_PASSWORD --body 'your-keystore-password'
gh secret set ANDROID_KEY_ALIAS         --body 'correctiv-upload'
gh secret set ANDROID_KEY_PASSWORD      --body 'your-key-password'

rm keystore.b64
```

(Or add them via GitHub → Settings → Secrets and variables → Actions.)

## Testing the pipeline without a release

Run the **Release Android** workflow manually (Actions tab → Run workflow, or
`gh workflow run release-android.yml`). It builds the APK and uploads it to the run
as an artifact, without creating a release. No secrets required, because it uses the test key.

Done once on 2026-08-06 from `9842b27`
([run 31105467974](https://github.com/faktenforum/correctiv-app/actions/runs/31105467974)).
The build job green, the artifact on the run, the test-key fallback taken because no
`ANDROID_KEYSTORE_*` secrets are set (a workflow warning, an APK, no AAB), and the
attach job correctly skipped without a tag. The APK carries
`CN=CORRECTIV App TEST KEY (not for Play)` and verifies under signature schemes v2 and
v3, so it installs on everything the app supports (`minSdkVersion 24`).

A tagless run cannot cover the `Set version from tag` steps or the attach job,
since each is `if:` a tag. The version steps were checked by running them
verbatim against the real files with `GITHUB_REF_NAME=v1.2.3` and
`GITHUB_RUN_NUMBER=47`. `app.gradle` went to `versionCode 47` and
`versionName "1.2.3"`, and `app.json` to `version 1.2.3` with `android.versionCode 47`,
keeping `package`, the adaptive icon and the permissions. Both `sed` patterns matched,
which is worth checking: a `sed` that matches nothing changes nothing and says so
nowhere.

`apksigner` writes a v4 `.apk.idsig` next to the APK, so it rides along in the run
artifact. It cannot reach a GitHub Release, because that step globs `*.apk` and
`*.aab`.

## What the first real tag proved

[`v0.0.3`](https://github.com/faktenforum/correctiv-app/releases/tag/v0.0.3), tagged on
2026-08-12 from `0d97483`
([run 31569569194](https://github.com/faktenforum/correctiv-app/actions/runs/31569569194)),
closes both gaps.

The tag drove the version, read off the downloaded asset rather than the run log:
`aapt2 dump badging` reports `versionName='0.0.3' versionCode='7'`, the `versionCode`
being the run number. Attaching works. The
certificate is the same one as the dry run, so re-signing holds across a tagged build
too.

And the released APK runs, which is the claim a release page cannot make: `adb install
-r` over an older build succeeded on an API 36 emulator, the app started, and Home
rendered with a live feed and the date header the core formats.

Two things the workflow does not do. The release body's note about which build this is
was added afterwards with `gh release edit`, and nothing about a release is committed.
The version patches live only inside the run.

## iOS (not yet wired up)

iOS requires a macOS runner plus Apple code-signing (Apple Developer Program,
distribution certificate, provisioning profile) and is distributed via TestFlight
rather than as a downloadable file. A separate workflow can be added once the Apple
Developer account is available.
