# ADR 0061 — A submission is an issue, and CI makes the pull request

Status: accepted, 2026-09-23, decided with the product side, **built in the same pull
request**. It carries out [ADR 0058](0058-the-workbench-holds-no-power-and-github-is-who-you-are.md)
§1 and revises its §2.

## Context

ADR 0058 §2 decided how a change leaves the published workbench, and #246 built it:
**Änderungen einreichen** put the document on the clipboard and opened GitHub's editor for
`packages/app-core/src/data/home.layout.json`, and a panel listed three steps for github.com.
Paste over the whole file, commit to a new branch, open a pull request.

The product owner's verdict on it, in his words translated: copying the text and expecting
the newsroom to submit it as a pull request that way "is not reasonable for less technical
people". What he asked for is one click that does the rest. He asked whether that can be a
pull request directly, and pointed at the way he solved the same problem in Learn6502: one
click on "share example" opens an issue, and CI turns the issue into a pull request. He also
asked that the translations could travel the same way, if the way is simple and still works
well.

**A pull request cannot be opened from the browser without a credential.** Creating a branch,
a commit and a pull request are three authorised API calls, and ADR 0058 §1 says the
workbench holds no credential and performs no authorised write. That decision stands, and it
was measured rather than assumed. What does not need a credential is *navigating* to
GitHub's own new-issue page with the title and body already filled in, and a workflow in
this repository already holds a token. The Learn6502 workflow
(`.github/workflows/issue-to-pr.yml` there) is the proven shape, and this record ports it.

### What was measured, 2026-09-23

| Asked | Answer |
| --- | --- |
| How long may a prefilled `issues/new` address be, signed out? | GitHub redirects it to `/login?return_to=` with the whole address encoded a second time. That login address answers `500` from about 7000 characters, which a JSON body reaches at an issue address of about 4650 |
| And the issue address itself? | Answered with that redirect (`302`) up to 7000 characters, `500` at 7500 and 8000, `414` from 9000. What a signed-in person is served was not measured, since that needs a session |
| How long is the issue for a realistic edit? | 3047 characters with the document as the printer writes it, 2084 with it on one line: a move, a switch, a pin and a new moment on the shipped document. For the shipped day alone the document takes 2112 encoded characters printed and 1320 on one line, with three editions 3890 and 2420 |
| How is `ci.yml` started? | `pull_request` of every kind, and `push` to `main` only |
| Does a pull request opened by a workflow start it? | Not with `GITHUB_TOKEN`: GitHub starts no workflow for an event that token caused. `sources.yml` found this out and runs the gate itself for that reason |

## Decision

### 1. "Submit changes" opens a prefilled GitHub issue, and a workflow turns the issue into a pull request

One click on **Änderungen einreichen** opens GitHub's new-issue page in a new tab, with the
title and the whole change already in it. The person clicks GitHub's own **Create**. From
there `.github/workflows/submission.yml` does what the three steps used to ask for: it reads
the change out of the issue, checks it, commits it on a branch of its own, opens the pull
request, and writes on the issue where the pull request is. The merge closes the issue.

**GitHub keeps one click for itself, and that is correct.** Nothing on a page may press
"Create" for somebody. That click is the person saying, signed in as themselves, that they
mean it; it is what makes the issue theirs and the commit authored by them. A page that could
take it away would be a page holding their session.

The button is a **link styled as a button**, so the browser opens the tab without a popup
blocker in the way. It is disabled, as a button, while the document equals the file. The
panel says in one plain line under it what will happen: GitHub opens with the change filled
in, one click on "Create" submits it, a GitHub account is needed. The longer account, the
workflow and the two records, is behind the ⓘ beside it. The steps panel goes.

The dev server's **Save** is unchanged and still not an exception to ADR 0058 §1.

### 2. The first kind is the home layout, judged by the core and written by the workbench's printer

The issue carries the document in one fenced `json` block. The workflow refuses, with a
reason in German on the issue:

- a body without the block, and a body with two, because choosing one of two is choosing for
  the person;
- a payload over `HOME_LAYOUT_MAX_CHARS`, 256 KiB, the bound the app itself refuses a
  document over (`packages/app-core/src/stores/homeLayout.ts`, which carries the argument).
  GitHub caps an issue body at 65,536 characters, so this cannot bite today; it is the app's
  own bound because a document the app would refuse unread has no business being merged;
- a block that is not JSON, and a document `parseHomeLayout` reads with any problem at all,
  which is the same strictness as `packages/app-core/scripts/check-home-layout.ts` and for
  its reason: a problem means a document nobody meant to write;
- a module the app cannot draw. The parser is handed the workbench's `MODULE_LABELS` keys as
  the renderable set, which `test/preview/home-document.test.ts` holds to the app's
  `HOME_MODULES` in both directions. The deploy's check cannot do the same, because the core
  does not know that set (ADR 0036 §14), so this is the one place a misspelt module is caught
  before a reader's app draws past it;
- an id holding a line break or another control character, which the core's parser now
  refuses everywhere with a code of its own, `id-unsafe`, reporting where it stood and never
  what it said. No writer this repository has mints such an id, and the only use for one is
  to smuggle lines into a place ids are printed, which §7 is about;
- a document equal to the file, because there would be nothing to review.

What it writes is the parser's reading printed by `formatLayoutDocument`, the printer the dev
server's Save already writes with and which `test/preview/home-document.test.ts` holds to
oxfmt. So a key the parser does not know does not reach the repository, and the file is
formatted as the repository's formatter prints it; the workflow then runs the deploy's own
check and `oxfmt --check` over the written file, and asserts that it is the only file that
changed. It writes `packages/app-core/src/data/home.layout.json` and nothing else, on
`submissions/issue-<n>`, force-pushed because the branch is the workflow's alone and a retry
rebuilds it from the issue.

The commit is **authored by the person who opened the issue**, at the noreply address GitHub
gives every account, and committed by the workflow. The history then says who made the change
without publishing a mail address.

The pull request is titled plainly in German, "Startseite: Änderung aus Issue #n", and its
body says in German what changes: which blocks were moved, switched, added or removed, which
setting now holds what (a pin by the article's title), which moments and editions were added,
changed or dropped. **The summary is derived from a diff of the two parsed documents rather
than from the issue's prose**, because the prose is whatever somebody left in it and the diff
is what will be merged. That makes it truthful and not harmless: the document is the issue's
text too, and every string in it that reaches the summary is treated as §7 says. A moved
block is one outside the longest order both documents share, so moving one block names that
block rather than every block it pushed along. Blocks are named as the editor names them, the
module's German name out of the workbench's catalogue and the id beside it. The list is
capped at 20,000 characters and says how many changes it left out, because GitHub refuses a
body over 65,536 with a 422, and the security review of #252 grew a summary past that.
`Closes #n` stands on its own line in English, because a German body closes nothing
(AGENTS.md).

**A document that parses can still empty the home screen**, and that is a document somebody
may well mean, so it is not refused. It is shouted: the summary opens with a bold German
warning when no block but the header and the loading notice is shown where the day starts or
after any moment, and when fewer than half of the blocks the file had are left. The reviewer
decides, and cannot miss that there is something to decide.

### 3. A submission's kind is its title prefix, and the kinds are a registry; strings are the second kind, named and not built

`apps/workbench/src/preview/submission.ts` holds the kinds, and both ends read it: the
workbench writes an issue with it and `apps/workbench/scripts/submission.ts` reads the issue
back. **The prefix is the kind**: in square brackets at the front of the title, lower case,
one German word, `[startseite]` now and `[texte]` next.

- **German**, because the newsroom reads the issue list, and a tag there should say what the
  issue is about in their words.
- **One prefix per kind** rather than one shared tag with the kind written somewhere else,
  because the workflow's `if:` then skips every other issue before a runner starts, and a
  person scanning the list knows what each one is.
- **Only in the title.** The body does not repeat the kind; a second place to say it would be
  a second place to disagree.

In the workflow's script each kind maps to the one file it writes and the function that
validates and prints it, in a table typed over the kinds, so a kind without an entry is a
compile error. A kind can be named with no way through yet; the workflow does not start for
it, and `test/submission.test.ts` holds the workflow's `if:` to exactly the kinds that are
built.

**Strings are the second kind.** The German catalogue in `packages/catalogue/src/de/` is
TypeScript with comments in it that are reasons left for the next translator, so a strings
submission does not replace a file. It would carry a JSON object of id to German. The
workflow would find each id's string literal in the catalogue's syntax tree with the
TypeScript compiler API and replace that literal alone, which is the write ADR 0056 §8
decided for the dev server; it would refuse an id the catalogue does not carry, which is
ADR 0056 §7's limit, and a German string whose placeholders are not the English one's or that
does not parse as ICU, which is ADR 0056 §8's validator. It is **not built here**. It is the
next step, together with ADR 0056's picker, which is what would produce the object.

### 4. It runs by itself for the organisation and its collaborators, and a maintainer starts it for anybody else

The repository is public, so anybody can open an issue with the prefix. The workflow runs by
itself only when the issue's author is an `OWNER`, `MEMBER` or `COLLABORATOR`, and that is
decided in the job's `if:`, so no runner starts for anybody else. Their issue gets one
comment, from a second job that may write comments and nothing more, saying that a maintainer
can start it; a marker in that comment keeps a stranger who closes and reopens the issue from
making the repository say it again.

**A maintainer starts it by hand for the text they read, not for whatever the issue says by
then.** The manual run takes the issue's number and the SHA-256 of its body, which the
outsider comment prints. An outsider can edit their issue between a maintainer's reading and
the run; the run hashes the body it fetched and refuses on a mismatch, telling the issue the
new value and asking for a second reading. The same manual run is the retry for a run that
failed, and every refusal on the issue carries the current value for it. The first step also
checks the title's prefix, because a manual run can name any issue.

The content is not harmless merely because it is parsed rather than executed. It can write
one file, and the merge is still the lock (ADR 0058 §2), but what it says can reach a pull
request's body, which GitHub reads for instructions, and the seventh decision here is about that. What the gate is for is
that the workflow holds a write token and spends the organisation's CI minutes, and a public
issue tracker should not be a way for strangers to make this repository open pull requests or
write comments on demand. An outsider's proposal is still welcome and still reaches the same
review; it waits for one person to say it should.

### 5. The pull request gets CI with a token held by CI, and says so when it does not

A pull request opened with `GITHUB_TOKEN` starts no workflow, so `ci.yml` would never see a
submission. **With the secret `SUBMISSIONS_TOKEN` set**, the push and the pull request use it, and
`ci.yml` runs as on any pull request a person opens, including on a retry's force-push. The
token is CI's, stored as a repository secret; the workbench never sees it, which is ADR 0058
§1 intact.

**Only the two steps that write to GitHub as the repository get it.** The checkout keeps no
credential in `.git/config` (`persist-credentials: false`), the push hands its token to git
in its own step, and `npm ci` runs with `--ignore-scripts`, so no install script from the
registry ever runs where a token that can push could be read. Measured on 2026-09-23: `tsx`,
`oxfmt` and the core's check all run on an install made without scripts. Every action is
pinned by commit, with its version in a comment beside it.

**Without the secret** the workflow falls back to its own token, which is the state this
record is merged in. It then runs the two checks the file it wrote can break, the core's
parser and `oxfmt --check`, and the pull request's body opens with a plain German note that CI
has not run, what was checked instead, and that closing and reopening the pull request starts
it. That reopening is a person's event and therefore starts `ci.yml`.

### 6. The address has a limit, and past it the change goes by the clipboard

The workbench opens the prefilled address only while it is at most **4000 characters**. The
measurement above sets it: signed out, GitHub's login redirect carries the address a second
time and fails at an issue address of about 4650, and a person from the newsroom may well not
be signed in when they click. The address alone is taken to 7000. 4000 is under the lower of
the two, with room for a longer title.

The document travels **on one line**. The printer's indentation cost more than a third of the address for the shipped day (the table above), and CI prints the document again anyway, so
what reaches the repository is formatted either way. One line of JSON is still readable to a
maintainer deciding about an outsider's issue, which is why it is not compressed as well:
gzip would make the issue unreadable and would need a bounded inflate in CI.

Past it, the link carries the title and a German sentence in place of the body asking the
person to paste, and the same click puts the whole body on the clipboard, as Learn6502 does.
The panel says so before the click, in the line under the button, and afterwards says whether
the clipboard took it; if the browser refused, the text is offered in a field to copy by hand.
The copy is the synchronous `copy` command inside the click rather than `navigator.clipboard`,
because the new tab takes the focus in the same click and the asynchronous clipboard refuses a
document that is no longer focused.

The documents with editions ADR 0059 plans will cross 4000 sooner than the day alone does.
That is what the fallback is for, and it costs one paste.

### 7. Nothing the issue says reaches a shell or a script as code, or GitHub as an instruction

The title and the body are text anybody can write. `${{ … }}` inside a `run:` or a `script:`
is pasted in before the shell or the JavaScript is parsed, so a title could become code. So
the workflow fetches the issue with the API and writes the title and the body to files, only
the Node script reads those files, every value a step needs arrives through `env:`, and no
`run:` or `script:` in the file contains an expression at all. The title appears in an
expression once, in the job's `if:`, which GitHub evaluates and no shell sees.
`test/submission.test.ts` reads the workflow and holds all of it, because this is the mistake
that looks right in review.

**The pull request's body and the comments are the second place text is read as
instructions.** GitHub closes an issue for `Closes #1` anywhere in a body, notifies a team for
`@team`, and hides everything after `<!--`, the real `Closes` line included. The security
review of #252 got all three through an edition's id and title. So every string out of the
document that is printed, an id, a title, a pin, and the JSON parser's message, which quotes
the input, goes through one function, `plain` in `apps/workbench/scripts/submission.ts`: it
collapses every run of whitespace into one space, drops control characters, caps the length,
swaps `#`, `@`, `<`, `>` and the backtick for look-alikes GitHub does not act on, and the
result is printed inside a code span. The review's inputs are kept as tests.

## Why not the alternatives

**A pull request from the browser.** Needs a credential in the page, which ADR 0058 measured
and rejected for where it would live.

**Keep GitHub's editor and the clipboard.** Built in #246, and the product owner's verdict
above is the reason: three steps on an English interface, a paste over a whole file and a
branch dialog are exactly the parts a newsroom should not have to know.

**Labels instead of a prefix.** A `labels=` parameter on the new-issue address is applied only
for somebody who may triage the repository, so it would silently not be there for the people
this is for.

**Issue forms.** A form gives the body fields of its own, which buys nothing when the body is
written by the workbench and read by a script. Worth knowing before somebody adds templates:
with `blank_issues_enabled: false`, `issues/new` is expected to send a person to the template
chooser instead of the prefilled page, which would break this. Not measured, because it needs
a template on the repository.

**A server or a GitHub App that opens the pull request.** It would hold a secret on behalf of
people; ADR 0040 §4 wants a record of its own for a server, and §1 above makes one
unnecessary.

## What this retires

**ADR 0058 §2, its heading and its mechanism.** "copies the document and opens GitHub's
editor for the file" in the heading, and in the body that it "puts the formatted document on
the clipboard and opens GitHub's editor" where the person "pastes, commits to a new branch and
opens a pull request", and that somebody without write access "is offered a fork and 'propose
changes' by GitHub itself". The action, its name, its place in the panel and that it is
disabled while unchanged stand; so does "The merge is the lock". "What the paste replaces is
the whole file" stands in substance, since the workflow writes the whole file too, and is left
as written.

**ADR 0058 §2, "The clipboard and not `?value=`".** Its closing "The clipboard has no ceiling
and depends on nothing undocumented. It costs one keystroke." The argument about `/edit/`
before it is left standing as the reason that route was not taken.

**ADR 0058, "Why not the alternatives", on `?value=`.** "If somebody signed in finds that
`/edit/` honours it, it can be added beside the clipboard without taking the clipboard away."

**ADR 0058, "What is still open", item 3.** "`?value=` on `/edit/`, one click for somebody
signed in. If it works, the paste goes."

ADR 0058's status line said "Not built" and now says what was built; that is a status and not
a claim, and it is not struck.

Read and left standing: ADR 0058 §1, which this carries out, and §3, which is why the commit
can be authored by a real account. ADR 0036 §15's "the configurator writes a file into the
repository, as a pull request" is still what happens, with CI writing it. ADR 0059's "Submit
changes works as it does" describes that record's first slice and is not false.

## What is still open

1. **`SUBMISSIONS_TOKEN`.** Not created by this record. Either a fine-grained personal access
   token of a machine account, scoped to `correctiv/correctiv-app` alone, with **Contents:
   read and write** and **Pull requests: read and write** (Metadata: read comes with them), or
   a GitHub App installed on the repository with the same two permissions, whose token a step
   would mint with `actions/create-github-app-token`. Issues permission is not needed, because
   the comments are written with the workflow's own token. With a personal token the pull
   request is opened by that account; with an App, by the App.
2. **Whether GitHub reports `MEMBER` for somebody whose organisation membership is private.**
   Not measured. If it does not, their issues wait for a maintainer, which fails the safe way;
   making the membership public, or adding them as collaborators, would be the answer.
3. **The strings kind** (§3), with ADR 0056's picker.
4. **A first real run.** Nothing here was run against github.com, because opening issues on
   this repository to test it was not wanted. The steps were run locally in a throwaway clone
   installed with `npm ci --ignore-scripts`, with the scripts' GitHub calls faked, and the
   workflow passes `actionlint`.
5. **The editions' days are not checked for emptiness.** §2's warning reads the day and its
   moments; an edition that switches everything off for its span passes without one.
