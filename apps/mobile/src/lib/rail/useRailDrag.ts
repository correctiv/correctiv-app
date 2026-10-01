import type { Ref } from 'react';
import type { ScrollView } from 'react-native';

/**
 * Lets a mouse drag a rail sideways — nothing, on iOS and Android, where a
 * finger already does it.
 *
 * The pair exists so that `components/ui/Rail` stays one component with one
 * layout. Only the behaviour is split, and only the half a browser needs is
 * written; `useRailDrag.web.ts` is that half and carries the argument for what
 * it does.
 *
 * Returning `undefined` rather than a ref that does nothing is deliberate: the
 * native bundle then hands `ScrollView` no ref at all, which is what it had
 * before this existed.
 */
export function useRailDrag(): Ref<ScrollView> | undefined {
  return undefined;
}
