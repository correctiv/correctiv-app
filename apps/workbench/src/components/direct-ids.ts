/**
 * Which of the app's components this site cannot draw in its own React tree.
 *
 * A list of exceptions, not of members. `direct.tsx` takes its roster from the
 * app's own `gallery/catalogue.tsx`, so the question this file answers is the
 * only one the app cannot answer for itself: which entries fail once they are
 * mounted by React DOM instead of by React Native.
 *
 * Plain data and no React, so `test/direct.test.ts` can hold these ids against
 * `content/api.generated.json` without React Native or a Vite build in the way.
 *
 * **Measured, not guessed** (decision 18 of the redesign). Every entry carries
 * the reason in the words the card prints, because a reader looking at a card
 * that says "drawn in the app's bundle" is owed the reason on the page rather
 * than in a commit message.
 *
 * `group/name` is the app's own address for a component — `gallery/catalogue.tsx`'s
 * `componentId`, and the string `?c=` carries in both directions.
 *
 * **A reason written here is a string somebody reads, so it has to be a message.**
 * The card prints it in place of `components.card.bundleNote`, and this site's own
 * words follow the language setting ([ADR 0052](../../../../adr/0052-the-sites-own-words-follow-the-setting.md) §1).
 * `test/rendered-literals.test.ts` cannot see it: it walks JSX children and visible
 * props, and a string sitting in a `Record` is neither. So the rule is stated here,
 * where somebody writing the first one will read it, rather than enforced. The
 * record is empty today, which is why this is a note and not a `MessageDescriptor`
 * in the type — a shape nothing uses is a shape nobody keeps right.
 */
export const NOT_DRAWN: Record<string, string> = {};

/** Whether `group/name` is one this site draws itself. */
export function isDrawnHere(id: string): boolean {
  return !(id in NOT_DRAWN);
}
