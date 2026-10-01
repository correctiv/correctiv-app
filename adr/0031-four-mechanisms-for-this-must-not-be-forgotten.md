# ADR 0031 — Four mechanisms for "this must not be forgotten", strongest first

Status: accepted, 2026-09-16. Rewritten the same day after review: the first version was
a style guide for one kind of test and could not itself fail, which is the thing it
warned about. What follows is the ladder it should have been.

## Context

This repository keeps arriving at the same problem in different clothes. A component is
added and nobody puts it in the overview. A German string is written outside the
catalogue. A screen reaches for `bg-white` where it meant `bg-canvas`. A fourth error
code arrives with no wording. An error is caught and swallowed.

Every one of those is the same shape: **a thing that must happen, and nothing that makes
not happening fail.**

Six source-reading tests exist to catch some of them. They work, and writing more of them
was starting to look like the answer. It is not, and the reason is the point of this
record: **a test is the weakest of four mechanisms and it is the one people reach for
first**, because it is the one that needs no design.

## Decision

Four mechanisms. Each is stronger than the one below it, and a rule goes as high up this
ladder as it can. "Would a test catch it" is the last question to ask, not the first.

### 1. Mechanism 1 — make it a type error

Where the set is closed and TypeScript can see it, an exhaustive `Record` makes an
omission a compile error:

```ts
export const AUDIO_ERROR_LABELS: Record<AudioError, CoreMessage> = { … };
```

A fourth member of `AudioError` and this stops compiling until somebody writes the
wording. No list, no test, no reviewer.

Already here three times: `AudioError` + `AUDIO_ERROR_LABELS`, `SignInFailure` +
`FAILURE_LABELS`, `Record<TypoVariant, TextStyle>`. A fourth arrived with ADR 0032:
`errors` is required on `CorePlatform`, so a host that does not wire the error reporter
does not build.

This is the cheapest mechanism and the most often missed, because it needs the set to be
named as a type before anybody notices there is a set.

### 2. Mechanism 2 — generate the type from the world

Most of what must not be forgotten is not a union somebody typed. It is the filesystem,
the token source, the route tree. TypeScript cannot read a directory. **A generator can,
and then mechanism 1 applies.**

The shape is: a generator emits a union, a hand-written table is `Record<ThatUnion, …>`,
and a drift test asserts the committed generated file still matches what the generator
produces now.

That last part is what closes the obvious hole. Forgetting the thing is a **compile
error**; forgetting to regenerate is a **red test**. Neither needs a list of exceptions
and neither can be widened at four in the afternoon.

The repository already generates `tokens.generated.ts`, `typography.generated.ts` and the
handbook's API, and `tokens.test.ts` already carries the drift check. What it does not yet
do is close the loop into a `Record`. **The component catalogue is the first candidate**:
`ComponentId` generated from `src/components/**`, `gallery/catalogue.tsx` typed against
it, and a new component then fails to compile rather than failing a test somebody has to
have written.

### 3. Mechanism 3 — take the primitive away

Where the rule is "do not use X directly", the answer is to make X unreachable and offer
the thing that cannot be got wrong.

`Button` takes `title: string`, so there is no button without a label. That is not a
convention; it is the only way to build one.

The same move is available and unused elsewhere. A `Tappable` whose props demand a name
would turn "every control has an accessible label" from a test into a type error. Typed
class names would do it for the colour tiers. Both are real work and both are stronger
than the tests that stand in for them today.

The cost is a wrapper nobody can bypass, which is also the benefit, and the failure mode
is a wrapper so awkward that people reach around it. That is a design problem, not a
reason to skip the mechanism.

### 4. Mechanism 4 — read the source, and only for what no type can see

Some facts are structurally invisible to the type system. German characters in a file.
An import of a platform SDK. A CSS rule in a built artefact. A class name assembled from
strings.

Those need a test that reads the source or the output. Six exist. They are the last
resort and they are worth having, and **they come with obligations the three mechanisms
above do not have**, because they are lists and lists rot:

**An exception carries its reason, not just its path.** `localisation-seam.test.ts` began
as thirty-six entries under `NOT_YET_MIGRATED` and was unreadable — thirty-six paths say
nothing about which is a debt and which is a fact. It is two entries now, each carrying
its argument, and the constant's name changed with it. Thirty-six entries want the words
"not yet"; two want the word "because".

**It says what it cannot see, at itself.** Every one of these is a partial net that looks
total from outside. The umlaut net does not see "Suchen". The colour check does not see
`colors.white` reached by dot access. So the limits are written beside the assertions,
where somebody reaching for a bypass will meet them — not in a document, because that is
not where that person is looking. This is not modesty: on 2026-09-16 a review found
German already shipping in the very file a change rewrote, `'● LIVE · 24/7 aus Bottrop'`,
which has no umlaut. The limit had been named the day before, and naming it is what made
it findable.

**A check that cannot fail is deleted.** Two were written and removed on one day: one
asserted a cascade property that held against the broken stylesheet and the fixed one
alike. Every check is proved by breaking it — write the violation, watch the suite stay
green, apply the check, watch it fail, and put the failure message in the commit. A
failure message nobody has read is a check nobody can act on.

**A ratchet is a debt, not a state.** A list asserted in both directions is right when the
end state is far away, and it rots pleasantly: green every day while the number stands
still. So it is written to shrink, and when it stops shrinking the honest answers are to
finish it or to admit it is permanent and write the reason.

## How to use this

When something must not be forgotten, walk down:

1. Is the set closed and nameable as a type? → `Record<Union, …>`.
2. Is the set out in the world? → generate the union, then 1, plus a drift test.
3. Is the rule "do not use X"? → remove X, provide the safe thing.
4. Only now: a test that reads source or output, with the four obligations above.

Three of the six existing checks are standing lower than they need to. The component
catalogue belongs at mechanism 2. Accessible labels and the colour tiers belong at
mechanism 3. The other three — German outside the catalogue, the core's imports, the dark
values in the built CSS — are mechanism 4 and stay there, because no type can see them.

## What this does not decide

**Whether a thing is worth a mechanism at all.** These are not free. Mechanism 2 is a
generator plus a drift test; mechanism 3 is a component and a migration. The test is the
one AGENTS.md already gives: *can it fail?* If the answer is no, do not write it, and do
not write a document about it either. That is the mistake the first version of this record
made.

**How many mechanism-4 checks are too many.** Six is affordable. The tax is not the
running time, it is that each list has an owner, and a list nobody owns gets widened by
whoever is blocked by it. Moving three of them up the ladder is the answer to that
question, which is why the ladder exists.

## What it retires

Its own first version, of the same day, which is in this file's git history. Nothing was
wrong in it; it was filed under the wrong idea. Its four rules survive as the obligations
of mechanism 4, which is where they belong and all they ever covered.
