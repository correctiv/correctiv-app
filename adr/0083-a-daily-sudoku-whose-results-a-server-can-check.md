# ADR 0083 — A daily Sudoku whose results a server can check

Status: accepted, 2026-10-08. **Built:** the game, the small card and the full screen, the
local high score table, the nickname. Not built: a shared table, which is the last section.

## Context

The request was a Sudoku for members: a small card on a screen with a way into the full
game, a page of its own with the game, and a high score table. The table is local first and
meant to become public later, so members can compare themselves with each other. Where a
member has set a nickname in the profile, the table shows it; otherwise the first name and
the initial of the last.

Two of those requirements shape the code before anything is shared. A table other members
read is a table somebody will try to cheat, and a table that prints names prints them to
people the member does not know. Both are cheaper to settle now, while there is no server,
than after results have been stored in a shape that cannot answer either.

## Decision

### 1. A puzzle is a function of its seed

`packages/app-core/src/sudoku/puzzle.ts` generates every puzzle from a seeded generator
(Mulberry32) and nothing else, and every puzzle it returns has exactly one solution. The
daily puzzle's seed is a hash of the Berlin date and the difficulty, so every member plays the
same grid on the same day. A puzzle's id, `medium-1a2b3c`, is the difficulty and the seed, and
`parsePuzzleId` reads it back. A server can therefore rebuild any grid a result names without
the app uploading a board.

### 2. Points are a function of four facts

`pointsFor` in `sudoku/score.ts` takes the difficulty, the seconds, the mistakes and the
hints, and nothing else. A result carries those four, so whoever receives one recomputes its
points instead of trusting them. Equal points rank the faster result first, then the earlier.

### 3. The name is the nickname, or the first name and one initial

`lib/player-name.ts` in the core decides it: a nickname the member chose, normalised and
at most 24 characters, otherwise "Alex B." from the account's name. A full name never reaches
a result, so a member who never chose a nickname cannot appear in a public table under the
name on their membership. The nickname is a setting (`settings.nickname`, persisted) and is
edited in Einstellungen, under the account, which is where the profile keeps what a member
says about themselves.

### 4. A daily puzzle counts once

`startDaily` keeps a daily puzzle that is on the board, and refuses to deal one already solved
that day. A second attempt at a grid whose answer the player has seen is not a result.

### 5. The clock is two numbers, not a timer

The slice keeps the elapsed time of closed stretches of play and the moment the open one
began. The screen resumes the clock when it is in front and pauses it when it is left or the
app goes to the background, and hydration stops a clock that was running when the app went
away. Nothing is dispatched every second: the store is already tuned around an audio tick, and
a timer would be a second one.

### 6. It is `vorschau`, in a group of its own, on `demo`'s Mitmachen

The feature `sudoku` is in a new group `games`, both `vorschau`, so a store build does not
reach it (ADR 0072) while the dev server, the web demo and a tester APK do. The block
`sudoku-card` is placed on `demo`'s Mitmachen screen and on nothing in `ship` (ADR 0078 §3).
Whether a game belongs in the app at all is the product's decision, and this makes it one
commit to `features.json` and one to `ship`.

## Consequences

- The core gains a directory, `sudoku/`, beside `features/` and `media/`, and a slice.
- Results stay on the device, at most `SCORES_KEPT` of them, weakest dropped first.
- The table prints the name a member had when they finished. Changing the nickname later does
  not rename old results, which is also what a shared table will do.

## What this does not decide

1. **The shared table.** Where results go, how a member's results are tied to their account
   without the name being the key, and what a server rejects. §1 and §2 are what make that
   checkable; neither says who runs it.
2. **Whether the times are plausible.** A result solved in two seconds is a valid result here.
   A shared table needs a floor or a review, and that is a question about cheating, not about
   the game.
