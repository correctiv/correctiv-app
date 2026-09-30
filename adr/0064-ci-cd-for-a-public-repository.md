# ADR 0064 — CI/CD for a public repository

Status: draft, 2026-09-15, revised 2026-09-25, **not built**. Nothing below exists in a workflow yet; the pipeline that
runs today is the one [RELEASE.md](../RELEASE.md) describes.

## Context

Three workflows build this repository today. [`ci.yml`](../.github/workflows/ci.yml)
checks every pull request and push, exports the web target, and builds an Android
release APK as a compile check when a change can reach it.
[`pages.yml`](../.github/workflows/pages.yml) publishes the workbench with the app at
`/app/` on every push to `main`.
[`release-android.yml`](../.github/workflows/release-android.yml) signs an APK on a `v*`
tag, with the upload key when the secrets are set and with the committed test key when
they are not, and attaches it to the GitHub Release. There is no iOS build at all, and
no path into either store.

What is missing is a review app testers can install from `main`, a release candidate
that reaches the stores, and an iOS build of any kind.

Two facts decide the provider, both measured on 2026-09-25:

- **GitHub Actions costs nothing here.** Its billing page: "GitHub Actions usage is
  free for self-hosted runners and for public repositories that use standard
  GitHub-hosted runners", macOS included. Larger runners and storage past the included
  amount are charged regardless.
- **EAS would not.** Expo's free plan builds 15 Android and 15 iOS apps a month in a
  low-priority queue. `main` took 174 first-parent commits between 2026-08-25 and
  2026-09-25, so a review build per merge is an order of magnitude past it, and the
  paid plan bills per build on top of its monthly fee.

## Decision

### 1. GitHub Actions and Fastlane build every stage, and EAS stays out while the repository is public

| Trigger | Android | iOS | Purpose |
| --- | --- | --- | --- |
| Every PR revision | Build an APK with the throwaway test key | Build an unsigned simulator `.app` | Verify buildability without signing or store secrets; no tester distribution |
| Every merge into `main` | Sign a review APK and attach it to the `preview` prerelease (§5) | Build the review app and upload it to internal TestFlight | Give testers the integrated app |
| Published GitHub release or prerelease, except `preview` | Build a release AAB and upload it to Google Play internal testing | Build the release app and upload it to internal TestFlight | Produce candidates for the production app |

This extends the existing workflows rather than adding a build provider. The reason is
the cost above, and **it holds only while the repository is public**: made private, the
macOS minutes are billed at a multiple of Linux ones, and this decision has to be
argued again against EAS, whose remote build numbers and managed credentials would
then replace most of §4 and §6.

Publishing a GitHub release does **not** authorize public store rollout. Release tags
must point to reviewed `main` commits with successful required checks.

### 2. A pull request proves the build without a secret

Keep root checks and both web builds alongside native PR builds. Use the root
workspace installation and pinned toolchains, including Xcode. Bundle JavaScript into
the native outputs; a debug build that depends on Metro is not sufficient. Fork and bot
PRs use the same secretless verification, and their output is never published as a
review build.

An iOS simulator build does not prove device compilation, provisioning or signing. The
signed device build on `main` covers that gap after merge; this is the accepted
trade-off. Neither build proves runtime behaviour. Record device testing before public
rollout under the
[existing review rules](../TROUBLESHOOTING.md#a-green-build-is-not-evidence).

### 3. The review app is a second app, with its own name, icon and scheme

| App | Bundle/package ID | Delivery |
| --- | --- | --- |
| CORRECTIV Preview | `org.correctiv.app.preview` | Public review APK; separate App Store Connect app with internal TestFlight |
| CORRECTIV | `org.correctiv.app` | Release app: internal TestFlight and Play internal testing, later public rollout |

**The reason is that a tester keeps both apps on one device.** On iOS a TestFlight
build of the same bundle ID replaces the App Store version, and on Android Play re-signs
the store build with its own key, so a sideloaded APK under the same package collides
with it. A second identity is the only way to have both, and it costs one more App
Store Connect record and one more ID in Match.

So that a person can tell them apart, the review app differs in what they see:

- **Name**: "CORRECTIV Preview", or a shorter form if iOS truncates it under the icon.
- **Icon**: the release icon with a band across it, the way GNOME marks its development
  builds. The files are generated once and committed, not composed at build time, so
  the result is visible in a diff. The band is lost in Android's themed (monochrome)
  icon and in iOS's tinted variants; there, the name is what distinguishes them.
- **Scheme**: `correctiv-preview`. Universal Links and App Links on correctiv.org belong
  to the release app alone, or the system would ask which app opens every link.

Storage needs no work: a separate identity has its own sandbox and keychain. All of it
is one switch, an `APP_VARIANT=preview` read by
[`apps/mobile/app.config.js`](../apps/mobile/app.config.js), which already exists for
the values `app.json` cannot hold. The `main` workflow sets it; the release workflow
does not.

The review APK uses a stable, protected signing key so testers can update in place; it
must not use the public test key. Release signing uses the production identity from
[ADR 0011](0011-naming-the-app-for-release.md), with no test-key fallback. A review
binary is never promoted to the store; release candidates are built from their own tag.

Both iOS apps distribute to **internal TestFlight groups** first, whose members need
App Store Connect access, with automatic distribution after processing. External
testing can be enabled by hand when needed, subject to Apple's Beta App Review. Use
normal App Store distribution builds, **not** the "TestFlight Internal Only" export,
which would rule out external testing and public release of those binaries. An upload
that succeeded does not mean a build reached testers; report processing and
distribution failures.

### 4. The build number is the run number, and the newest `main` wins

The native build number is the workflow's `github.run_number`, which rises with every
run and, in GitHub's words, "does not change if you re-run the workflow run". A retry
therefore reuses its number, which is what a store expects of the same binary, and no
counter has to be stored, allocated or committed back to `main`. The user-visible
version comes from the release tag and stays the same between releases. Record the
source SHA, version and build number with every delivery.

**Only the newest `main` is built.** The delivery job runs in one concurrency group
without `cancel-in-progress`, so a running upload is never cancelled, and a merge that
lands while one is waiting replaces the waiting one. A review app shows the current
state and nothing is lost by skipping an intermediate one. Should every merge need its
own build after all, `queue: max` on the same group keeps them in order.

A rebuild gets a new build number and must be tested again. Track each platform's
delivery separately. Public rollout remains manual and promotes the tested **release**
candidate unchanged.

### 5. The review APK is a release asset, and the site links to it

Every successful `main` build replaces the APK attached to one prerelease with the fixed
tag `preview` (`gh release upload --clobber`) and rewrites its notes with the version,
build number and source revision. The tag itself does not move, so it needs no
exception from tag protection, and the release workflow ignores it.

Its address stays the same for every build,
`https://github.com/correctiv/correctiv-app/releases/download/preview/correctiv-preview.apk`,
and downloads without a GitHub login: the same form for `v0.0.4`'s APK answered an
anonymous request with 200 on 2026-09-25. (`/releases/latest/download/` would not do,
because it skips prereleases.) The workbench shows a download button and a QR code for
that address, labels it a review app, and explains Android's sideloading requirement.

**Pages stays out of it.** Hosting the APK inside the site would need one publisher for
both, a documentation deploy that preserves a binary it did not build, and a copy
outside the site to recover it from, because Pages replaces the whole site each time.
A release asset has none of those problems, does not count against Actions storage, and
a failed build leaves the previous APK and its notes in place, still describing each
other.

Public APK download is intentional. Review builds must not contain secrets, private
fixtures or privileged production access. Per-PR hosted web previews and sticky PR
comments are not part of this setup.

### 6. Signing stays with CORRECTIV, and only `main` and releases reach it

CORRECTIV owns the store accounts, signing keys and a **private Fastlane Match
repository**; agency access is delegated. Match holds the iOS certificates, private keys
and App Store provisioning profiles, encrypted, for both app IDs. CI reaches it through
a **read-only deploy key** and runs Match with `readonly: true`; creating and renewing
certificates is a maintainer's job, not a workflow's. The deploy key grants repository
access, not decryption or store-upload rights; App Store Connect API credentials,
Android signing keys and Google Play service account access are separate secrets.

Match was chosen over Xcode's cloud signing, which would need no repository and no
deploy key: `xcodebuild` signs for distribution with an App Store Connect API key only
when that key has the Admin role, and an admin key in CI is a wider grant than the
agency arrangement should carry.

PR jobs receive none of those credentials. Only reviewed `main` and authorized release
jobs may sign or upload, from protected GitHub environments, with review and release
permissions separated as far as the providers allow. A branch or folder in Match is not
an access-control boundary. Untrusted PR code never runs through a privileged
`pull_request_target` or `workflow_run` job.

The hardening that follows from this, rather than deciding anything, goes into
[RELEASE.md](../RELEASE.md) with the workflows that implement it: temporary keychains,
read-only default token permissions, actions pinned to reviewed SHAs, protection for
`main`, tags and workflow files, what may be published, and how long private artifacts
are kept.

### 7. No ad-hoc iOS distribution

TestFlight avoids collecting tester UDIDs for ad-hoc provisioning. Ad-hoc builds are
excluded for now. Reintroducing them requires a separate distribution and privacy
decision, and advance communication with and informed agreement from device owners:
**a publicly downloadable IPA can expose registered UDIDs in its embedded profile**.
Open-source code does not itself require public profiles or public IPA downloads.

## What this does not decide

- OTA updates.
- Per-PR web previews.
- When to enable external TestFlight testing, and the public store rollout itself.

Before implementation: provision both App Store Connect app records and internal
groups, the release app's Play internal track, the Match repository, signing
credentials and the protected environments. After it: verify APK installation, update
in place and the QR download on a device, TestFlight availability, and Play delivery
with the intended app IDs.

## What it retires

Nothing yet, because nothing is built. When the workflows land, the same pull request
strikes [ADR 0011](0011-naming-the-app-for-release.md)'s consequence that "the release
workflow's artifact is `correctiv-app-<tag>.apk`", since a release then produces an AAB
for Play and the tag-push APK and its test-key fallback are gone, and rewrites
[RELEASE.md](../RELEASE.md), [`ci.yml`](../.github/workflows/ci.yml),
[`pages.yml`](../.github/workflows/pages.yml) and
[`release-android.yml`](../.github/workflows/release-android.yml), which describe the
operation this replaces.

## References

- [GitHub: Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)
- [GitHub: concurrency](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency) and [`run_number`](https://docs.github.com/en/actions/reference/workflows-and-actions/contexts)
- [GitHub: linking to releases](https://docs.github.com/en/repositories/releasing-projects-on-github/linking-to-releases), [secure use of Actions](https://docs.github.com/en/actions/reference/security/secure-use)
- [Expo: pricing](https://expo.dev/pricing) and [app variants](https://docs.expo.dev/tutorial/eas/multiple-app-variants/)
- [Fastlane: Match, deploy keys and read-only CI](https://docs.fastlane.tools/actions/match/), [TestFlight uploads](https://docs.fastlane.tools/actions/upload_to_testflight/)
- [Apple: internal TestFlight groups and Internal Only restrictions](https://developer.apple.com/help/app-store-connect/test-a-beta-version/add-internal-testers/)
- [Apple Developer Forums: cloud signing for distribution needs an Admin key](https://developer.apple.com/forums/thread/698117)
