import { joinScreenDocuments } from '@correctiv/app-core/lib/screen-layout';
import { HOME_LAYOUT_MAX_CHARS } from '@correctiv/app-core/stores/homeLayout';

/**
 * How close the joined document is to the size the app refuses.
 *
 * ADR 0075 §7 gives the joined document no count of its own: its bound is
 * `HOME_LAYOUT_MAX_CHARS`, the figure that actually fails, "and the workbench warns before
 * a document gets near" it. This is that warning's arithmetic, and the only number it adds
 * is a fraction of the one that exists, so raising the limit raises the point where the
 * tool speaks with it.
 */

/** Where the tool starts saying so, as a share of the limit. */
export const SIZE_WARNING_FRACTION = 0.8;

/** The length, in characters, from which the tool warns. Derived, never typed. */
export const SIZE_WARNING_AT = Math.floor(HOME_LAYOUT_MAX_CHARS * SIZE_WARNING_FRACTION);

export interface SizeReading {
  /** The joined document's length, as the app counts it. */
  length: number;
  /** What the app refuses past. */
  limit: number;
  /** Whether the length is at or beyond the point where the tool warns. */
  near: boolean;
  /** Whether the app would refuse it outright. */
  over: boolean;
}

/**
 * The joined document as the deploy writes it (`join-screen-layouts.ts`): every screen's
 * file under its id, the navigation beside them, minified. The app counts the characters
 * of that text, so that is what is measured and not the printed files, whose indentation
 * the deploy never ships.
 */
export function joinedLength(
  screens: Readonly<Record<string, string>>,
  navigation: string,
): number {
  const documents: Record<string, unknown> = {};
  for (const [id, text] of Object.entries(screens)) documents[id] = JSON.parse(text);
  return `${JSON.stringify(joinScreenDocuments(documents, JSON.parse(navigation)))}\n`.length;
}

export function readSize(length: number): SizeReading {
  return {
    length,
    limit: HOME_LAYOUT_MAX_CHARS,
    near: length >= SIZE_WARNING_AT,
    over: length > HOME_LAYOUT_MAX_CHARS,
  };
}
