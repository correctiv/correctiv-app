/**
 * One fragment identifier, for every id this site mints.
 *
 * There were two of these and they disagreed. `plugin/markdown.ts` kept letters
 * with `\p{L}` so that a German heading became `über-uns`, the way GitHub spells
 * it, and `pages/Sources.tsx` stripped everything outside `a-z0-9`, which turns
 * the same words into `ber-uns`. Both were correct about their own ids and
 * neither could be right about the other's, because an anchor is only ever half
 * of a pair: the id one function writes and the `href` the other one reads.
 *
 * **The two never actually met.** Heading ids live in rendered documents; the
 * board's `row-`/`det-` ids live inside one page, which mints them and links to
 * them itself, and no Markdown document links into a board row. So this fixes no
 * broken anchor today. What it removes is the reason the next one would be hard
 * to see: a link from a document into the board is a plausible thing to write,
 * it would look right in the source, and it would resolve to nothing on a
 * heading with an umlaut, which this repository's documents are full of.
 *
 * It lives here rather than beside either caller because `plugin/` is the wrong
 * direction to import from: `markdown.ts` reaches for `marked` and `node:path`,
 * so a page that imported its `slug` would be asking the browser bundle to
 * resolve Node. This file imports nothing, so the plugin can reach into `src/`
 * for it and pay nothing.
 */

/**
 * GitHub's own heading slugs, closely enough that hand-written anchors keep
 * working: lower case, punctuation dropped, whitespace runs to single hyphens.
 *
 * `\p{L}` and the `u` flag are the load-bearing part. Without them every
 * non-ASCII letter is punctuation, so `Größe` and `Groe` slug the same and a
 * German heading loses the half of itself a reader would recognise.
 */
export function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-');
}

/**
 * The board's own row ids, which are not heading slugs and must not become them.
 *
 * `slug()` follows GitHub and DROPS punctuation without putting anything in its
 * place, which is right for a heading — "Hello, World" is `hello-world` there
 * too. It is wrong here, because three of these labels put a full stop BETWEEN
 * two words: `CORRECTIV.Schweiz` would slug to `correctivschweiz` and the two
 * words would run together.
 *
 * That is not only ugly. `row-correctiv-schweiz` is a published address — the
 * page reads `#row-…` off the location bar — and the workbench deploys on every
 * push to main, so changing it silently retires every link anybody is holding.
 * Turning punctuation into a space first keeps the ids exactly as they were and
 * still leaves one slug function in the package.
 */
export function feedId(label: string): string {
  return slug(label.replace(/[^\p{L}\p{N}]+/gu, ' '));
}
