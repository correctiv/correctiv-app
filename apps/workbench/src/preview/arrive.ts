/**
 * A draft that comes out of the address, once, on arrival (ADR 0076 §3).
 *
 * **Out of `Preview.tsx` and into a module that can be asked.** The read is four lines and
 * the argument around it is long, and the whole of that argument is about what must not
 * happen to the machine that opens the link: nothing of the draft may be written into its
 * storage before a person has edited it. That is a claim about behaviour and a test is the
 * only thing that can hold it, so the path is a function that takes an address rather than
 * an effect nobody can reach from Node (`test/preview/arrive.test.ts` is the test).
 */

import { holdIncoming, noteDamaged, selectLayout, setScreen } from './home/store';
import { isLayout, isScreen, routeOf } from './home/screens';
import { holdIncomingNavigation } from './navigation/store';
import { packedIn, unpack } from './share';
import { EXAMPLE_LAYOUT } from '@correctiv/app-core/data/layouts/registry';
import { NAVIGATION_TARGET } from './home/names';
import { set } from './store';

/**
 * Take the draft out of `hash` and hand it to the tool, or say that there was none.
 *
 * **Nothing is written into the address on the way.** The tool that made the link put the
 * draft there, and the tool that opens it does not write it back: `toAddress` writes the
 * frame's own parameters and a draft is not one, so a link that carried one and were
 * rewritten would go on claiming a draft the tool has moved on from — the first edit would
 * leave a stale address behind. The draft travels out of the address and into the editor,
 * the button is the only thing that makes one again, and what the address says stays true.
 *
 * **One sentence for everything that is not a draft.** Damaged characters, an envelope the
 * core will not open, a screen that does not exist: three faults, one `noteDamaged`, and no
 * difference a person could act on.
 *
 * Returns whether a draft was taken, which the caller here does nothing with and a test
 * reads.
 */
export async function arriveFrom(hash: string): Promise<boolean> {
  const packed = packedIn(hash);
  if (packed === null) return false;
  const arrival = await unpack(packed);
  const draft = arrival === null || 'damaged' in arrival ? null : arrival.draft;
  /*
   * The navigation is not a screen and has no frame route of its own: the address the link
   * carries already names the tool, so there is nothing to move, only a document to hold.
   */
  /*
   * The layout the draft is of, opened first: switching layouts drops what the editor holds,
   * and a draft held before it would be dropped with it. A link made before layouts names
   * none and means `demo` (`unpack`); one naming a folder this build does not have is a link
   * that cannot be opened.
   */
  if (draft !== null) {
    const layout = draft.layout ?? EXAMPLE_LAYOUT;
    if (!isLayout(layout)) {
      noteDamaged();
      return false;
    }
    selectLayout(layout);
    set({ layout });
  }
  if (draft?.screen === NAVIGATION_TARGET) {
    if (holdIncomingNavigation(draft.document)) return true;
    noteDamaged();
    return false;
  }
  if (draft === null || !isScreen(draft.screen)) {
    noteDamaged();
    return false;
  }
  if (!holdIncoming(draft.screen, draft.document)) return false;
  /*
   * The screen the draft belongs to, and the frame goes to it with the tool. The editor
   * holds one document at a time (`home/store.ts`), so a draft for another screen loaded
   * without this would be in the store and on no screen at all — the reader would be sent
   * an address they cannot see.
   */
  setScreen(draft.screen);
  set({ route: routeOf(draft.screen) });
  return true;
}
