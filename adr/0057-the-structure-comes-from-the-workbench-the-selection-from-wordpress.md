# ADR 0057 — The structure comes from the workbench, the selection comes from WordPress

Status: accepted, 2026-09-23, decided by the product side. **Not built.** It answers the
one question [ADR 0036](0036-the-home-screen-becomes-data.md) left open and the one
[ADR 0040](0040-the-app-does-not-depend-on-the-workbench.md) §4 reserved, and it is
written before any of it is built because the two halves it separates are already being
built towards each other.

## Context

ADR 0036 §4 has the app fetching a small document and drawing from the copy it kept, and
§15 has the configurator writing that document into the repository as a pull request. It
closed every question but one: **where the configuration lives in production, and who may
write it.** ADR 0040 §4 reserved the same question from the other side, and named the
shape of the mistake precisely enough that it is worth quoting rather than paraphrasing:

> From there the shortest path is the workbench writing that document and the app reading
> it back, and the app would then depend on something the workbench operates — which no
> check on imports or configuration would see, because there is no import.

The product side has now answered the first half. **The workbench stays the tool for as
long as nothing else is decided**, and if content management moves wholly into WordPress
the editor can be built again as a plugin there, where the newsroom already signs in.

The second half was never one question, and that is this record's contribution. "Which
places exist, in what order, and what changes at 14:00" and "which article leads today"
are two facts with two owners. `packages/app-core/src/data/home-pins.ts` has said so since
it was written, in the sentence that names the gap this record closes:

> WordPress will answer that. `wp/v2/posts` already serves the feeds
> (`services/wp.service.ts`), and the editorial query behind "what may lead the app today"
> — a window, a category, a flag, something — has not been asked for and does not exist.

So the question is not where "the configuration" lives. It is which of the two it is, and
the answer is different for each.

### What WordPress can answer today, measured

Asked of correctiv.org on 2026-09-23, with `OPTIONS` on `wp/v2/posts` for the parameter
schema and one `GET` each for the rest:

| Asked | Answer |
| --- | --- |
| Which filters does `wp/v2/posts` declare? | `sticky`, `categories` and `tags` among them, and **no filter for a meta field or an ACF field** |
| `?sticky=true` | `200`, and an empty list. The flag exists on every post and nobody uses it |
| What does a post carry? | `sticky`, `categories`, `tags`, `meta`, and `acf` with `post::authors`, `post::excerpt`, `post::related`, `post::seo`, `post::topline` |

Two things follow, and only the second is obvious. ACF is installed and its fields reach
the API, so **a flag can be stored in one**. And the endpoint cannot filter on one, so a
flag stored only there **cannot be asked for** — the app would have to fetch a window of
posts and look through it, which is a different mechanism with a different failure.

## Decision

### 1. The workbench stays the editor, and the condition to leave it is named

Until a decision says otherwise, the home document is edited in `apps/workbench` and lands the
way ADR 0036 §15 says: a file in the repository, carried by a pull request.
[ADR 0058](0058-the-workbench-holds-no-power-and-github-is-who-you-are.md) §2 is how somebody
who is not a developer opens that pull request.

The condition to leave is not a date and not a feature. It is **the day the newsroom has to
publish without a reviewer**, because merging is the one step nobody in the workbench can
take and the step that makes a document reach readers (§4). Until then the cost is known and
accepted: a change to the structure of the screen waits for a review. A change to which
article leads does not wait at all, because it is a flag in WordPress (§2), and that is most
of what the newsroom changes in a day.

### 2. The document holds structure; it never holds an article

The document carries places, their order, their settings and the moments that change them.
It does not carry the identity of a piece of content, and a place whose job is "the leading
investigation" says exactly that rather than naming one.

This is not new, it is ADR 0036 §3 read one level down: a place carries either a pinned
item or a rule, and the rule is what runs unattended. What this record decides is **where
the rule reads from**, and the answer is WordPress, because that is where the article is,
where the newsroom already works, and where the website's own answer to "what is
important today" is already being given.

The pin stays, with the meaning ADR 0039 §4 gave it: a setting a moment may change,
overriding the rule where an editor really does mean one article. Pin first, then the
rule. Nothing built so far changes.

**What this buys is that the two writers cannot break each other.** The workbench can
neither delete an article nor publish one; WordPress can neither reorder the screen nor
hide a block. A wrong flag shows the wrong article in the right place; a wrong document
shows the right article in the wrong place. Neither produces an empty screen, which is
what ADR 0036 §7 and §8 were built for.

### 3. A flag has to be answerable by a query, not merely present

This is the decision the measurement above forces, and it is deliberately not a choice of
mechanism.

Whatever WordPress ends up marking an article with, the app has to be able to **ask for
it**: one request that returns the flagged articles. `sticky`, a category and a tag can be
asked for today. An ACF field cannot, and neither can post meta, unless somebody adds a
parameter or an endpoint on the WordPress side.

A flag that cannot be asked for is not forbidden here, but it stops being a flag and
becomes a window: the app fetches the most recent N posts and looks for the mark. That
changes what the mark means, because an article falls out of the answer as others are
published, without anybody having unflagged it. If that is the mechanism, the window is
part of the decision and belongs in the record that picks it.

Which of them it is depends on who administers correctiv.org and on what the flag is
allowed to do to the website, and that is named as open below rather than guessed at here.

### 4. The document is published as a file beside the app, and the app fetches one constant

The copy the app fetches is the same file it already bundles,
`packages/app-core/src/data/home.layout.json`, copied into the published artifact by
`.github/workflows/pages.yml` and fetched from an address the app holds as a constant.
No server, per ADR 0040 §4. The bundled copy stays exactly what ADR 0036 §10 made it: the
floor under a first launch with no network, and under a fetch that fails.

**Why this does not reverse ADR 0040 §1.** The document is the core's file, not the
workbench's output. The workbench edits it the way a person with an editor edits it; the
step that publishes it names neither the app nor the workbench, only the core; and the
`independence` job still passes, because removing `apps/workbench` removes nothing this
path touches. The thing ADR 0040 §4 warned about is the app reading a document **the
workbench operates**, and the distance between that and this is the whole of why the file
stays in the core.

The address is an interim answer and is recorded as one. It is the only origin that exists
today, and it is a developer tool's public host. The day the app ships from a store is the
day to ask whether the document should come from correctiv.org instead, which is where the
rest of the app's content already comes from.

**The preview override is not this.** `apps/mobile/src/lib/home/layout.ts` also reads a
`workbench:home-layout` key out of `localStorage`, written by the editor and readable only
because the framed app and the workbench are one origin. That is a preview seam and the
file says so. It is web-only, it survives nothing, and it is not on the path to the fetch;
both can stand, because the fetch answers "what does a phone draw today" and the override
answers "what would this document look like".

**A cost, named rather than discovered.** GitHub Pages takes one artifact per deploy, so the
published document ships in the same job that builds the workbench. A workbench build that
fails therefore holds every phone on the copy it last fetched. That is the degraded case
ADR 0036 §9 and §10 were built for and not an empty screen, but it is a dependency of the
app's content on the workbench building, and it is the thing to remove first if the
document ever moves to correctiv.org.

### 5. If the editor becomes a WordPress plugin, the document goes with it and the rest stays

Recorded now because it is what makes decision 1 cheap to reverse, and because a reader in
a year will otherwise re-derive it.

| What | Moves to a plugin | Stays where it is |
| --- | --- | --- |
| The document's shape and its parser | no | `packages/app-core/src/lib/home-layout.ts` |
| What a block is called, for the newsroom | yes | — |
| Which settings a block understands | no | declared beside the block, generated into the core (ADR 0045 §9) |
| Where a block may appear | no | `apps/mobile/src/lib/home/screens.ts` (ADR 0054) |
| The editing surface, the drag, the palette | yes | — |
| Where the document is served from | yes, and that is the point | — |

The app is unaffected by the move in every row, which is the test of whether this boundary
is in the right place. What it costs is the editor's surface, written twice.

## Why not the alternatives

**A server.** ADR 0040 §4 says it needs a record of its own, and this is not that record.
It would answer the newsroom's write problem and nothing else here, and it is the one step
that turns "the app reads a file" into "the app depends on something somebody operates".

**Put the article in the layout document.** It is the shortest path and it was rejected on
what it does to the newsroom's day: every highlight becomes a pull request, a merge and a
deploy, performed by a developer. It also splits the truth in two — the website saying one
thing about what leads today and the app another, with nothing reconciling them.

**Flag it in ACF and let the app look through a window.** Not refused, but it is a
different decision than it looks, for the reason under §3. Worth knowing before choosing
it: a page of twenty posts with the app's field pruning measured 43 KB
(`services/wp.service.ts`), so the request itself is affordable. The cost is not bytes, it
is that the mark stops being a property of the article and becomes a property of how far
back the app happened to look.

**Deliver the document through the `workbench:` override key.** It is what exists, so it
has to be named. Same origin only, which is the web target and nothing else; `localStorage`
on a phone is not where a production document lives; and it is precisely the shape ADR
0040 §4 describes, with the workbench writing and the app reading back.

## What this retires

**ADR 0036, "What is still open".** The sentence "This one depends on the source decision
`SOURCES.md` carries: what serves the app's content decides what can serve its layout, and
by whom" is struck. It is half true and reading it would produce a wrong action, which is
waiting for the source decision before deciding the layout's home. The layout's home is
decided here without it; what does depend on the content source is the selection half, and
that dependency is real and stated in §2 and §3.

**ADR 0036 §4.** "Where it is served from is the open question" is struck; §4 above answers it.

**ADR 0039, "What is still open".** Its first item called the same question "unchanged, and
still ADR 0036's open question". That clause is struck and points here and at
[ADR 0058](0058-the-workbench-holds-no-power-and-github-is-who-you-are.md) §2, which together
answer it. The rest of the item, that ADR 0039 does not touch where the document is served
from, stays true.

Nothing in ADR 0040 is retired. §4's reservation asked for a record before a server, and
this record decides that there is no server.

## What is still open

1. **Which mark WordPress uses**, under the constraint in §3. `sticky` costs nothing and
   is unused today, but it is the website's own field and means "stick to the top of the
   blog index", so the app would be borrowing it. A category or a tag is queryable and
   visible in the site's public taxonomy. An ACF field is clean and needs work on the
   WordPress side before it can be asked for. This needs whoever administers correctiv.org,
   and it is the first question to take there.
2. **Which places take a WordPress rule at all**, and what each rule asks for. §2 decides
   that a rule may read WordPress, not that every place does.
3. **The day the newsroom publishes without a reviewer**, which §1 names as the condition and
   does not answer.
4. **Whether the published document moves to correctiv.org** when the app ships from a
   store, per §4.
