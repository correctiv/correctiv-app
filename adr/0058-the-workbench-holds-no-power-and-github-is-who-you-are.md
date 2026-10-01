# ADR 0058 — The workbench holds no power, and GitHub is who you are

Status: accepted, 2026-09-23, decided by the product side. **§1 holds; the first version of
§2 was built in #246 and [ADR 0061](0061-a-submission-is-an-issue-and-ci-makes-the-pull-request.md) revises it, built in the same pull request; §4 to §6 are not
built.** It answers how a
person's change reaches the repository, which
[ADR 0057](0057-the-structure-comes-from-the-workbench-the-selection-from-wordpress.md) left to
[ADR 0036](0036-the-home-screen-becomes-data.md) §15, and it names a private companion
repository and the rule it exists under.

## Context

ADR 0057 decided who writes what: the structure of the home screen in the workbench, the
choice of article in WordPress. It left the mechanics of the first to ADR 0036 §15, "the
configurator writes a file into the repository, as a pull request", which said of itself
that it "is the answer *while the configurator is ours*. It is not the answer for the
newsroom".

What exists today is two halves of that and neither whole. On a dev server, **Save to the
repository** posts the document to an endpoint that writes the developer's own checkout
(`apps/workbench/src/preview/home/write.ts`, `canSave` is `import.meta.env.DEV`). On the
published site, **Copy the document** puts it on the clipboard and a note tells the person
where it would have to go. Both sit under the whole list of blocks, at the bottom of the
panel.

The question put was whether saving could be put behind a login while the workbench stays a
GitHub Page, so that not everybody reaches the internal features. It was measured before it
was answered.

### What was measured, 2026-09-23

| Asked | Answer |
| --- | --- |
| May a browser on `correctiv.github.io` call `api.github.com`? | Yes, it answers with `access-control-allow-origin: *` |
| May it run GitHub's OAuth device flow? | No. `github.com/login/device/code` answers without any CORS header, to the request and to the preflight, so a static page cannot read the answer |
| Who else is on the origin? | The correctiv organisation has 53 public repositories publishing a Pages site, all under `correctiv.github.io`. `localStorage` belongs to the origin, not to the path, so every one of them reads what the workbench stores |
| What does the workbench render? | The repository's Markdown through `marked` with no sanitiser, into `dangerouslySetInnerHTML`. `Text <img src=x onerror="alert(1)">` comes out unchanged |
| How long may a prefilled GitHub editor address be? | With the document in `value`: up to 6000 characters accepted (`302`), 7000 answered `500`, from 10000 on `414 URI Too Long` |
| How long is the document? | 1058 bytes, 2112 characters once URL-encoded |

Two of those decide most of this record. A credential in the page would live on an origin
shared with 52 sites whose JavaScript nobody here reviews, and would be one Markdown change
away from anything injected into the page itself. And GitHub already offers everything the
login would have been for, without the page ever holding anything.

## Decision

### 1. The workbench holds no credential and performs no authorised write

Every act that needs authorisation leaves the workbench by navigation, to a place that
already knows who the person is. The workbench shows, arranges and prepares; it never
writes on anybody's behalf.

The dev server's Save is not an exception. It writes the developer's own checkout on their
own machine, it does not exist on the published site, and it needs no more authority than
the developer's editor has.

What follows is that **nothing on the published workbench is sensitive**, because nothing
in it can do anything, so there is nothing to put behind a login. The question this record
was asked does not get a login as its answer; it stops having an object. It also gives the
future a test rather than a discussion: a function that needs authorisation does not belong
in the workbench, it belongs where an identity system already stands.

This is a stronger statement than [ADR 0040](0040-the-app-does-not-depend-on-the-workbench.md)
and does not contradict it. ADR 0040 says the app may not read the workbench. This says the
workbench may not act.

### 2. "Submit changes" ~~copies the document and opens GitHub's editor for the file~~, voided by [ADR 0061](0061-a-submission-is-an-issue-and-ci-makes-the-pull-request.md) §1

The primary action of the home configurator is **Submit changes**, in German *Änderungen
einreichen*. It is offered on the published site and on a dev server alike, is disabled
while the document equals the file, and sits where the panel is read rather than under the
list. ~~It puts the formatted document on the clipboard and opens GitHub's editor for
`packages/app-core/src/data/home.layout.json` on `main`. There the person, signed in to
GitHub, pastes, commits to a new branch and opens a pull request. Somebody without write
access is offered a fork and "propose changes" by GitHub itself, which is exactly the review
this repository wants and costs nothing to build.~~ Voided by [ADR 0061](0061-a-submission-is-an-issue-and-ci-makes-the-pull-request.md) §1: it opens a prefilled
GitHub issue, and a workflow turns the issue into the pull request.

**The clipboard and not `?value=`.** A prefilled address works for a new file, and the
measurement above says how far: the document fits today with room for about three times
itself. But the file exists, so the editor needed is `/edit/`, whether `/edit/` honours a
prefill is not measured (it sits behind a sign-in), and a ceiling that moves with the
document is one more number that goes wrong quietly. ~~The clipboard has no ceiling and
depends on nothing undocumented. It costs one keystroke.~~ Voided by [ADR 0061](0061-a-submission-is-an-issue-and-ci-makes-the-pull-request.md) §6, which prefills
an issue address up to a measured limit and keeps the clipboard only past it.

**What the paste replaces is the whole file.** A change that reached `main` after the page
was built shows in the pull request's diff, which is where it is caught. That is the review
doing the job it is there for, not a gap in it.

**The merge is the lock.** The published document comes from `main` (ADR 0057 §4). An
account that is misused can open a pull request and cannot make it reach a reader. That is
the one defence that survives a lost password, and it was already there.

### 3. GitHub is the identity and permission system, and an account per person is the price of running none

A GitHub account for every person who submits is a benefit and not a hurdle. GitHub then
carries what would otherwise be built and operated here, and each of these is a thing
self-built systems get wrong:

- **Authentication**, including a two-factor requirement set for the whole organisation and,
  depending on the plan, sign-in through the organisation's own identity provider.
- **Authorisation** that is already modelled: write access, branch protection, CODEOWNERS,
  required review.
- **A record** nobody can falsify. Every change carries a name for good.
- **Offboarding** that works. Removing a person from the organisation takes everything at
  once.

And this repository holds **no personal data** as a result: no accounts, no passwords, no
sessions, nothing that would have to be deleted on request.

What an account does not give is an **interface**. An editor with an account still commits
JSON, and that is the whole of the argument left for the WordPress plugin in ADR 0057 §5: it
used to be half about access and is now only about what a person has to look at.

What GitHub does not give either, unless the organisation's plan includes rulesets that
restrict paths, is **permission by file**. Without them, whoever may write may touch any
file, and what stops a wrong change is the review rather than a permission. For this path
that is enough, because every change is reviewed. It should not be mistaken for access
control.

### 4. The open repository is complete, and the private companion is optional

[`correctiv/correctiv-app-private`](https://github.com/correctiv/correctiv-app-private) was
created on 2026-09-23, private, for what must not be public before it is published. Its
README states the rule it exists under, and this record is where the rule is argued:

**The open repository builds, tests and ships without the companion.** Absence is the
normal case, and it is the case that is checked. A private half that the build needs is the
first argument for closing the other half, and the app is open source.

**The check that holds this arrives with the first thing that reads the companion**, not
before. Today nothing reads it, so a check written now would pass on nothing, which is the
failure `packages/prose-and-code` has a floor against. Its shape is known: the
`independence` job in `ci.yml` removes `apps/workbench` from the checkout and rebuilds the
app, and the companion's check is the same job without the companion.

### 5. What may go into the companion, and what never

Into it: material that must not be public before it runs. **Editorial planning** is the case
that exists — a place pinned to an article at a future moment is tomorrow's plan, and a pull
request in the open repository would publish it hours early. After ADR 0057 §2 the structure
of the screen is not this; it names no article. Beside it, scenarios carrying unpublished
material (ADR 0036 §11 to §13), and release material that is not a secret but is not for the
public, such as a draft store listing.

Never into it:

- **Code.** A module that lives there is one nobody outside can read, review or run, and
  then "open source" is a label rather than a fact. Something that has to be private to work
  is designed wrong.
- **Secrets.** A private repository is not a secret store. Keys belong in GitHub Secrets or
  the password manager.
- **Anything from an investigation**, and anything touching source protection or personal
  data. The companion is the app's, not the newsroom's archive, and a repository drifts
  towards whatever is put in it.

### 6. The open repository reaches the companion by a fetch in CI, not by a submodule

For material that changes often, which editorial planning does:

| | Submodule | Fetch in CI with a secret |
| --- | --- | --- |
| Works without access | the step is skipped and the directory stays empty | the secret is absent and the step does not run |
| Switching it on | access plus `git submodule update --init` | **setting a secret**, no change to code |
| A change in the companion | the pointer moves, which is a pull request in the open repository that also says *when* | nothing; the next build takes the current state |
| A reproducible build | yes, which is its whole advantage | no |

A submodule stays the right tool where a pinned state is the point, a release build for
instance. Nothing of that kind exists yet, so there is no submodule yet either.

## Why not the alternatives

**A token pasted into the workbench.** It works without a server, because `api.github.com`
admits any origin, and it was the first proposal. What rejected it is where it would live:
`localStorage` on an origin shared with 52 other sites, plus the Markdown path into the page
itself. How bad a theft is depends entirely on the token — a fine-grained one scoped to one
repository and `actions: write` could open a pull request and nothing else, a classic one
with `repo` would reach every repository its owner reaches. But §2 needs no credential at
all, and a smaller risk is worse than none.

**The OAuth device flow, or a GitHub App.** Both are better for a person than a pasted token
and both need a thing that holds a secret, because the device-flow endpoint admits no
browser (measured above). That is a server, and ADR 0040 §4 wants a record of its own for
one. §1 makes it unnecessary.

**Hiding the workbench.** Pages with access control exist only under GitHub Enterprise
Cloud, and making the repository private would not hide the site. §1 makes it pointless
anyway: there is nothing behind the door.

**Prefilling the editor with `?value=`.** Kept out of §2 for the reasons given there. ~~If
somebody signed in finds that `/edit/` honours it, it can be added beside the clipboard
without taking the clipboard away.~~ Voided by [ADR 0061](0061-a-submission-is-an-issue-and-ci-makes-the-pull-request.md) §1, which no longer opens the editor.

## What this retires

**ADR 0036 §15.** "It is not the answer for the newsroom, and that is the open question" is
struck. With an account per person (§3), the pull request is the newsroom's answer as well,
opened by the editor rather than by us (§2).

**ADR 0036, "What is still open".** Its closing "§15 is the answer for as long as we are
the ones editing. §1 is what keeps that from becoming permanent by accident" is struck, for
the same reason as the sentence in ADR 0036 §15.

**ADR 0050, Context.** "The two questions that would settle ownership — who signs in, where
the configuration lives — are open and not cheap" is struck. §3 answers the first and
ADR 0057 §4 the second. The quotation of ADR 0036 §15 in the same paragraph stays as it is:
it is what 0036 said when 0050 was written.

**ADR 0039, "What is still open".** Its first item's "unchanged, and still ADR 0036's open
question" is struck together with ADR 0057, which carries the note.

Read and left standing: ADR 0036's context, "The moment the newsroom works in it, it is a
production tool with production requirements". §1 moves the requirements that sentence was
about to GitHub; whether an interface for the newsroom is a second product is still a fair
question, and it is ADR 0057 §5's.

## What is still open

1. **The organisation's plan.** Whether editors get seats, whether sign-in goes through the
   organisation's own identity provider, and whether rulesets that restrict paths are
   available. None of it changes a decision here; each changes what §3 is worth.
2. **Whether members may keep creating private repositories.** The companion was created by a
   member. That this was possible is a setting of the organisation, not a decision of it.
3. ~~**`?value=` on `/edit/`**, one click for somebody signed in. If it works, the paste goes.~~
   Voided by [ADR 0061](0061-a-submission-is-an-issue-and-ci-makes-the-pull-request.md) §1: the paste went another way, and the editor is no longer opened.
4. **The companion's first consumer**, and with it the check from §4. The planning of future
   moments is the obvious one.
