# ADR 0062 — The texts submission may change wordings, and nothing else

Status: accepted, 2026-09-24, **built in the same pull request**. It carries out
[ADR 0061](0061-a-submission-is-an-issue-and-ci-makes-the-pull-request.md) §3's strings
kind, which that record named and deferred, and gives the published site the way out that
[ADR 0056](0056-a-string-is-picked-where-it-renders.md) left to it. Not run against
github.com; see what is still open. Its decisions 4, 5 and 7 to 9 were revised in the same pull
request after a cold security review of #263, before anything merged.

## Context

ADR 0061 built the home layout's submission: the published workbench opens a prefilled
GitHub issue, and `.github/workflows/submission.yml` turns it into a pull request. It named
`[texte]` as the second kind and said what it would do: carry a JSON object of id to
German, find each id's literal in the catalogue's syntax tree, replace that literal alone,
refuse an id the catalogue does not carry and a wording whose placeholders are not the
English one's. The strings tool of ADR 0056, built in #259, produces exactly that object,
and on the published site it offered only "Änderungen kopieren" and a sentence saying that
submitting was not built.

Two things in the home kind's workflow do not carry over.

- **It asserted that exactly one file changed**, in shell, against a path out of a step
  output. A strings submission touches one file per id namespace it rewords, so that
  assertion either goes or is loosened, and loosening it is where a submission starts being
  able to write more than it should.
- **Its payload was judged by a parser and printed again**, so what reached the repository
  was the printer's text and never the issue's. A catalogue file is not reprinted
  (ADR 0056 §8): the issue's wording lands in the file verbatim, inside a TypeScript string
  literal. That is text anybody on the internet can write, becoming source code in a file
  the app imports.

### What was measured, 2026-09-24

| Asked | Answer |
| --- | --- |
| How long is the German in the catalogue? | 320 ids; the longest wording 226 characters, the median of those over fifteen characters 28; the longest id 38 |
| Does any wording hold a control character, a line or paragraph separator, a direction mark, a zero-width character or a byte-order mark? | None, in the German and in the English |
| How long is the issue address for a realistic rewording, each wording reworded by a few words? | 614 characters for one, 1339 for five, 1851 for ten, 3222 for twenty; 27 fit under ADR 0061 §6's 4000 |
| And with the payload on one line instead of one entry per line? | 599, 1276, 1728, 2979: about twelve characters an entry |
| Does oxfmt, run over a written file, move anything but whitespace? | Not in the cases tried: a long wording is moved to its own line, and the scanner-level proof in §3 passes over the result, in the test that runs all three steps against a throwaway git repository |
| How long does the catalogue's own test take? | About a second |

## Decision

### 1. The texts kind is the dev server's save made again, and shares every part of it

`[texte]` is built. Its payload is the object the strings tool already holds for the frame:
the wordings that differ from the catalogue and pass the validator, and nothing else. What
the workflow does with it is what `plugin/strings.ts` does on a developer's machine, through
the same functions rather than copies of them: `isWordings` for the shape, `checkWording`
for each wording, `applyWordings` in `plugin/catalogue.ts` for the write through the syntax
tree, and the problem sentences in `src/preview/strings/problems.ts`, so the refusal a
person reads on GitHub is the sentence the tool showed them under the field, in the tool's
German. `applyWordings` moved out of the dev endpoint into the module the two share.

What is new is only what a public issue needs and a checkout does not: a bound on the
payload, 64 KiB, which is the bound the dev endpoint puts on the same payload arriving as a
request body; German sentences for the issue; a summary for the pull request; and the proof
of §3.

**An id is a key and never a path.** It is looked up in two tables the repository wrote, the
extraction's own keys (`Object.hasOwn`, so `__proto__` and `constructor` are ids nobody has)
and an index of the catalogue's literals built once per file. The file an id is written into
is the one that already holds its literal, found by that index; nothing in the issue names a
file.

### 2. What a kind may change is an allow-list, and the one-file assertion becomes a proof

The shell step that compared `git status` with one path is replaced by
`scripts/submission-verify.ts`, a second call that reads the issue again, asks git itself
what changed (`--porcelain=v1 -z --untracked-files=all`), and holds every path to the kind:

- the home kind, exactly its one file, modified: the old assertion, unchanged in substance;
- the strings kind, only modified files matching `CATALOGUE_FILE`, a flat name of letters
  and digits in `packages/catalogue/src/de/`, `index.ts` excluded. Nothing added, deleted,
  renamed or untracked, nothing in a subdirectory, nothing elsewhere, and exactly the files
  that hold a wording the issue changes.

The same test decides which files a write reads at all, and the write refuses to put a file
anywhere the kind may not (`mayWrite` in `scripts/submission-kinds.ts`), so a bug in a kind
cannot write outside its list either. Only when the proof passes does it write the list of
files, and the commit adds that list and nothing else, with literal pathspecs. No step takes
a file name from a step output any more.

**The table of kinds moved** into `scripts/submission-kinds.ts`, with a second column, the
proof, beside what applies each kind. `scripts/submission.ts` keeps the home kind and the
reading of the issue, `scripts/submission-strings.ts` holds the strings kind, and neither
imports the other.

### 3. The tree is proven by a second reader, after the formatter and before the commit

For the strings kind, each changed file is compared with `HEAD` token by token by the
TypeScript **scanner**, not by the parser the write used, so a mistake in the write is not
repeated in its proof. Whitespace is free, because oxfmt decides where a longer wording
breaks. Every other token must be the same text in the same order, comments included,
because they are the reasons left for the next translator. A token that differs must be a
string literal standing as a property's value after a string key, whose id the issue
changes, and which now says exactly what the issue says. Every id the issue changes must
have changed, and the file must still parse.

The formatter runs between the write and the proof, so the proof covers what oxfmt did too.
Then the workflow runs `oxfmt --check` and the catalogue package's own test, which formats
every message in every language and holds the German's arguments to the English's.

A failure here is never the person's: their submission passed the write. It is the
automation disagreeing with itself, so the workflow writes no reason file and the issue is
told that the fault is not theirs.

### 4. The validator refuses what a reviewer cannot see, a wording without end, and a placeholder of another kind

`checkWording` gains three refusals, and because it is the one validator, the tool shows
them while a person types, the dev server's save refuses them, and so does the workflow:

- **a wording over `WORDING_MAX`**, 1000 characters, four times the longest in the
  catalogue;
- **a character a reviewer cannot see in a diff**, by Unicode category where there is one:
  controls (`Cc`, the line break, the tab and C1's next line among them), format characters
  (`Cf`: direction marks and the Trojan Source isolates, zero-width characters, the
  byte-order mark, tags, the Mongolian vowel separator, interlinear annotation marks),
  surrogates, private use, unassigned code points, noncharacters, and the line and
  paragraph separators; and by name where the category calls a blank character visible: the
  combining grapheme joiner, the variation selectors, the Hangul fillers and the blank
  Braille pattern. The first version listed ranges by hand and let most of these through,
  `'ㅤㅤ'` as a wording among them; found by the cold review of #263. None is in the
  catalogue (the table above), and what one does in a pull request is make the wording on
  the page differ from the wording in the review. The refusal names the character by its
  code and says where it stands. The soft hyphen is the one exception by name, because it
  breaks a long German word in a narrow button and is a translator's tool, and a wording
  that is blank once the soft hyphens are taken out is empty;
- **a placeholder that keeps its name and changes its kind.** `{count, plural, …}` in the
  English and `{count, date, short}` in the German passed a comparison of names. A
  placeholder is now its name, its type and its style, or whether a plural counts or
  orders, and the German has to carry each name the way the English does.

`literal()` escapes a quote, a backslash, a line break and U+2028, so a wording that tries
to end its literal lands as text. A `${…}` in a wording is not refused by ICU in every
case: `${count} Artikel` against `{count} items` is a valid message, a dollar before the
placeholder. It is harmless because `literal()` only ever writes a quoted string and never
a template literal, so the dollar stays text; the test holds both halves.

### 5. A submission is refused whole, and an issue is read only in the shape the workbench writes

One invalid entry refuses the whole issue and writes nothing, as the dev server's save does:
a pull request that carried half of what somebody meant would be a pull request they would
have to notice is incomplete. The refusal lists every refused id with its reason, at most
twenty, and every id and value in it goes through ADR 0061 §7's `shown`. An entry whose
wording is already the catalogue's is left out and named in the summary rather than
refused, because the published site's table is a build older than `main` and such an entry
is nobody's mistake; an issue in which every entry is unchanged is refused. **An id written
twice in the block is refused**: `JSON.parse` keeps the last and says nothing, so a block
could show one wording for an id and apply another further down, and the workbench never
writes an id twice.

**The body is read only in the shape the workbench writes, for every kind**: a lead of
plain prose, a blank line, one fenced `json` block at the start of its line, and nothing
after it but whitespace, with neither `<` nor a backtick in the lead, and no `<!--`
anywhere. A reader that takes any fence it can find and a renderer that shows only some of
them disagree about what the issue says, and the maintainer who reads an outsider's issue
sees the renderer's answer. The first version refused only `<!--`; the cold review of #263
measured with `gh api markdown` that a fence inside an HTML attribute renders as nothing
and was still read, and that an indented fence renders as a block and was not. This is the
one change to the home kind's reading, and the workbench's own bodies pass it unchanged.

### 6. The wordings travel one per line, in id order

ADR 0061 §6 put the home document on one line because indentation cost a third of the
address. For wordings the cost is about twelve characters an entry (the table above), and
a wording is what a reviewer reads in the issue before anything else, so each id stands on
its own line, sorted. Twenty realistic rewordings take about 3200 characters and 27 fit
under 4000. Past that the tool does what the home tool does: the link carries the title and
a sentence asking the person to paste, the same click puts the whole body on the clipboard,
and a refused clipboard puts it in a field.

### 7. A maintainer approves the text the automation quoted, and the run takes that text

The first version bound a maintainer's manual run to the SHA-256 of the issue body the
outsider comment printed, and the run applied the body as it was when the run fetched it
if the hash matched. The comment was written when the issue was opened, and nothing
watched an edit, so the cold review of #263 found the sequence: open with a malicious text,
edit to a harmless one, let the maintainer read that and start the run with the value the
comment printed, edit back before the run. The hash matched, and the run applied a text
the maintainer had not read. The failure comment made it worse by printing the value for
the issue as it was, which invited a retry for a text nobody had looked at.

So the comment on an outsider's issue now **quotes the title and the body**, in code blocks
fenced longer than any run of backticks in them, where GitHub renders every character as
itself, and prints the SHA-256 of title and body together. The maintainer reads the
comment, which the outsider cannot edit, and starts the run with the issue's number and
that value. The run takes the title and the body out of the automation's own comment whose
quote has that value, from `github-actions[bot]` only, and only if the comment is still
exactly what the automation would write for that text; the issue as it is by then is not
read at all. An edit after the comment changes nothing about what runs, and a different
text needs a new issue. `apps/workbench/scripts/submission-quote.mjs` writes and reads the
quote, with no dependency, because the outsider's job has no install and checks out that
one file. The failure comment carries no value any more. A submission from inside the
organisation that failed is retried by closing and reopening its issue.

### 8. Running by itself needs an account that can write here

ADR 0061 §4 lets the run start by itself for an `OWNER`, `MEMBER` or `COLLABORATOR`, and
`COLLABORATOR` includes somebody given read access only. So the first step now asks the API
for the author's permission on this repository, and only `write` or `admin` runs by itself.
Anybody else's issue gets §7's quoting comment and waits for a maintainer, as an outsider's
does, and is told so. That the lookup works with the workflow's own token is assumed from
how widely it is used, not measured here; if it fails, the issue waits, which is the safe way
to fail.

### 9. The job that holds the token runs only this repository's code, and the split is deferred

Two small hardenings: the push hands its token to git as an HTTP header through git's
environment, never in the address or on a command line, and masks the encoded form; and
the manual run's issue number is a `number` input, so `5` and `05` are one concurrency
group.

**Splitting the job is deferred.** The stronger design runs the reading, the write and the
proof in a job without a write token and hands the proven files to a second job as an
artifact, so that a bug in a parser the issue reaches could not act with the token. It is
not done here because what that job runs is this repository's code from `main`, installed
without install scripts, over the issue as data; because the token is given to the two
steps that write to GitHub and to nothing else (ADR 0061 §5); and because the split adds an
artifact whose contents the second job would have to prove again before committing, which
is most of §3 run twice. It is the next step if the job ever runs anything the repository
did not write.

## Why not the alternatives

**Loosen the shell assertion to "only files under the directory".** It would let a
submission rewrite a comment, add an id, or put code beside a wording, and nothing would say
so until review. The directory is where the files are; the literal is what may change.

**Reprint the catalogue files.** It would make the proof trivial and throw away the
comments ADR 0056 §8 keeps them for.

**Prove with the same index the write used.** Cheaper, and a bug in `indexWordings` would
then be invisible to its own check. The scanner costs a few lines.

## What this retires

**ADR 0061 §3, "In the workflow's script each kind maps to the one file it writes".** The
strings kind writes one file per namespace it rewords, and the table now holds a proof
beside each kind (§2).

**ADR 0061, "What is still open", item 3, the strings kind.** Built here.

**ADR 0056, "What is still open", whether this ends in a pull request.** From the published
site it does, by ADR 0061's route and this record's kind.

**ADR 0061 §4, how a maintainer's run is bound.** "The manual run takes the issue's number
and the SHA-256 of its body" to "every refusal on the issue carries the current value for
it": the run takes the text the automation quoted, and no refusal carries a value (§7).

ADR 0056's and ADR 0061's status lines are updated as statuses and not struck.

Read and left standing: ADR 0061 §2's "asserts that it is the only file that changed", which
is still what happens for the home kind, now inside the proof rather than in shell; ADR 0061
§3's "It is **not built here**", which is true of that record's pull request; ADR 0061 §6's
limit and its one-line home document; ADR 0061 §7, whose rule this workflow still keeps, no
expression in any `run:` or `script:`; ADR 0061 §4's heading, "for the text they read",
which §7 makes true, and its "runs by itself only when the issue's author is an `OWNER`,
`MEMBER` or `COLLABORATOR`", still a condition, now beside §8's. ADR 0056 §7's limit is the
same limit, enforced now in a third place.

## What is still open

1. **A first real run**, as for ADR 0061's kind. Nothing here was run against github.com.
   The steps were run locally, in this checkout with a sample issue body, and a test runs
   the write, oxfmt and the proof against a throwaway git repository. The catalogue test
   inside the workflow was run on an install made with scripts; that vitest runs on
   `npm ci --ignore-scripts` is assumed from ADR 0061's measurement that tsx and oxfmt do,
   and was not measured.
2. **The workbench's own strings.** ADR 0056's first open item stands: the site's catalogue
   has the same shape and no picker, and this kind writes the app's German only.
3. **A stale table.** The published site's table is a build older than `main`. A wording
   somebody submits over one that changed on `main` since replaces it; the summary prints
   both, and the reviewer sees it, but nothing refuses it.
4. **The quote and the permission lookup on github.com.** That GitHub stores a comment
   exactly as it was sent, which §7's round trip relies on, and that the permission lookup
   answers the workflow's own token, are both unmeasured; either failing refuses the run
   rather than letting one through.
