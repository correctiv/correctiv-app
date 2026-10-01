// Reconcile the families this app asks for against the ones the running font map has.
//
// ## Why this is not a lookup table
//
// The same byte-identical face registers under a different family name depending on
// which font stack reads its naming table. Measured on two machines against the same
// SHA-256:
//
//   Linux   (fontconfig)  Merriweather_400Regular.ttf -> "Merriweather"
//   Windows (gvsbuild)    Merriweather_400Regular.ttf -> "Merriweather 18pt"
//
// Google Fonts ships Merriweather as an optical-size family and the two readers
// disagree about whether the size axis belongs in the family name. `Source Sans 3` has
// no such axis and reads identically on both, which is what makes the difference look
// like a broken font rather than a naming convention.
//
// Both were reported as registered. `pango_font_map_add_font_file()` answered success
// for all five faces on Windows, and `Merriweather` still was not on the map — so the
// registration call cannot be the thing that is checked. Only the map can answer, which
// is the same reason `debug/font-probe.ts` exists.
//
// ## Why it runs before the first render
//
// The class compiler bakes the family into the minted class, so a name corrected after
// the first `<Text>` would leave earlier widgets asking for a family nothing has. This
// runs in `entry.tsx` beside `configureStyleOnce()`, for the same reason.

import PangoCairo from 'gi://PangoCairo?version=1.0';

import { matchFontFamily } from '@gjsify/gtk-host/fonts';

import { FONT_FAMILIES, setFamilyAlias } from './fonts.js';

/** What `alignFamilies()` found, so a caller can log or assert on it. */
export interface AlignFamiliesResult {
  /** Families whose declared name is exactly what the map calls them. */
  readonly exact: readonly string[];
  /** Families the map calls something else, as `declared -> actual`. */
  readonly aliased: readonly (readonly [string, string])[];
  /** Families the map does not have under any name this can recognise. */
  readonly missing: readonly string[];
  /** How many families the map knows in total, for context in a log line. */
  readonly onMap: number;
}

/**
 * Ask the default font map what it calls each declared family, and record the answer.
 *
 * `missing` is the honest outcome rather than a guess: `matchFontFamily` accepts an
 * exact name or a single optical-size variant of it, so a family with several optical
 * sizes — a real choice about which size to use at which point size — lands here
 * instead of being picked at random. Whatever ends up in `missing` will be
 * substituted by Pango with no diagnostic, so the caller must say so.
 */
export function alignFamilies(): AlignFamiliesResult {
  const available = PangoCairo.FontMap.get_default()
    .list_families()
    .map((family) => family.get_name());

  const exact: string[] = [];
  const aliased: (readonly [string, string])[] = [];
  const missing: string[] = [];

  for (const declared of FONT_FAMILIES) {
    const actual = matchFontFamily(declared, available).family;
    if (actual === undefined) {
      missing.push(declared);
      continue;
    }
    if (actual === declared) {
      exact.push(declared);
      continue;
    }
    setFamilyAlias(declared, actual);
    aliased.push([declared, actual]);
  }

  return { exact, aliased, missing, onMap: available.length };
}
