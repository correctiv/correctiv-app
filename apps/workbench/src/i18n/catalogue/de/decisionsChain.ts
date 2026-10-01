/**
 * German for the `decisionsChain.*` ids: the second drawing, which decisions
 * still stand.
 *
 * **Two ids, and that is the whole of this drawing's translation today.** The
 * picture, its legend, its caption and the list under it are still English
 * literals in `src/diagrams/DecisionsChain.tsx` and `src/diagrams/layout.ts`,
 * which `test/rendered-literals.test.ts` counts. Every sentence under that
 * drawing is assembled from the records at build time, so moving it means
 * turning two string builders into ICU, and that is a pass of its own.
 *
 * The vocabulary is `/decisions`'s: "Protokoll" for a record, "Aussage" for a
 * claim, "zurückgezogen" for what a later record retired.
 */
export const decisionsChain: Record<string, string> = {
  'decisionsChain.title': 'Welche Entscheidungen noch gelten und welche ihrer Aussagen nicht',
  'decisionsChain.lede':
    '{records} Protokolle, nie umgeschrieben. Macht eine spätere Entscheidung eine frühere Aussage falsch, wird die Aussage durchgestrichen, und das spätere Protokoll nennt, was es zurückgezogen hat. Eine Zeile zeigt, ob ein Protokoll noch gilt. Die Bögen zeigen, welches Protokoll es geändert hat.',
};
