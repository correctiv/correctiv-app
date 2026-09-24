# ADR 0033 — One text size for the whole app, the system's by default

Status: accepted, 2026-09-16, decided by the product side. ~~Not built.~~ **§1 built in
[#260](https://github.com/correctiv/correctiv-app/pull/260)**, after #158 had landed: one setting, following the system by default, and a
chosen size replaces the system's rather than multiplying it, the article included. The
scale's values and its ceiling are named as open below, and [#158](https://github.com/faktenforum/correctiv-app/issues/158)
has to land first for reasons this record gives. What the build chose where this record
leaves it open is the conservative answer each time: the same three steps and the same
ceiling of 1.15, with the settings screen saying that larger type is the system's; the
reader keeps taking a number into its root font size, now the app's whole scale, with
Android's WebView pinned to a text zoom of 100 so the system is not applied twice. The
"one place" is `apps/mobile/src/lib/theme/textScaling.tsx`, one context fed by one store
subscription, behind the two elements React Native draws text with, `ui/ScaledText` and
`ui/ScaledTextInput`. The accessibility check names exactly those two, both as the only
opt-out and as the only files that may take a raw `Text` or `TextInput` at all. The platform's own chrome, the native tab
bar's labels and iOS's back label, is not reached and follows the system. iOS unrun.

## Context

The app has two text sizes today and they do not know about each other.

**The system's**, which already reaches everything. `apps/mobile/src` has **zero**
`allowFontScaling` opt-outs, measured 2026-09-16 by
`apps/mobile/__tests__/accessibility.test.ts`, so every `Text` in the app grows with the
device's font setting. The accessibility tour of the same day confirmed it on a device:
at 200 % the whole interface scales.

**The article's**, which reaches one screen. `settings.textScale` is a number with three
steps, set in "Textgröße im Artikel", and it is applied inside the reader's WebView CSS.
Its own note in the settings screen says what it is: *"Wirkt sich auf die Artikel-Ansicht
aus."*

So a reader who has set their phone to large type gets large type everywhere, and then a
second, unrelated dial that only changes the article. The two multiply, and neither knows
the other exists.

## 1. Decision

**One setting, for the whole app, and the system's value is the default.**

It takes the shape the appearance setting already has, because that is the shape people
here have already learned: follow the system, or turn that off and choose. The appearance
row is "An Systemeinstellung orientieren" with a manual choice underneath, and this is
the same row for type.

**The article is not special.** The reader's CSS takes the same scale the rest of the app
takes. A larger setting makes everything larger by the same amount, which is the whole
point: a person who needs bigger type needs it in a list as much as in an article.

`settings.textScale` as an article-only multiplier goes away. What replaces it is one
value with one meaning.

**Override means replace, not multiply.** Choosing a size in the app is choosing an
absolute size, not adding to what the system said. Multiplying would mean the same
setting produces a different result on two phones, which is the opposite of an override,
and at system 200 % with the current top step it would land near 230 % — a size nothing
in this app has ever been seen at.

## The tension this creates, and how it resolves

Replacing the system scale means opting out of it: `allowFontScaling={false}` with the
app's own multiplier, or a pinned `maxFontSizeMultiplier`.

**That is exactly the thing the accessibility check forbids.** One of its four rules is
"no font-scaling opt-out", the app is clean on it today, and the rule is right: a
developer pinning text size is how an app becomes unusable for somebody who needs large
type.

The resolution is that the rule is about *who* is choosing. An opt-out that takes the
choice away from a reader is the defect. An opt-out that hands the same reader a
different dial, with the system's value as the default and their own choice on top, does
not take anything away — it is the override they asked for.

So: **one named exception, in one place, with the reason** — the obligation mechanism 4
carries in [ADR 0031](0031-four-mechanisms-for-this-must-not-be-forgotten.md). The opt-out
lives at the one component that applies the app's scale and nowhere else, and the check
names it rather than being loosened.

If that one place cannot be made to exist — if the scale has to be applied at every call
site — then this decision is wrong as written and should come back here rather than be
implemented by weakening the check.

## Why #158 comes first

The accessibility tour found four places where a `justify-between` row neither wraps nor
gaps, and they collapse at 200 %: the tab bar loses three of its five labels on every
screen, the door's two footer links collide, the search field cuts its own placeholder.

Today those are reachable only by a reader who has already set their phone to 200 %.
**This decision makes them reachable from inside the app**, from a settings row that
invites the choice. Shipping the row before the fix would be handing somebody a control
whose first use breaks the interface.

## What is open

**The values.** Three steps today, at 1, 1.15 and one smaller. Whether an app-wide scale
wants three steps or five, what the smallest and largest are, and whether the labels stay
`A / A+ / A++` is a design question and not settled here.

**The ceiling.** The system goes to 200 % and the app has never been designed for it.
Whether the in-app override offers that much, or stops lower and says so, needs the
answer to #158 first.

**What the reader does with it.** The WebView takes a number into CSS today. Whether it
keeps doing that with the new value, or whether the document should be handed a size in
absolute units, is an implementation question with a measurement attached — the reader is
the one surface where type is set in `rem` against a root the app does not own.

## What it retires

`settings.textScale`'s meaning, ~~though not yet the field~~ and the field with it, as it
was built in [#260](https://github.com/correctiv/correctiv-app/pull/260): the setting is `settings.textSize`, because the rename is what
migrates an installed app, whose old value is then never read as an override it was not.
It stops being "the article's
size" and becomes "the app's size". The sentence in the settings screen that says it
affects the article view becomes false the day this lands, and the German for it lives in
~~`apps/mobile/src/i18n/catalogue/de/settings.ts`~~ `packages/catalogue/src/de/settings.ts`,
since [ADR 0049](0049-the-catalogue-is-a-package.md) moved the catalogue into a package,
under `settings.textScale.note`.
