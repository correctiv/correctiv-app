# ADR 0043 — Two concepts become packages, and the shell stays

Status: accepted, 2026-09-17, from the architecture meeting in
[#200](https://github.com/correctiv/correctiv-app/issues/200) and the survey it asked for.
**One of the two packages in §1 is built**, the smaller one: the checks that hold prose
to code are [`packages/prose-and-code`](../packages/prose-and-code), Apache-2.0, used
from this repository and not published. The decision-record package is **not built**.

## Context

Four of the meeting's notes ask one question from four sides:

> Workbench could be deprecated in favour of a standard tool
> … or even shared with the world so it can be used by others
> Can we use a standard documentation library instead of our own?
> How can we incorporate the generated ADR diagrams into other projects?

The question is: **what here is general, and what is ours?** A decision to build something
is only worth having if it says what it looked at and declined, so the survey is the first
half of this record and the decision is the second. Everything below was surveyed on
2026-09-17, and a survey of a live ecosystem is a reading rather than a standing fact.

### Already covered, so not ours to build

**Design tokens.** Style Dictionary exists, is Apache-2.0, is actively released, and is
framework-agnostic by construction — it takes token files and emits whatever a platform
wants. [ADR 0010](0010-design-tokens-as-a-shared-package.md) already made the tokens a
package and [ADR 0022](0022-three-tiers-of-colour-and-a-dark-scheme-that-names-roles.md)
vendored upstream's values into it; the generator in the middle is the part somebody might
have thought worth extracting, and it is published, maintained, and better than ours would
be.

**The extraction half of source-generated documentation.** TypeDoc's `--json` and
`@microsoft/api-extractor`'s doc model are real, maintained, framework-independent
extractors. This is not a survey finding so much as a description of the tree: the
workbench's reference is TypeDoc already, run as a data extractor and nothing else —
`apps/workbench/scripts/api.mjs` says so in its first paragraph, `--json` only, no HTML, no
theme, because a generated documentation site "would have arrived with its own navigation
and its own design, and the generated pages would have become the front door by accident".

So the answer to "can we use a standard documentation library instead of our own" is that
for the half a library covers, we already do. What is ours is the rendering, and §7 below
is about that.

### Two genuine gaps, which nobody publishes

**1. A claim inside a decision record being voided by a later record.** Every ADR tool
surveyed — adr-tools, adr-viewer, log4brains, Backstage's ADR plugin, and MADR itself —
treats a record as an opaque page with one status field: proposed, accepted, superseded.
The unit is the document. Of the three closest, two had gone roughly twenty-one months
without a release when this was measured.

What this repository does is finer than that and is the thing the field does not have:
decisions numbered **inside** a record so `ADR 0026 §6` still points at the same decision
in a year, an append-only ledger of every text a number has carried, and a claim struck
where it stands with a clause naming what voided it. `adr/README.md` and
`apps/workbench/plugin/decisions.ts` are that model; nothing published has a concept for
it.

**2. Checks that hold prose to code.** Nothing exists beyond link checkers and snippet
runners. Nobody publishes "extract this number from this sentence, compare it to what the
code says, fail with a diff" — which is what
[`apps/mobile/__tests__/tokens.test.ts`](../apps/mobile/__tests__/tokens.test.ts) does to
the sentence in `AGENTS.md` about `always-light`, and what
`apps/workbench/test/decision-numbers.test.ts` does to the sentence in `adr/README.md` that
says how many records there are.

### Declined: Backstage

It would cover parts of both. The cost is a Node backend, a mandatory Postgres, its own
auth, and a roughly monthly breaking-change cadence: a whole second React product, run in
order to document projects that are mostly Vue, with plugins that do not work outside its
shell. [ADR 0040](0040-the-app-does-not-depend-on-the-workbench.md) §4 declined a server
for the app on the same day and for a related reason; a mandatory database to hold
documentation that is already in git is that answer from the other end.

## Decision

### 1. Two packages, in `packages/`, used from here first

One for the decision records: the model, the ledger, the strikes. One for the checks that
hold prose to code. Both live in `packages/` beside `app-core` and `design-tokens`, and
both are consumed by this repository before anybody else sees them.

The alternative — a separate repository from day one — makes every change to a check two
pull requests before there is any evidence the interface is right.

### 2. Published when a second project actually needs them, not before

**An interface nobody has used twice is not an interface yet.** Everything in here was
shaped by this repository's problems, and the parts that are secretly about us are
invisible until something else tries to use them. Publishing first would freeze the guesses
and hand us users who did not ask to be broken.

So the trigger is a real second project with a real need, not a date and not a tidy-up.

### 3. Apache-2.0, which is a constraint on the dependency graph and not a line in a manifest

The app is AGPL-3.0-or-later and stays that way. These two are Apache-2.0, because an AGPL
library is one most projects may not take, and the meeting explicitly asked for something
shareable.

The part that is easy to get wrong: a licence is a statement about what may be linked, so
**neither package may import `@correctiv/app-core`, `apps/mobile`, or anything else in this
repository that is AGPL**. An Apache-2.0 package that reaches into the core is Apache-2.0
in its manifest and something else in practice, and the first person to discover that will
be a lawyer at another organisation.

Neither may import the workbench either, for a plainer reason: a library that imports its
host is not a library. The workbench is the first user of both, and the traffic goes one
way — which is [ADR 0040](0040-the-app-does-not-depend-on-the-workbench.md) §1's rule
applied to a different pair.

### 4. The record package builds on our form and reads MADR as well, and the model travels while the drawing does not

**Both formats.** A project with existing MADR records has to see something on the first
run, or there is no first run. So the package reads MADR and shows what MADR can express,
and the claim-level strike is then visible as the thing that is *missing* — which is the
honest sales pitch and the reason somebody would move.

**The model travels, the drawing does not.** This answers the meeting's fourth note
directly. What another project can have is the model: records, numbered decisions, the
histories a number has carried, and the strike graph with its weights — the relation
`plugin/decisions.ts` calls `Strike`, "by", "of", and how many claims. What it cannot have
is `/diagrams/decisions`, because `src/diagrams/DecisionsChain.tsx` draws that out of
`virtual:docs`, the site's own colour tokens and the site's layout code. Another project
gets the data and draws its own picture, in its own house style, which is what it would
want anyway.

### 5. The checks package ships the patterns, not our assertions

Our assertions are about our colours, our German and our tokens; none of them travels. The
patterns do, and four are worth the package on their own:

- **The guard against a silently empty walk.** A source-reading check whose file list comes
  back empty passes everything. Every one of ours asserts that it read something first —
  `colour-tiers.test.ts`, `localisation-seam.test.ts`, `fixed-heights.test.ts`,
  `split-rows.test.ts`, `accessibility.test.ts`, the core's own seam test, and the
  decisions tests all carry a version of it.
- **The two-sided ratchet.** An excuse list asserted in both directions: a new violation
  fails, and an excuse whose violation has gone fails too, so the list can only shrink.
  [ADR 0031](0031-four-mechanisms-for-this-must-not-be-forgotten.md)'s "a ratchet is a debt,
  not a state" is the argument and `colour-tiers.test.ts` is the implementation.
- **Regenerate and compare.** For anything with a generator: run it now, compare with what
  is committed. `packages/design-tokens/test/drift.test.ts` and `tokens.test.ts` are the
  pair, and ADR 0031's mechanism 2 is why — forgetting the thing is a compile error,
  forgetting to regenerate is a red test.
- **Strip comments before scanning.** A prose rule applied to source hits its own
  explanation otherwise, which is how a check ends up excusing the file that documents it.

### 6. Two things deliberately not extracted, with the reason, so nobody re-derives it

**The device frame.** It is the third real gap, and the survey says so plainly: nothing
published frames a whole *running application* with its state, route, appearance and
viewport in the address. Everything out there is component-scoped or a paid cloud emulator.
We are still not extracting it, and the reason is specific: the valuable part is entangled
with React **in the framed app**, not in the workbench. The element picker walks React's
fibre keys, and against a Vue application it says nothing at all. A frame that cannot
inspect is a resizable iframe, and nobody needs a package for that.

**The GitHub workflows.** The note asked for them as shared libraries. They are too shaped
by this repository to travel: `ci.yml` decides whether a change can reach the native build
by this tree's path filters, and `pages.yml` assembles one artefact out of an Expo web
export and a Vite site and then greps the published bundle for strings that only mean
something here. Another project would spend longer adapting them than writing its own, and
the parts that are genuinely general — cancel-in-progress except on the default branch,
fetch the default branch before a check that compares against it — are three lines each and
travel as prose.

### 7. Our own shell stays

This is the answer to "Workbench could be deprecated in favour of a standard tool", and it
is no as things stand. The shell does three things no generator does: it frames the running
app, it draws the app's real components rather than copies
([ADR 0027](0027-the-handbook-draws-the-apps-components.md)), and it shows which claims
between records have been struck. The standard tools cover extraction, and extraction was
never the part we wrote.

**The packages travel; the shell does not.** That sentence is the shape of this whole
record: what is general goes out, what is about this project stays, and the line between
them is drawn once here rather than argued at every future request.

## Why not the alternatives

**Adopt Backstage anyway and live with the backend.** Covered above. The decisive part is
not the Postgres, it is that the plugins do not work outside its shell — so the work would
not be reusable by the Vue projects that asked for it, which was the entire point.

**Publish both immediately.** A version number, a changelog and strangers' expectations,
attached to two interfaces that have each had one user. §2 above.

**Keep everything internal.** The meeting asked for the opposite, and there is a second
reason: the discipline of making something extractable is what finds the places where a
general idea is quietly about us. That work is worth doing even if nothing is ever
published.

**One package instead of two.** They have different audiences. The record model is for a
repository that keeps decision records; the checks are for any repository that has both
documentation and code. Bundling them hands somebody who wants the second an ADR model they
do not use.

## What it costs

**Two more packages to keep, with a licence boundary nothing yet enforces.** §3 above is a rule
about imports, and there is no check under it today — an import of `@correctiv/app-core`
from either package would compile, pass and be wrong. That is named here rather than
implied, and it is the first check either package needs.

**A README for somebody who has never seen this repository.** The workbench's own
documentation can assume the reader is here. A package's cannot, and that is writing nobody
has costed.

**A second consumer changes the interface.** That is the point of §2 above and it is still a cost:
the first outside user will find something wrong, and fixing it will touch this repository
because this repository is the other user.

## What is still open

**What both packages are called.** Not decided, and it is not cosmetic: the name is the
first thing that says whether this is a CORRECTIV tool or a general one.

**Whether the record package owns the ledger or only reads it.** The append-only guarantee
here is enforced by comparing with `git show origin/main:adr/decisions.lock.json`, which
assumes git and assumes a default branch. A package may assume that, but it has to say so,
and a project on something else then gets the weaker half of the design. Nobody has decided
which side of that line the package sits on.

**Whether the record package ships a reference drawing.** §4 above says the model travels and the
drawing stays. Whether "stays" means "there is no drawing in the package at all" or "there
is a plain one that anybody would replace" is a real question about how a package earns its
first user, and it is not answered here.

**What counts as the second project.** The trigger in §2 above needs somebody to decide whether
another repository inside CORRECTIV is a second project or the same one wearing a different
name. That is a question about who maintains these, and nobody has been asked.

## What this retires

**Nothing is struck.**

[ADR 0010](0010-design-tokens-as-a-shared-package.md) was read and is untouched: the tokens
are a package of ours because they are *our* values, and the survey finding above is about
the generator, which we do not write.
[ADR 0027](0027-the-handbook-draws-the-apps-components.md)'s argument for rendering the app
rather than describing it is what the seventh decision above rests on.
[ADR 0029](0029-the-handbook-keeps-its-own-primitives.md) is the same instinct measured
once already — a capability examined and declined — and this record is four more of those
in one document.
[ADR 0031](0031-four-mechanisms-for-this-must-not-be-forgotten.md)'s ladder is what the
fifth decision above packages, and mechanism 4's four obligations are why the patterns are
worth shipping rather than the assertions.
