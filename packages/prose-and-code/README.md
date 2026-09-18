# @correctiv/prose-and-code

Helpers for the checks that hold a repository's prose to its code.

A project with documentation and a test suite can already assert that a link
resolves and that a code block runs. What nothing published helps with is the other
half: the sentence in the README that states a number the code computes, the list of
files allowed to break a rule, the generated file somebody edited by hand, and the
check that quietly stopped reading anything at all. This is a small set of functions
for writing those, taken out of roughly forty check files in one repository after
each pattern had been written two or three times.

**It is not a test framework and does not want to be.** Every function returns what
it found — a list of faults, or a pair of lists — and your own runner turns a finding
into a failure:

```ts
import { filesUnder, floorFaults, ratchet, under, withoutComments } from '@correctiv/prose-and-code';

const files = filesUnder('src', /\.tsx?$/);

it('reads the app it is checking (guards against a silently empty walk)', () => {
  expect(floorFaults({ 'files under src/': { found: files.length, atLeast: 50 } })).toEqual([]);
});
```

It works the same way outside a test. Two of the callers that shaped it are a
build-time module that collects the same faults and throws, so that a site does not
build with a page that is confidently wrong.

Node and TypeScript. No framework, no build step, no compiler flag: one module of
source that a bundler, a test runner's transform, or Node itself can read. One
dependency, and it is the compiler — pattern 6 parses rather than matches, and
because this is one module every consumer loads it, including the ones that only
walk a directory.

## The patterns, and the failure each one catches

The numbers below are addresses, so `§4` still points at comment-stripping in a
year. They are deliberately not totalled anywhere: a count of them would be a figure
in prose with nothing under it, in the package whose last section is about exactly
that.

**1. The guard against a silently empty walk.** `filesUnder`, `under`, `floorFaults`.
A source-reading check that matches nothing passes: every assertion in it says "the
offenders are none", and a walk that read no files produces no offenders. The run is
green, fast, and about nothing. A directory renamed, a glob narrowed, a `g` flag on
the pattern that drives the walk, a parser upgraded past the node kinds it knew — all
ordinary, all silent. So the first case in such a file asserts that it read
something, at every stage: the files, then what the parse produced, then the subset
the rule is about. `floorFaults` names the stage that came back empty.

**2. The two-sided ratchet.** `ratchet`, `excusesWithoutReason`. A list of files
allowed to break a rule only ever grows: nothing takes an entry out when the
violation is fixed, so the excuse stays and the next person reads it as permission.
Asserted in both directions — a new violation fails, and an excuse whose violation
has gone fails too — the list can only shrink, and the last fix takes the last entry
with it. `excusesWithoutReason` is the third assertion: an entry that carries a path
and no argument says nothing about whether it is a debt or a decision.

**3. Regenerate and compare.** `driftAfterRegenerating`. For any fact that has a
generator, this is the strongest form available, because there is no second copy to
keep: the committed file IS the output. Forgetting the thing itself is usually a
compile error; forgetting to regenerate is not, and an artefact edited by hand
compiles and passes review. This runs the generator over the real files, compares,
and puts the committed bytes back — including when the generator throws. Where your
generator has a seam between deciding and writing, compare the file with that
function's return value instead and skip this entirely.

**4. Comment-stripping before scanning.** `withoutComments`,
`withoutCommentLines`, `withEscapesDecoded`, `eatenByStripping`. A prose rule applied
to source hits its own explanation: the comment above a rule names the thing the rule
forbids, so the check reports the file that documents it. `withoutComments` empties a
block comment into the newlines it occupied rather than deleting it, because deleting
it moves every line after it up and the report then points at innocent code with a
number that looks right. `withoutCommentLines` is the narrower rule for checks that
read string literals. Beyond that they behave alike, and the opener is the part to
know about: **both** open a block comment only where one plausibly can — a line
start, whitespace, or one of `;{}(),=:[`. Opening on a slash-star anywhere, a path
alias written `"@` slash star `"` opens a comment that the next recursive glob
closes, and a whole configuration file's middle comes back blank behind a green
check. That is measured, not hypothetical, and it is the reason the clause exists.

Both are still regular expressions rather than parsers, so both can remove something
that was not a comment: a slash-star written after a space inside a string literal
opens a block in either of them. `eatenByStripping` is the guard for that — hand it
your documents and what "still reads" means for them (`JSON.parse`, by default) and
it names the file the stripper ate. A stripper that can produce nonsense should be
able to say so. Read its docblock before trusting a green run of it: it asks whether
the stripped text still reads, not whether it still says what it said, so wreckage
that stays on one line goes past it.

**5. Proportional floors.** `floorFaults`, again. "At least one" is not a guard
against a set where most members qualify: a collector degraded to finding a single
match satisfies it. A fraction of the set — `records.length / 4` — is not a number
anybody maintains as the set grows, and it fires while the output is merely
incomplete rather than a lie. This is written down because the repository this came
from shipped the other thing, and the guard passed while the page was wrong.

**6. A literal a person reads, off the syntax tree.** `renderedLiterals`. Every
user-facing string is supposed to be a message with an id, and the one that is not
ships in the only language somebody typed it in. Nothing else catches it: a type
checker sees a string in a position that takes one, a linter sees the same, a check
for non-English characters sees no umlaut in `Save`, and the extractor's own output
lists what WAS extracted — the missing string is exactly the one missing from it.
This parses a file and returns the literals in a JSX text child, in a brace beside
one, and on the prop and property names the caller says a person reads, following
the four shapes that CHOOSE a string rather than computing one (a ternary, a
`&&`/`||`/`??` fallback, a `+` between literals, an array joined with `.join`). It
parses instead of matching for a reason this package can state against itself:
pattern 4's strippers are regular expressions that can eat a string literal, and a
check whose whole subject is string literals would come back clean on the file they
ate. A comment is trivia to a parser and never a node, so a rule's own explanation
and commented-out markup are both invisible with nothing removed from the text.
Which props are visible and which calls are already descriptors stay at your call
site, because both are read off the components rather than off the framework. One
known gap, in the docblock and asserted in the test beside it: the four shapes are
followed in a text child only, so a ternary on a prop walks past.

**And the one nothing else does: a number in prose.** `numberInProse`,
`spelledNumber`. "All 49 existing call sites" in a contributor guide, a Node version
in four files, a count spelled out in a caption. A figure measured against the
repository itself goes wrong quietly and fast. The extraction pattern stays at your
call site, because the sentence is particular and its phrasing is load-bearing; what
this carries is the sweep over every document it might be in, a word and a numeral
being the same number, a report that quotes the sentence — and a fault when the
pattern matches nothing, because a rewritten sentence is how such a check gets
deleted without anybody deciding to.

## What it does not do

It does not find the rule for you, and a green run proves only what the rule says.
These helpers read text and count; whether a label is *right*, whether a box actually
clips, whether the excuse is a good one — none of that is here, and a check built on
this should say so where somebody reading it will see it.

## Status

**Used in one repository so far**, the one it came out of. That is the whole of its
track record: the interface was shaped by that repository's problems, and the parts
that are secretly about it are invisible until something else tries to use it. It is
not published for that reason, and it will be when a second project actually needs
it rather than on a date
([ADR 0043](../../adr/0043-two-concepts-become-packages-and-the-shell-stays.md) §2).

If you are that second project: the thing most likely to be wrong for you is the
shape of an excuse list, and the thing most likely to be useful on the first day is
pattern 1.

## Licence

Apache-2.0, see [`LICENSE`](LICENSE) — this directory only. The repository around it
is AGPL-3.0-or-later, which is what the root [`LICENSE`](../../LICENSE) holds and
what the root README says. The boundary is a rule about imports rather than a field
in a manifest: nothing here may import anything else in this repository, and
[`test/licence-boundary.test.ts`](test/licence-boundary.test.ts) is the check under
that.
