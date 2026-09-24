# ADR 0056 — A string is picked where it renders, and the German is what is edited

Status: accepted, 2026-09-22, **built in #259**; the published site's way out, ADR 0061
§3's strings submission, built by [ADR 0062](0062-the-texts-submission-may-change-wordings-and-nothing-else.md). Measured on 2026-09-21, and the measurement
is in the Context below because it decided the shape rather than confirming it. Retires
nothing.

## Context

`/strings` is a board that reads. It joins the extraction, the catalogues and the
descriptors into one table and prints it, with the twins and the untranslated called out
([`apps/workbench/src/pages/strings-model.ts`](../apps/workbench/src/pages/strings-model.ts)).
Everything on it is addressed by id. A person who has just seen a wording on a screen and
wants to change it has to work out which id that was, and the board cannot help them with
that question, which is the one they actually have.

The home configurator is the answer to the same question one floor down. ADR 0036 §1 made
the home screen data so the newsroom could own it;
[ADR 0045](0045-the-home-editor-arranges-the-blocks-it-draws.md) §3 made the editor draw
the blocks rather than describe them, and
[ADR 0053](0053-the-editor-is-the-screen-and-the-drag-is-the-answer.md) §1 made the list
*be* the screen. The through line is that a person points at the thing instead of naming
it. This record asks what that costs for the strings.

**Four of the five parts are already in the tree**, which is why this is worth doing now
rather than worth wanting.

- The picker. `preview/frame/locate.ts` arms the frame's document, swallows the whole
  interaction and returns the owner chain as `file:line`, symbolicated through Metro.
  `frame/highlight.ts` draws the box around what is under the pointer.
- The table. `virtual:strings` carries every id's English, every catalogue's wording, the
  description and the descriptor's own `file` and `line`, joined at build time by
  `apps/workbench/scripts/strings.mjs`.
- The seam into the running app. `workbench:home-layout` is written into `localStorage`,
  the frame is the same origin, the app subscribes and redraws with no reload and no dev
  handle — so it works against the published export too.
- The seam back into the repository. `apps/workbench/plugin/home-layout.ts` answers
  loopback only, POST only, in development only because `configureServer` is not called
  by `vite build`, and writes what the core's own parser accepted rather than what
  arrived on the socket.

The fifth part does not exist: nothing maps a pixel to an id. The picker says which line
drew an element, not which descriptor supplied its words, and those are different
questions — a `COPY` block sits at the top of a file and the markup that renders it sits
anywhere below.

### The measurement that decided the shape

Two ways to close that gap were on the table. **Marking at run time** — a development
build that wraps every formatted message so the output carries its id — is exact, and it
puts code in the app for the workbench's benefit, changes the strings themselves and
therefore every measurement taken over them. **Reading the text back** needs nothing from
the app at all: the table is a complete list of what the app can say, so a rendered
string can be looked up in it. Its cost is ambiguity, and the whole question is how much.

Measured on 2026-09-21, over the app's German, with every plural branch rendered
separately, and then over the built web export walked at phone width on nineteen routes
with the signed-in fixture `frame/seed.ts` writes:

| | reading |
| --- | --- |
| renderings that resolve to exactly one id, over the whole catalogue | 279 of 348 |
| of the ambiguous ones, candidates that sit in different files | 58 of 59 |
| candidates that sit in one file, where nothing can break the tie | 1 |
| distinct texts on screen that are catalogue strings | 104 |
| of those, resolving to exactly one id | 94 |
| of the remaining 10, separable by the owner chain | 10 |
| catalogue strings the walk failed to recognise | 0 |
| ids reachable by pointing, on those nineteen routes | 109 of 318 |

Three findings came out of that run and each of them is a decision below rather than a
detail. The arrows on the "Alle ansehen →" rows are their own text node inside the same
element, so the `textContent` the picker reads today is the message plus its decoration
and matches nothing (§2). A handful of ids are holes with punctuation between them —
`{cta}: {title}`, `„{quote}“`, `von {authors}` — and as patterns they match almost any
sentence in the catalogue; in the first run one of them collided with every long string
there is (§3). And pointing reaches about a third of the catalogue on the routes a person
would tour, because the rest is error states, empty states and accessibility labels that
never become a text node at all (§4).

## Decision

### 1. The picker resolves a rendering to an id by its text, and the owner chain breaks the tie

The app is asked for nothing. A rendered string is looked up in the table, as an exact
match where the message has no holes and as a pattern match where it has; the candidates
are the ids that could have produced it.

Where more than one could, the owner chain the picker already returns is the
discriminator: the candidate whose descriptor `file` appears in that chain is the one on
screen. This is not a heuristic bolted on afterwards — it is the reason the language rule
that puts `COPY` in one obvious place per file
([AGENTS.md](../AGENTS.md#language)) pays for itself twice.

**It is dev-only, and the tool says so where it matters.** `locate()` needs Metro's
`/symbolicate` and a development bundle; against the published export there is no owner
chain and the tie cannot be broken. That is the same split `ui/Panels.tsx` already renders
for the appearance tool and the inspector, and it is honest here rather than degraded: the
lookup itself still works, and what the panel loses is the last step of narrowing.

### 2. The match is on the text node, not on the element's text

`armPicker` records `(target.textContent ?? '').trim()`, which concatenates every text
child of the element. Measured: a row whose label ends in an arrow writes that arrow as a
text node of its own beside the message, so what the picker reads is `Alle ansehen →`
while the catalogue holds `Alle ansehen`, and the lookup finds nothing.

So the lookup is offered the text node under the pointer first, and the element's whole
text only as a fallback for the case where a message really does span children. Taking
the element's text first would be the intuitive order and is the wrong one: it fails on
decoration, which is common, to serve composition, which nothing in the app does today.

The handover's `label` stays what it is. It is prose for a person to paste into a chat and
its job is to describe the thing pointed at, not to be an exact key.

### 3. A pattern too loose to match on does not take part, and says so

A message whose fixed text is shorter than a few letters is not a matcher, it is a
wildcard. Those ids are excluded from the lookup, and the panel says of such a string that
it cannot be recognised by its text rather than offering a guess.

**The threshold counts letters and digits, not characters.** A colon and a space pin
nothing down, which is exactly the `{cta}: {title}` case; counting punctuation would let
it back in.

This is a small list and it is allowed to stay small by accident rather than by rule: no
check forbids writing another message of pure holes, because such a message is perfectly
correct and only this tool finds it awkward. The tool absorbs the awkwardness.

### 4. The list is the other half of the tool, not a convenience beside it

Pointing reaches the strings that are on a screen somebody can get to. It does not reach
a failure message, an empty state, a confirmation that appears for a second, or an
`accessibilityLabel`, which has no text node and which the picker therefore cannot see at
all — `callout.teaser.ctaAccessibility`, the worst-behaved id in the measurement, is one
of those.

So the tool carries the table as well, filtered the way `/strings` filters it, and the
picker is the fast path into it rather than the door. A tool that offered only the picker
would be a tool that quietly cannot edit two thirds of the catalogue.

### 5. "No id" is an answer, and one existing check is what makes it a true one

Most of what is on screen is not a string: headlines, names, dates, the marks. The tool
says so, in those words, rather than showing an empty result.

That sentence is only honest because
[`apps/mobile/__tests__/rendered-literals.test.ts`](../apps/mobile/__tests__/rendered-literals.test.ts)
is green. It fails on a text child or a read-by-a-person prop that is a literal, so a
word typed straight into the markup cannot be in the tree; what is left over after the
catalogue has been consulted is content, a mark, or a string from the core's `src/data/`,
which is content by [ADR 0026](0026-react-native-review-and-hardening.md) §6's question —
*would this string still exist if the content came from a CMS?* Without that check, "no
id" would mean "this may be a string nobody extracted", which is the opposite answer and
the one worth acting on.

**If that check is ever weakened, this sentence is what it costs.** Named here because
the dependency runs the wrong way round to be visible from the check's own file.

### 6. What is edited is the German, and the `defaultMessage` is left alone

The English is source: it lives in the descriptor, in `apps/mobile/src` or in the core,
and changing it is a code edit that the extraction has to run over. The German is data:
`packages/catalogue/src/de/`, one file per id namespace, which is what
[ADR 0049](0049-the-catalogue-is-a-package.md) made it.

This tool edits the data side and nothing else. That is the same line the home
configurator sits on — ADR 0036 §1 gave the newsroom a document to own, not a screen to
program — and it is what keeps this from being an editor for the app's source code behind
a device frame.

A person who needs the English changed is shown where it is written, `file:line` out of
the table, which is the address the handover block already produces.

### 7. The preview writes `workbench:strings`, and it may only replace a wording the catalogue already carries

The app merges that key over `CATALOGUES[locale]` in `i18n/Localisation.tsx` and redraws
on the `storage` event, the way `lib/home/clock.ts` already subscribes. The key is
declared in `apps/mobile/src/lib/`, beside `locale.ts`, which is the permitted side of
[ADR 0040](0040-the-app-does-not-depend-on-the-workbench.md): the app names the seam, it
does not read the workbench.

**This is the largest power the workbench has ever asked the app for, and the argument
next door is the standard it has to meet.** `lib/locale.ts` says of its own key that it is
"a smaller power than either key beside it" — it selects between catalogues the app
already ships and cannot change a string. This one can change a string, which is the whole
point of it, so the limit has to be somewhere else: **an entry whose id the shipped
catalogue does not carry is ignored, and anything that is not a string is ignored.** The
tool may reword the app; it may not extend its vocabulary, and a screen can therefore
never say something the repository has no id for.

That is the same shape as `previewLocale()`'s validation and for the same reason. Junk in
the key is nobody asking.

### 8. Saving edits the file through its syntax tree, and the validator is the placeholders

A second endpoint beside `homeLayoutEndpoint`, with its conditions unchanged and for the
reasons that file already gives: ~~loopback only, POST only, bounded body~~ — wrong on the
day this was written, as a list: loopback does not rule out another site's page in the
developer's own browser, and a `no-cors` POST sent as `text/plain` rewrote a catalogue
file through both endpoints, measured 2026-09-24 in the cold review of #259. Both now also
refuse a request whose `Origin` is not the server's own or that is marked
`Sec-Fetch-Site: cross-site`, and any body not declared `application/json`, which a page
cannot send across origins without a preflight. And absent from
the production bundle by construction rather than by a flag.

What is different is the write. A catalogue file is TypeScript with comments in it, and
those comments are the reasons somebody left for the next translator, so the file is not
reprinted — the id's string literal is found in the syntax tree and only that literal is
replaced. `typescript` is already a dependency of
[`packages/prose-and-code`](../packages/prose-and-code/README.md), which is the package
that owns reading this repository as text; this is a write and stays out of it.

**The validator is the counterpart of `parseHomeLayout` and it asks one question: does
the German carry exactly the placeholders the English carries, and does it parse as ICU?**
Both halves are refusals the app would otherwise discover later and elsewhere — a lost
`{count}` is a hole that never fills, and a malformed pattern is a throw in a development
build, from `Localisation.tsx`'s `onError`, on whatever screen happens to render it. A
refusal here names the problem while the person who caused it is still looking at it.

It does not judge the wording. Sie or du, long or short, that is a person's decision and
a reviewer sees it in the diff.

## What is still open

**The workbench's own strings are the same model and are not in this record.** `/strings`
already carries both surfaces, and `apps/workbench/src/i18n/catalogue/de/` has the same
shape as the app's. But the site's own words are not inside the frame, so the picker does
not apply to them, and the second half of the tool would be a different interaction.
[ADR 0050](0050-the-workbench-gets-a-second-audience.md) §3 keeps the two catalogues
apart; nothing here argues they should stay unequal in what can edit them.

~~**Whether this ends in a pull request**, as ADR 0036 §15 says the configurator should.
The same answer is the right one and for the same reason, and the same step before it is
what this record decides: write the file, look at the diff, commit it by hand.~~ Voided by
[ADR 0062](0062-the-texts-submission-may-change-wordings-and-nothing-else.md): from the published site it ends in a pull request, by ADR 0061's route. The dev
server's save still writes the file for a developer to commit by hand.

**Whether the twins should be resolvable at all.** Two ids with the same German are a fact
about the catalogue, and `twinsOf` already shows them on `/strings`. This tool now has a
second reason to care about them, and a third reading — the same wording on two screens
that a translator would want to keep in step — is a question neither of them answers.
