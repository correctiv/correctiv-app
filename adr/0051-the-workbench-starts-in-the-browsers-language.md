# ADR 0051 — The workbench starts in the language the browser asks for

Status: accepted, 2026-09-18. **Built in [#227](https://github.com/correctiv/correctiv-app/pull/227)**, which is also where it was written.

## Context

[ADR 0050](0050-the-workbench-gets-a-second-audience.md) gave this site a second
language and a setting to reach it with. §4 fixed the default: English, expressed by
the absence of `workbench:language`, on the argument that the source of every string
here is English and an untouched browser should therefore show the source.

That argument is about the code. The setting is about a reader, and the two come
apart at exactly the audience ADR 0050 §1 names: somebody from the newsroom,
arranging the home screen, on a machine that asks for German. What that person got
was an English interface until they found a dialog whose heading they could not read.

The heading is `Language · Sprache` for that very reason — ADR 0050 §4's closing
paragraph says the picker has to be findable "in a language they may not be reading
yet". That sentence is the record noticing the problem and solving the wrong half of
it: it makes the way out findable instead of not sending anyone down the corridor.

Every browser has already answered this question. `navigator.languages` is a ranked
list the reader configured, and no other setting on this site has to be guessed
either — the appearance follows the machine by default and calls that "System".

## Decision

### 1. The default is the language the browser asks for

`navigator.languages`, walked in order, first primary subtag this site has a
language for; English when it has none of them, because English is every
`defaultMessage` and therefore what renders with no catalogue consulted.

**The ranked list and not `navigator.language`.** The singular is only the head of
it, and a reader whose first choice is a language this site does not have still has
a second and a third: `['fr-FR', 'de-DE', 'en']` wants German.

**The primary subtag decides**, so `de`, `de-DE`, `de-AT` and `de-CH` are one
answer. There is nothing regional in this catalogue to tell them apart with, and a
reader asking for Swiss German is better served by German than by English. That is
the opposite of the app's rule for FORMATS, where
`packages/app-core/src/lib/format.ts` pins a region on purpose: of the four formats
that file asks for, the two that write the month out come out in a different ORDER
under `en` than under `en-GB`. Wordings and formats are different questions and it
is fair that they get different answers.

### 2. "System" is a third value of the setting, not a hidden default

The appearance has three states and the one that follows the machine is the point
of the control: `TROUBLESHOOTING.md` numbers four appearance combinations and says
the fourth, system against a dark device, is the one that has already shipped
broken. The language now has the same three, in the same shape — `'system' | 'en' | 'de'`,
default expressed by the absence of the key, written only from the setter, which is
issue #131's rule kept.

**Without the third value the setting cannot be used.** With two states and a
browser-derived default, choosing English on a German machine would be
indistinguishable from choosing nothing, so either the choice would not persist or
"nothing chosen" would have to become a stored value and the #131 shape would break.
Three states is what lets the default stay an absence.

**It follows the browser live.** `prefers-color-scheme` is a media query and CSS
re-evaluates it, so the appearance gets this free; a language has no such mechanism,
and `window`'s `languagechange` event is what makes the same word mean the same
thing in both settings. Only while "system" is what is selected: a reader who picked
English does not want a new keyboard layout changing the site under them.

### 3. One row of the picker is translated, and it is the only one

`English` and `Deutsch` name themselves and must not be translated, which is ADR
0050 §4's last paragraph and stands. "System" has no language of its own, so it
follows the setting like everything else in the dialog, and it is the one row in
that group that is a message descriptor. It is drawn first, because it is what is
selected until somebody decides otherwise.

Its hint says "Follow the browser" where the appearance's says "Follow the device",
and that difference is the truth rather than a variation for its own sake: the
language list comes from the browser's own settings and the colour scheme from the
operating system's.

### 4. The constant that meant both things is split

`DEFAULT_LANGUAGE` was the language the source is written in *and* the language an
untouched browser gets. Those were one value while the answer was the same, and they
are two questions. `SOURCE_LANGUAGE` is now react-intl's `defaultLocale` and nothing
else; `DEFAULT_CHOICE` is `'system'`.

Renaming rather than adding: a constant that still read `DEFAULT_LANGUAGE` beside a
default that was no longer it is the shape a reader trusts and is wrong about, and
there is no check that can catch a name meaning less than it says.

## What this retires

- [ADR 0050](0050-the-workbench-gets-a-second-audience.md) §4's "default English
  expressed by the key's absence". The absence is still how the default is
  expressed; what it now means is "follow the browser". The rest of §4 — storage
  rather than the address, written only from the setter, the two self-named labels —
  is untouched and is what this record builds on.
