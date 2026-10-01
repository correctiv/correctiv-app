# ADR 0071 — The desktop host re-exports the phone's screens, and varies one only where the host refuses

> Renumbered from 0020 to 0023 to 0024 to 0026 to 0027 to 0071, most recently on
> 2026-10-01. This was written on the `desktop` branch while main was still at 0019, and
> main has taken the next number five times while this branch was away: 0020 for
> [No contribution in the app](0020-no-contribution-in-the-app.md), 0023 for
> [The host constructs the store](0023-the-host-constructs-the-store.md), 0024 and
> 0025 together for [the handbook at the root](0024-the-handbook-owns-the-root.md) and
> [the production bundle](0025-the-published-app-is-a-production-bundle.md), 0026 for
> [the React Native review](0026-react-native-review-and-hardening.md), and now
> everything from 0027 to 0070 at once — the branch was away for 289 commits, and
> 0027 is [the handbook drawing the app's components](0027-the-handbook-draws-the-apps-components.md).
> Nothing about the decision changed any of those times; only the number, and every
> reference to it. That this keeps happening is the cost of a long-lived branch holding
> a record, not an argument for holding the number, and the gap it jumped this time is
> the cost stated in full: a record on a branch is renumbered by however far main went.

Status: accepted, 2026-09-02. Scoped to `apps/desktop`, which ships nothing and says so
in its first sentence. The rule recorded here is the one thing about that host no file
states: three route files differ from the phone and twenty-four do not, and *what makes
a fourth one admissible* is a decision, not something a reader can infer from three
examples.

## Context

[ADR 0006](0006-one-core-two-hosts.md) prices a host at four ports plus its own screens,
and [ADR 0007](0007-removing-the-nativescript-host.md) records that the estimate stopped
being theoretical when the NativeScript host was deleted. The GTK4 host tested the first
half and it held exactly: `src/platform/` and `src/audio/` are the whole adapter.

The second half is where the estimate misleads. "Its own screens" was true of the
NativeScript host, which had a view vocabulary of its own — but `@gjsify/react-native`
renders React Native's own names onto GTK4, so the phone's screens are already written in
this host's vocabulary. A tree of twenty-seven screens *of its own* would be twenty-seven
files drifting against a phone that changes weekly, and the drift is the quiet kind: a
route exists on the phone, is simply absent here, and the desktop build stays green while
a screen is missing.

So the screens were not written. They are re-exported, and the interesting question
became the opposite one: **when is a host allowed to keep a copy?** Left unanswered it
answers itself, once per inconvenience, and the tree that results is a fork nobody
decided on.

[ADR 0012](0012-a-list-virtualizer-for-the-unbounded-lists.md) chose `FlatList` over
`FlashList` for the sake of this host before it existed, and closed with "No gjsify
target exists in this repo. If one is ever built, three things this app does today are
not answered by `@gjsify/react-native`'s support table and would need their own
decisions". One was built. All three decisions are made, and that sentence is retired at
the end of this file.

## 1. Decision

**The desktop route tree re-exports the phone's screens. A file varies only for a cause
it names in its own header, and there are exactly three admissible causes.**

Twenty-four of twenty-seven route files are one line:

```ts
export { default } from '@/app/(tabs)/index';
```

The three that are not, each with the cause that put it there:

1. **The ports.** `src/app/_layout.tsx` hands the core `gtkPlatform` + `gstAudio`
   instead of `expoPlatform` + `expoAudio`, and drops `import '@/global.css'` because
   that file is Uniwind's Metro entry and there is no Metro here. Everything else in it
   is the phone's file in the phone's order, so a `diff` between the two is short enough
   to read. This is ADR 0006's adapter, not a screen difference.
2. **A platform idiom an ADR already argues for.** `src/app/(tabs)/_layout.tsx` is an
   `Adw.ViewStack` + `Adw.ViewSwitcher` rather than a bottom tab bar.
   [ADR 0013](0013-native-tabs-and-a-web-tab-bar-of-its-own.md) already says each
   platform should present the tab bar in its own idiom rather than have one drawing
   stretched over all of them; a desktop window has no bottom bar, and drawing one would
   be the exact mistake that ADR argues against. The web target has a third layout for
   the same reason.
3. ~~**An import the support table refuses.** `src/app/artikel.tsx` exists because
   `Animated` is a refusing export (gjsify ADR 0032, tier P3: a subsystem rather than a
   component, and doing it badly is worse than not doing it). There is no prop-level
   answer to an import with no implementation, so the screen renders the reader header
   without the 160 ms fade and says so at the top of the file.~~ Voided by
   `@gjsify/react-native` 0.48, which implements `Animated` AND makes an
   `Animated.View` transparent to the facts its parent reads
   ([gjsify #1451](https://github.com/gjsify/gjsify/issues/1451), fixed by #1537), so
   the phone's `<Animated.View className="absolute …">` header composes here and the
   fade is back. `artikel.tsx` is still a variant, and now under cause 2 rather than
   this one: on Windows the web view is a child window the OS composites on top of the
   application, so nothing can be drawn over the document and the header is a strip
   above it. The addendum of 2026-09-05 has the measurement and cites gjsify's own
   record for the mechanism.

**A refused *prop* is never a fourth cause**, and that exclusion is the load-bearing half
of this decision. The GTK layer refuses about 110 prop uses by name across this app, and
every one of those refusals is correct. They are answered in this order:

- **First, on the phone**, if the phone's own idiom already answers it. That is not a
  concession to the desktop host: it is usually a place where the app was inconsistent
  with itself and no other host complained.
- **Otherwise once, in `src/shims/react-native.tsx`**, which is why the build aliases the
  bare `react-native` specifier to a file of ours rather than straight to
  `@gjsify/react-native`. One deliberate answer — implemented, mapped, or dropped with
  the reason written down — instead of 110 render-time throws.
- **A variant, never.** A copy of a screen is the unit that drifts, and it drifts to
  avoid a prop that a single line in the shim would have answered for every screen at
  once.

The ordering was not theoretical when it was written down. `(tabs)/profil.tsx` rendered
three `<Typo onPress>` rows; the layer refuses `onPress` on a `Gtk.Label`, correctly,
because a label emits no `clicked`. Because the tab stack mounts all five tabs from `/`,
the uncaught `PrimitiveError` ended the whole tree: Home captured 12 848 bytes where it
had captured 92 125. The fix was rule one — wrap the rows in a `Pressable`, which is the
construction the rest of this app already uses for a tappable line of text — in the
**phone's** screen, at 93 470 bytes and no refusal in the log. A desktop variant of the
whole profile tab would have fixed the same crash, left the phone inconsistent with
itself, and added a twenty-eighth file to keep in step for ever.

## Two tests hold it, in both directions

Neither needs GTK, and both run in `npm run check`, because the failure they guard
against is invisible on the machine of whoever built the thing.

- **`apps/desktop/test/route-tree.test.ts`** compares the two trees file by file. A
  screen the phone grows and this host does not is a failure; so is a desktop file the
  phone does not have, which is where a desktop-only screen would have to be argued for
  rather than appear.
- **`apps/desktop/test/support-gate.test.ts`** reproduces gjsify's build-time support
  gate against the same published support table, over the phone's source. Its
  `ANSWERED_BY_A_DESKTOP_VARIANT` list holds exactly one entry, `Animated`, and it is
  checked in the **other** direction too: when `Animated` lands upstream the test fails
  and names the variant that can now be deleted. Without that half a hand-written copy
  outlives its reason, because nobody re-checks.

## 2. Consequences of a second reader for every phone screen

**The desktop host is a second reader of every phone screen.** A construct only one
renderer tolerates becomes a failure here, and the profil crash is the shape of that:
`<Typo onPress>` was not wrong on the phone, it was merely the one place the app spelled
a tappable line of text differently from everywhere else, and no other host was ever
going to say so.

**A phone screen costs nothing here until it grows a refused import.** That is the whole
economy of the arrangement, and it is why the cost of this host is its shims and its
adapter rather than its screens.

**`npm run check` at the repo root typechecks and tests this workspace**, which is how
both guards above run at all. It is also why a change to the phone's route tree can fail
a check in a workspace the author was not editing; that is the guard working.

## What this does not settle

**Props are still checked at render time, per screen, and that is a real hole.** The
support gate is import-level: the profil crash passed through it green, passed the
typecheck, passed the build, and only then took the tree down. `npm run route-sweep` is
the only oracle for a refused prop today, and it needs a GTK session, a built bundle and
an admitted profile.

The named next step is `@gjsify/react-native/prop-table` — a published subpath with a
generated `PROPS.md`, so a consumer can read the layer's per-prop answers as data. The
gate already reads this app's source; with the table beside it, `<Typo onPress>` is a
failing assertion in about a second inside `npm run check`, instead of a screenshot that
is 80 000 bytes too small. That is the same trade this whole host is built on: a refusal
that names itself, moved as early as it can be moved.

**Nothing here decides whether the desktop host ships.** It is a feasibility
demonstration, it is not built by CI, and the rule above is about keeping it cheap enough
that the question stays open.

## Addendum, 2026-09-03: what the merge from main and gjsify 0.46 changed

The branch caught up with `main` at `2a88713` and with `@gjsify/*` `^0.46.0` on the same
day. Four things about this decision moved, and the shape of the arrangement held.

**The one variant survived, for a narrower reason.** `Animated` was a refusing export at
tier P3, which is why `artikel.tsx` is a variant. 0.46 implements the three names this
app uses, and `test/support-gate.test.ts`'s third assertion — the one that walks the
variant list backwards — went red on the upgrade and named the file. That is the
assertion working exactly as intended, and the variant was duly deleted for a
one-line re-export.

It came straight back, because the route then failed to render. The phone's overlay
header is `<Animated.View className="absolute …">`, and an `Animated.View` child does
not make its parent a `Gtk.Overlay` the way a `View` child does: `overlayOnAbsoluteChild`
is declared by four primitives in the layer's table, and `Animated` is not in that table
at all. Both features work alone and do not compose. So the variant is back, its header
says this instead of the old reason, and the list entry now carries an
`importableAnyway` sentence — because a name that has become importable must be
re-argued rather than silently kept, and the argument has to be written down somewhere a
reader will find it.

**The variant list's assertion changed shape rather than being deleted.** It used to
fail whenever a listed name became importable, which was right while "importable" and
"usable" were the same question. They are not any more, so it now fails when a listed
name is importable and carries no explicit justification. The first failure still forces
a human to look; what changed is that the answer can be "yes, and here is why it stays".

**One prop answer had gone silently wrong, and the merge is what surfaced it.** Since
0.46 a ref does not always carry a widget: a `TextInput` receives a `TextInputHandle`.
`applyAccessibility` kept calling `Gtk.Accessible.update_property()` on it, so the
door's two fields — the only `TextInput`s in the app — lost their screen-reader labels
behind a warning naming the symptom. `widgetOf()` unwraps `.widget` now. Worth recording
because the failure mode is the one this host's whole shim layer exists to prevent, and
it still got in: the app rendered, the sweep was green, and only a probe that printed
what the ref actually held found it.

**And one local answer was deleted, on its own instruction.** The hand-written
`TextInput` focus handle carried a note saying it belonged upstream and to delete rather
than grow it when the layer shipped one. 0.46 shipped `TextInputHandle`; the local one
is gone. Two of the layer's answers are better than what was deleted — `blur()` guards
that this widget holds the focus before clearing the root's, and `isFocused()` reads
`is_focus()` rather than `has-focus` — which is the argument for putting it upstream,
made concrete.

Two smaller ones, both in the className bridge. `flex-wrap` was stripped here with a
note to remove the branch on the next bump; 0.46 maps it to a wrapping widget, so the
branch is gone and the chip rows flow onto a second line. And `shrink` arrived from main
with [ADR 0020](0020-no-contribution-in-the-app.md)'s profile changes and is refused by
name — GTK expresses main-axis growth as a boolean, so there is no shrink factor — so it
is stripped loudly. It is **not** translated to `flex-1`, which is the tempting move and
would be wrong: `flex-1` is `hexpand`, which changes where a short value sits.

The route sweep is 24 of 24 after all of it.

## Addendum, 2026-09-05: the third cause is gone, and one variant changed its reason

`@gjsify/*` 0.48, linked from a working copy rather than pinned
(`apps/desktop/README.md`, *Against a gjsify working copy*).

**Cause 3 is void, and the fade is back.** The addendum above records the variant
coming back because an `Animated.View` child did not make its parent a `Gtk.Overlay`
the way a `View` child does. gjsify #1537 fixed that as a class rather than a case —
a wrapper is now transparent to the facts a parent reads — and `Animated.View` renders
through the `View` primitive, which declares `overlayOnAbsoluteChild`. MEASURED here on
2026-09-05: the phone's `<Animated.View style={{ opacity }} className="absolute left-0
right-0 top-0">` renders the reader's overlay header with no `PrimitiveError`, and the
160 ms fade is restored.

**So `artikel.tsx` varies under cause 2 now, not cause 3.** The remaining difference is
the one platform idiom this file has always also carried: on Windows the web view is a
child window the OS composites on top of the application, so nothing can float over the
document and the header is a strip above it. That is a platform idiom an ADR argues for
— gjsify ADR 0035 — which is exactly what cause 2 admits. The file's header says so.

**`Animated` leaves the variant list.** `ANSWERED_BY_A_DESKTOP_VARIANT` in
`test/support-gate.test.ts` is empty again. Its third assertion did not force this
re-check and could not have: the entry carried an `importableAnyway` sentence, which is
what that assertion accepts as the re-argument, so a sentence that had become false
passed. **That is the shape of gap this ADR should say out loud.** The prop table
answers "is this prop accepted on this primitive" and there is no published answer to
"does this element make its parent an overlay", so the composition question has no
oracle and the sentence is all there is. It was re-checked because the whole 0.47→0.48
ledger was, not because anything failed.

## 3. What this retires in ADR 0012

From [ADR 0012](0012-a-list-virtualizer-for-the-unbounded-lists.md)'s "What this has not
delivered", all in the paragraph headed *The desktop host is a reason, not a plan*. The
sentence is struck through there; the argument around it stands, because the reason
`FlatList` won the tie is unchanged and the host it was chosen for now exists.

- **"No gjsify target exists in this repo."** False since `apps/desktop`.
- **The three decisions it said "would need their own decisions", all now made.**
  `Animated` is the one variant this arrangement admits (cause 3 above, `artikel.tsx`).
  `hitSlop` is dropped in `src/shims/react-native.tsx` with the reason written down — it
  is an 8 px expansion of a *touch* target on a platform whose pointer is a mouse, so
  there is nothing to preserve. Remote-URL images are answered by
  `src/shims/expo-image.tsx`, which fetches the URL and decodes it to a `Gdk.Texture`
  rather than handing `Gtk.Picture` something it cannot take; that shim's header quotes
  ADR 0012's sentence as the gap it closes.

Nothing in a later ADR. [ADR 0013](0013-native-tabs-and-a-web-tab-bar-of-its-own.md)'s
per-platform tab idiom and [ADR 0016](0016-a-door-at-the-root-and-an-entitlement-not-an-amount.md)'s
door are both *carried out* here rather than corrected: the tab layout is cause 2, and
the door is not a cause at all, because the gate is the phone's own component rendered
from the phone's own branch.
