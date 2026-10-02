# ADR 0076 — A draft travels in the fragment

Status: accepted, 2026-10-02, decided by the product side. **Built in the same pull
request.** It is the other half of the address question
[ADR 0061](0061-a-submission-is-an-issue-and-ci-makes-the-pull-request.md) §6 decided for
the issue path, and it stands on the arrangement of
[ADR 0014](0014-the-preview-shell-as-a-package.md): the workbench and the framed app are
two halves of one page, and the storage they share is literally the app's own.

## Context

A change reaches the repository by becoming a GitHub issue (ADR 0061). Between "I have
arranged the day" and "I have opened the issue" there is a gap the newsroom feels: **nobody
has seen the change on a phone.** The frame beside the editor draws the document, but the
frame is one device on one desk, and the person who has to say "that is right" is usually
somewhere else.

So the tool needs a third way out between editing and submitting. Not a third *kind* of
submission — the issue remains the way a change is offered, and nothing here changes that —
but a way of *looking*: a link a colleague can open and see exactly what would change.

Two facts about this workbench decide the mechanism, and both were true before this record
was written:

- **There is no server.** The workbench holds no power and performs no authorised write
  (ADR 0058 §1); everything it offers leaves by navigation to somewhere that already knows
  who the person is. So there is nowhere to put a document but the link itself.
- **The document is not a secret.** What a layout document carries is structure, wording and
  ids (ADR 0057 §2, ADR 0075 §1). Submitting one puts all of it into a **public** issue in a
  moment, and a workflow turns that into a pull request (ADR 0061 §1). Whatever a link hides, the
  submission path does not. Pretending otherwise would buy nothing and would cost the
  newsroom the ability to read their own link.

So the question is not *how do we hide a document in a link* but *where in a link does a
document go so that the address stays an address*.

## Decision

### 1. The draft travels in the fragment, under the name `draft`, inside the submission's own envelope

The link is this page's own address with one parameter added to its fragment:
`#/home?d=ipad-mini&tm=18%3A30&draft=…`.

**The fragment and not the search**, because a fragment is not part of what a browser sends:
it is not in the request line, not in a `Host` header, and not in the `Referer` of anything
the page goes on to load. This site is GitHub Pages (ADR 0065 §7), which means there is no
server here to receive anything — the only party that could see a search parameter is GitHub,
in a request log, for a document that is about to be submitted anyway.

**`draft` and not the `d` the plan named.** `d` has been the device since the address had
five parameters (`#/?d=ipad-mini`), and a second meaning for a letter every link already
carries would make one of the two wrong rather than one of them longer. `toAddress` writes
only the frame's own parameters, so a link built out of a link that already carried a draft
carries one draft and not two.

**Deflate-raw, then base64url.** `CompressionStream('deflate-raw')` and
`DecompressionStream('deflate-raw')` are in every browser the workbench supports and need no
library. `deflate-raw` rather than gzip because the two are the same compressor with 18
bytes of header and a checksum between them, and nothing here needs the checksum. Base64url
rather than base64 because `+`, `/` and `=` mean something to `URLSearchParams` and to half
of what a link passes through on its way to a person.

**The envelope is the submission's.** The packed text is `layoutPayload(screen, document)` —
the very text ADR 0061's issue body carries — so the link and the issue are the same payload,
the two ends cannot spell it differently, and nothing in the sharing code has to know what is
inside a document in order to carry one. What travels is a JSON value, so the document comes
back printed rather than as it travelled: two spaces and a newline are the printer's, not the
document's.

**The mechanics are one module, `preview/share.ts`, with no `window` and no React.** The tool
that builds a link, the page that opens one and the module's own test are three callers, and
the test is Node.

### 2. Length is the limit, it is 2000 characters, and past it the tool says so and points at the submission

**The browser's own ceiling is not it.** Measured on 2026-10-02 by driving Chrome 153 over
CDP, the way `scripts/renders.mjs` does: Chrome opened an address of **2,097,120** characters
(a fragment of 2,097,064) with all of it intact, and lost the load at 2,097,154 — 2 MiB for
the whole address. A limit near that would be a limit on nothing, because the browser would
carry what the tool refused to build.

**So the limit is where a link stops being a link**, measured in the other direction, against
the documents this tool actually holds. All four rows are the shipped document with one block
hidden, at the address `…/preview#/home?d=ipad-mini&tm=18:30`:

| the document | characters | the address it packs into |
|---|---|---|
| Home as it ships | 1,117 | 554 |
| 150 `teaser-grid` blocks added | 9,707 | 1,125 |
| 40 `article-hero` blocks, each with a pinned article | 6,214 | 971 |
| the shipped document with 1,000 characters that do not compress | 2,117 | 1,702 |
| the shipped document with 2,000 characters that do not compress | 3,117 | 2,723 — refused |

The first three rows are what a newsroom makes: an order of magnitude of real arranging costs
under 1,200 characters of address. The last two are the honest worst case, because the
compressor earns its keep on German prose and a document of ids is nearly incompressible.
**2000 characters is therefore about 1,300 characters of text that does not compress** — a
paragraph — which is where a link stops being something a person pastes into a chat.

It is also **half the ceiling ADR 0061 §6 measured** for the issue path (4000). That number
was set by GitHub's sign-in redirect failing at about 4650; a share link has no such second
copy, but a share link goes into a chat and a ticket, which is the place an address quietly
gets truncated, and half of a measured limit is a reasonable place to stop.

The number is judgement on top of those measurements and is written here as such. The test
that holds it up is not a fixed length either: it searches for the last draft that fits and
the first that does not and requires them to be one character apart, because the length of an
address is not linear in the size of a document.

**Past the limit there is no link and one sentence.** `shareLink` returns
`{ link: null, length }`, and the panel says: *"This draft is too long to share as a link: N
characters, where a link stops being usable at 2000. Submit it instead — that opens GitHub
with the change in it."* Both numbers, because a person told only the limit cannot tell
whether they missed it by ten characters or by ten thousand. The sentence names **no button**,
because the one that submits is "Einreichen" in German and "Submit" in English.

**A draft is not a secret, and the tooltip says so in one sentence:** *"Copies a link that
opens this draft on somebody else's machine. A draft is not a secret: everything it carries
goes into a public GitHub issue the moment somebody submits it."* That sentence is the whole
reason the link is not obfuscated, encrypted or signed — §1 says where the document goes, and
this says what that costs. Both halves of it belong on the button: someone who has clicked it
should know what they did, and someone about to click it should know before.

### 3. An arriving draft is held, not published, and nothing about it is written into the machine

The link is read **once, on mount**, and the fragment is captured synchronously before
anything else can move: another effect on the same page reads the address first, and the page
writes the address back on the render after that. Reading a string and handing it over is the
whole of the defence; what happens to it is `arriveFrom(hash)`, which takes a string rather
than reading a global, so a test can hold it to the claim that matters.

**The claim: a link writes nothing.** `localStorage` is not the tool's own store — the framed
app reads the same key (ADR 0014), so writing it is writing into the picture on the phone
beside it. A draft that landed in the key on arrival would replace whatever the machine held,
**including work that was never submitted**, before anybody had edited a character of it. The
reviewer who had a document of their own open opens a colleague's link, and then loses their
own work to the first edit, with nothing in the interface to explain it.

So the arrival is `holdIncoming`: the document becomes what the editor shows and nothing else.
The frame keeps drawing the document this machine holds. The panel says where the document
came from and that none of it was saved here, and offers both ways on: **submit it** (a
reviewer who has read it and agrees is exactly who the submission path is for) or **reload**
(their own document comes back).

**The first edit publishes it**, and clears the flag. That is the moment the draft becomes the
editor's own, and from there it is published like any other document — which is what makes the
"held" state a state and not a fork: there is one store, one document per screen, and one flag
saying whose it is.

**One sentence for every fault.** Damaged characters, an envelope the core will not open, a
screen that does not exist: three faults, one word (`damaged`), one sentence — *"This link
carries no draft this tool can open, so it was left out. The tool is unchanged."* The person
reading it can do nothing with which of the three it was, and the tool has nothing to repair.
A thrown error instead would be caught by the boundary around the whole view and reported as
"this view did not render", which is a claim about the site rather than about a link.

**Nothing is written back into the address.** The tool that made the link put the draft there;
the tool that opens it does not put it back, because `toAddress` writes the frame's own
parameters and a draft is not one. A link that carried a draft and were rewritten would go on
claiming a draft the tool has moved on from, and the first edit would leave a stale address
behind. The draft travels out of the address and into the editor, the button is the only thing
that makes one again, and what the address says stays true.

**A draft for another screen takes the frame to it.** The editor holds one document at a time,
so a draft for another screen loaded without this would be in the store and on no screen at
all.

### 4. The inflate is bounded, and the bound is the app's own document ceiling

A deflate stream is a statement about how much there will be when it is finished, and nothing
keeps that statement honest: 786 KB of one character arrives in about 500 characters of link.
A link is text anybody can send.

So the reader counts characters as it inflates and cancels at **256 KiB** — `HOME_LAYOUT_MAX_CHARS`,
the bound the app's own parser refuses a document over (ADR 0061 §2). A larger result is not a
document this repository can hold either way. Packed input longer than twice `SHARE_ADDRESS_LIMIT`
is refused before any of it is decoded, because nothing the tool builds is that long.

This is what ADR 0061 §6 declined for issues rather than did: a bounded inflate in CI would
have been needed, so the issue body is not compressed. A link is different — a link is read by
the person who opened it, not by CI, so the bound is a few lines in the same module rather than
a change to every check.

### 5. The button is in the header with the other words, and what came of the click is said in the panel

One word for every tool: **"Link teilen"**, beside Submit, Save and Discard, with a link icon
and `data-testid="action-share"`. Disabled rather than hidden when the tool holds no changes,
for the reason the other three are: a button that appears only when there is something to do
moves every other control in the bar each time somebody types. The seam is optional
(`share?: { run: () => void }` on `ToolActions`), so a tool that has no draft to share simply
does not draw it — today only the layout tool does.

**It is switched off for a scenario**, for the reason Submit is: a scenario is an example with
a date made up for it, and a link to one would land the reader in a document they cannot submit
and do not know why they cannot.

**The outcome is said in the panel, never in the header.** A sentence about a link does not
belong in a bar that is 32 pixels tall, and the two ways out of the tool are never both in
play: the draft that could not be shared is submitted instead, which is what the sentence says.
The outcome is drawn beside the submission's own outcome, and the field for a link the
clipboard refused is the submission's field in the same place and for the same reason: the
clipboard is a thing the browser may refuse, and the address is still there to be copied by
hand. The copy is the same synchronous `copy` inside the click as ADR 0061 §6 chose.

## Why not the alternatives

**A search parameter.** The browser sends it. That is the whole difference and it is the whole
answer: the workbench holds no power (ADR 0058 §1), so the only party that could receive a
document is GitHub, in a request log, on the day somebody opens the page — for a document that
is about to be submitted in public anyway.

**A server, a store, a short id.** The right shape for a draft that must be revoked, must not
expire in a week, or must be looked at by people without the tool. It needs an account, a
host and somebody to pay for it, which is ADR 0058 §1's whole refusal; and the workbench would
then be *holding* something, which is the power it does not have.

**A file: download the document, send it as an attachment.** It sidesteps the length limit
entirely, which is its attraction, and it is worse for the job. A colleague has to be sent a
file and has to save it and open it, and the app opens nothing: a layout document is not a
picture and there is no viewer for it. A link is one click for both sides. A `.json` download
would also be a second path around `plain` (ADR 0061 §7), which exists because a public issue
body is text a stranger's pull request can carry.

**Obfuscate or encrypt the document in the link.** It buys nothing: the same document goes
into a public issue on submit, so the worst case for the link is the normal case for the tool.
The cost is real — a key somebody has to carry, a cipher that will outlive the reason for it —
and the benefit would be to make a link *look* like a secret, which is the state a reader
cannot act on.

**Publish the arrival straight into storage.** The obvious implementation, and the one this
record is mostly written against. It costs the machine its unsubmitted work on the first click
of somebody else's link, with nothing in the interface to say where the document came from. §3
is the alternative: hold it, say so, publish on the first edit.

**Guess the threshold from ADR 0061 §6's 4000.** The plan called the browser's address bar
"practically somewhere around 8 KB", which is not true (2 MiB, measured above) and would have
made the limit a superstition. The number is measured in the direction that matters — where a
link stops being pasteable — and written down with the rows it came from, so the next person to
raise it can see what it was raised against.

**Keep the draft in the address as it is edited.** It would make the address grow with every
keystroke, put a document into every history entry and every screenshot of the address bar, and
make the back button replay edits. The draft leaves the address on arrival.

**The button in the panel, beside Submit.** The two are the same rank — one way to look, one
way to submit — and the header is where the newsroom already looks for them.

## What it costs

**Anyone with the link has the document, in plain sight.** It is in the address bar, in the
clipboard, in every clipboard manager and history store on the machine, and readable by any
extension on the page. The fragment keeps it off the wire and out of server logs; it does not
keep it from the machine that opened it. §2's tooltip is the honest answer to that, and it is
one sentence because the disclosure is the tool's normal state, not an exception to it.

**A link cannot be withdrawn or corrected.** There is no store, so there is nothing to revoke:
the document travels as text, and what the recipient sees is what the link said at the moment
it was copied. For a draft that has not been submitted this is harmless — the newsroom can
send a new link — and it would not be for anything that mattered.

**The biggest change is the hardest to share.** A document near the ceiling compresses to an
address nobody wants to paste, and the newsroom's most surprising arrangement is likely to be
its largest. The answer is the one §2 gives: submit it, which is where such a change has to go
anyway, and the sentence says so at the moment of refusal rather than leaving the button to
fail.

**A second way out of the tool, and a second way to be wrong.** `setLayout` clears the incoming
flag, so a draft is the editor's own from the first edit; but a person who wanted to look and
then closed the tab has shared nothing and kept nothing, which is what the reload sentence
exists to say.

**Compression is now part of the address grammar.** A link is no longer readable by a person,
and a link in a bug report is no longer usable by a developer without this tool. The arrival
says one sentence for every damaged link rather than repairing one, so the failure is a sentence
rather than a partial document.

## What this retires

**Nothing.** ADR 0061 §6 stands as written: the issue path still opens its prefilled address at
4000 characters and still says so before the click, because that limit was set by GitHub's sign-in
redirect and this record does not touch it. The two limits are different numbers for different
reasons and are kept apart in code (`SHARE_ADDRESS_LIMIT` here, `SUBMISSION_ADDRESS_LIMIT`
there) rather than made to agree.

**ADR 0058 §1 — unchanged, and this record is built on it.** The workbench still holds no power
and performs no authorised write; a share link performs neither, and it changes no file on any
machine, which §3 makes a testable claim rather than a promise.

**ADR 0014 — unchanged.** The two halves still share `localStorage`, and this record turns
that sharing into the thing it must not be used for: the key is where a *published* document
goes, so a document that has not been edited by the person who opened it does not go there.

## What is still open

1. **Whether the other tools get the button.** The seam is optional and only the layout tool
   fills it. A navigation document (ADR 0075 §5) is a draft somebody else could usefully look
   at, and whether a second button with the same word is wanted is not decided here.
2. **Whether a shared link should carry anything besides the document** — a title for the
   chat, or the sender's note about what to look at. Both are easy to add in the envelope and
   both make the link less about the document.
3. **What a submission should do with a draft that arrived by link.** Today it is submitted as
   any other document and nothing records where it came from, which matters for the reviewer
   of the pull request CI will open.
4. **Whether the mobile app ever reads a shared link.** `screens/` are documents and a link
   names one; a route for a link on the phone is ADR 0075 §7's question, not this one's.