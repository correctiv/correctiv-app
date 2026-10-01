/**
 * The five font files, and the only module in `lib/theme` that reaches Expo.
 *
 * Apart from the root layout nothing in the app needs the files; what components
 * need is the family *name*, which is `fontFamilyFor()` in `./fonts` and a plain
 * string. Splitting the two is not tidiness, and it is not a build fix either:
 * `@expo-google-fonts/*` is a `require()` of a `.ttf`, which Metro registers as
 * an asset and a plain bundler emits as a file, so both toolchains cope. What it
 * costs is size, and the size is absurd. The package's entry re-exports every cut
 * it ships — light through black, italics included — and a `require()` of a file
 * is a side effect no tree shaker will drop. Measured on 2026-09-11 by building
 * `<Typo>` alone outside Metro: **19,828 kB of `.ttf` against 424 kB** once this
 * module left the barrel. `./fonts` is re-exported by `lib/theme`'s barrel, so
 * every component that writes `import { useColors } from '@/lib/theme'` was
 * carrying all of it (ADR 0027).
 *
 * So this module is deliberately NOT in the barrel. `app/_layout.tsx` imports it
 * by path, and it is the only thing that should.
 *
 * The keys are the PostScript names (name ID 6 from the TTF `name` table), not
 * the `@expo-google-fonts` export names. Android's config plugin registers an
 * embedded family by file name and iOS by PostScript name; making both match
 * means `useAppFonts()` can resolve on the first render instead of after an
 * async load, and the two platforms never disagree about which font is in use.
 * The files live in `assets/fonts/` under those same names (`scripts/copy-fonts.mjs`).
 */
import { Merriweather_400Regular, Merriweather_700Bold } from '@expo-google-fonts/merriweather';
import {
  SourceSans3_400Regular,
  SourceSans3_600SemiBold,
  SourceSans3_700Bold,
} from '@expo-google-fonts/source-sans-3';

/** Passed to useFonts() — loads every cut before the first render. */
export const fontAssets = {
  'Merriweather-Regular': Merriweather_400Regular,
  'Merriweather-Bold': Merriweather_700Bold,
  'SourceSans3-Regular': SourceSans3_400Regular,
  'SourceSans3-SemiBold': SourceSans3_600SemiBold,
  'SourceSans3-Bold': SourceSans3_700Bold,
};
