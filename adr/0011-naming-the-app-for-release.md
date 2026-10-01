# ADR 0011 — Naming the app for release, and letting the old host go

Status: accepted, 2026-08-28.

## Context

The repo is being taken from a prototype to an app that will be published. Two of
the names it carries were chosen when neither of those things was settled, and one
of them stops being changeable the moment a build reaches a store.

**`org.correctiv.app.prototype`** is the Android package and the iOS bundle
identifier. It is the app's permanent identity on both stores: Google Play binds a
listing to it for the lifetime of the listing, and an app cannot change it later
without shipping as a different app that existing installs will not update to. The
cost of changing it today is that a handful of test devices uninstall once. The cost
of changing it after the first upload is that the listing, its reviews and its
install base start again from zero. So the choice is not whether the name is good
enough, it is that this is the last cheap moment to make it.

**`apps/mobile-rn`** names the view framework. [ADR 0007](0007-removing-the-nativescript-host.md)
declined to rename it, and the reasoning was sound at the time: the rename touches
every import path for a shorter directory name, and `-rn` reads as "React Native",
which is true. What has changed is not the cost, which is the same 117 references it
always was, but what the name is for. While there were two hosts, the view framework
was the thing that distinguished one app directory from the other. With one host it
distinguishes nothing, and the axis that is actually about to vary is the platform:
iOS and a web target already exist in this workspace, and `screens/` is being
reorganised around exactly that distinction.

**`screens/nativescript/`** was kept by ADR 0007 as the last trace of the removed
host, next to `screens/draft/` and the three-way montages in `screens/compare/`. A
year of layout decisions is genuinely in those pictures. But nothing builds the
NativeScript column any more, the montages bake a deleted app into their pixels, and
`screens/draft/` duplicates a design that lives in the `design-entwurf` checkout and
moves when the design does, not when this repo does.

## 1. Decision

**The app is `apps/mobile`, the package is `@correctiv/mobile`, and the identity on
both stores is `org.correctiv.app`.** The Expo slug follows the repo name rather than
the stack.

**`screens/` is a platform axis, not a stack axis.** It holds one set, `android/`,
under the same step names the tours have always used. `ios/` and `web/` join it when
those builds are shot. The draft, NativeScript and compare sets are deleted, and
`compare.sh` with them: a montage script whose first column no longer exists is not a
tool, and the two-column version it could become is worth writing when there are two
platforms to put in it.

**What the removed host taught stays, without its name.** Forty-six comments across
the core, the app and the tests explained a decision by pointing at what NativeScript
did. The explanation is the valuable half; the name of a framework this repo does not
build is not. Each now says that an earlier implementation did X and why this one
does Y. The four `@nativescript/*` patterns in `boundary.test.ts` are the exception
and stay, because that list is a list of dead stacks on purpose, Vue and Pinia and
zustand included, and its job is to stop one drifting back.

## Consequences

- **Test devices carrying an older build must uninstall it once.** Two package ids
  cannot occupy one device as the same app, and the in-repo test key's whole point
  was in-place updates. That guarantee is broken exactly once, here.
- **The release workflow's artifact is `correctiv-app-<tag>.apk`.** The `-expo`
  infix went with the job names, which are now `web` and `android` in CI and
  `android` in the release workflow, after their target rather than their framework.
- **ADR paths below 0011 read `apps/mobile-rn` where the tree says `apps/mobile`.**
  They are records and are not rewritten. [`README.md`](README.md) carries the
  reading rule, including the trap that ADRs 0005 to 0007 also use `apps/mobile` for
  the *deleted* NativeScript app.
- **The comparison rounds are no longer reproducible from the repo.** What they found
  is fixed and shipped, and `screens/README.md` keeps the rules they produced. The
  tables are in that file's git history.

## What this retires

Statements in earlier ADRs that this decision makes **false**, struck through where
they stand:

- [ADR 0007](0007-removing-the-nativescript-host.md), Decision: "**`apps/mobile-rn`
  is not renamed to `apps/mobile`**", and the argument that `-rn` should stay. The
  rename is done. The cost estimate in that paragraph was accurate; what changed is
  what the name buys.
- [ADR 0007](0007-removing-the-nativescript-host.md), Consequences: "`screens/nativescript/`
  is now the only trace of that app … **It stays**". It does not.
- [ADR 0005](0005-react-native-over-nativescript.md) and
  [ADR 0007](0007-removing-the-nativescript-host.md) name the shared package id
  `org.correctiv.app.prototype` as a reason the two apps could not be installed side
  by side. The observation was true; the id is no longer that.

Not retired, and worth saying so: ADR 0007's core decision, that one host is enough
and the core keeps its ports and both extraction backends, is untouched. This is a
rename and a clear-out, not a reversal.
