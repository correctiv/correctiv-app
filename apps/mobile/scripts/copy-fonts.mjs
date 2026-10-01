#!/usr/bin/env node
/**
 * Copies the five cut the app ships into native build assets, under names that
 * match each file's PostScript name.
 *
 * Why this script exists: the expo-font config plugin, given a string path, embeds
 * the file at build time. Android registers the family by FILE name; iOS by the
 * TTF's PostScript name (name ID 6). A mismatch between the two is a silent
 * fallback — React Native picks the system font, no warning, different glyphs.
 *
 * `useFonts` still keys by the names in `lib/theme/fonts.ts`, so the embedding
 * only makes the initial `isLoaded()` check return true on Android (file name
 * matches the key). On iOS the PostScript name is what the native side knows, so
 * `useFonts` still loads at runtime — but it still works, because the alias it
 * creates matches the style name. The risk of silent fallback exists only if
 * someone deletes `useFonts` AND relies on embedding alone; this script and the
 * test in `__tests__/embedded-fonts.test.ts` keep the two in agreement.
 *
 * Run before each prebuild: `npm run copy-fonts`
 */
import { copyFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const GF = resolve(ROOT, 'node_modules', '@expo-google-fonts');
const OUT = resolve(ROOT, 'assets', 'fonts');

/**
 * Pairs of [source path in node_modules, output filename]. Output names follow
 * each TTF's PostScript name (name ID 6), so Android (file name) and iOS
 * (PostScript name) register the same string.
 */
const FONTS = [
  [resolve(GF, 'merriweather/400Regular/Merriweather_400Regular.ttf'), 'Merriweather-Regular.ttf'],
  [resolve(GF, 'merriweather/700Bold/Merriweather_700Bold.ttf'), 'Merriweather-Bold.ttf'],
  [resolve(GF, 'source-sans-3/400Regular/SourceSans3_400Regular.ttf'), 'SourceSans3-Regular.ttf'],
  [
    resolve(GF, 'source-sans-3/600SemiBold/SourceSans3_600SemiBold.ttf'),
    'SourceSans3-SemiBold.ttf',
  ],
  [resolve(GF, 'source-sans-3/700Bold/SourceSans3_700Bold.ttf'), 'SourceSans3-Bold.ttf'],
];

mkdirSync(OUT, { recursive: true });

for (const [src, dest] of FONTS) {
  copyFileSync(src, resolve(OUT, dest));
}

// Report what landed, as a human-readable summary.
const copied = FONTS.map(([_, dest]) => dest);
console.log(`copied ${copied.length} fonts to ${OUT}:`);
for (const f of copied) console.log(`  ${f}`);
