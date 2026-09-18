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
    '{records} Protokolle, nie umgeschrieben. Macht eine spätere Entscheidung eine frühere Aussage falsch, wird die Aussage an Ort und Stelle durchgestrichen, und das spätere Protokoll benennt, was es zurückgezogen hat. Lesen Sie eine Zeile, um zu sehen, ob ein Protokoll noch gilt; folgen Sie den Bögen, um zu sehen, wer es geändert hat.',
};
