# Prototype: resolving a rendered string back to its id

**Throwaway. This branch is not for merging.** It is the measurement behind ADR 0056,
which is open as [#241](https://github.com/correctiv/correctiv-app/pull/241), kept so
the table in that record's Context can be re-taken rather than believed.

The record is named rather than linked, because it does not exist on this branch: this
one is off `main` so that a parking branch depends on nothing.

The question: a person points at a word in the framed app. How many message ids
could have produced it?

## Running it

    node prototype/strings-reverse-lookup/resolve.mjs

Reads `apps/workbench/content/strings.generated.json` and measures the whole
catalogue: every German wording, every plural branch rendered separately, each one
looked up against every other. Prints the collisions in full. Needs
`npm run workbench:strings` first if that table is missing or stale. Takes a second.

    node prototype/strings-reverse-lookup/dom.mjs

The same lookup against the app as built. Serves `apps/mobile/dist`, drives its own
headless Chrome over CDP, walks nineteen routes at phone width and asks the table
what each visible text could be. Needs `npm run build:web` first. Uses port 8137 and
refuses to run if something already holds it — the ports on this machine are shared,
and a measurement of somebody else's content is worse than no measurement. Takes
about two minutes.

## What it found

Three things, each of them a decision in the record rather than a detail here:
the match has to be on the text node, because a decorative arrow is a text node too;
a pattern of holes with punctuation between them matches almost any sentence and
cannot take part; and pointing reaches about a third of the catalogue, so the table
is the other half of the tool.

It also seeded the app's storage the way `preview/frame/seed.ts` does, because the
first run measured the login gate nineteen times and reported one screen as if it
were nineteen.
