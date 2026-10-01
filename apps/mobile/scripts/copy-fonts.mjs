#!/usr/bin/env node
/**
 * Refreshes `assets/fonts/` from `@expo-google-fonts`, renamed to each file's
 * PostScript name: Android registers an embedded family by file name, iOS by
 * PostScript name, and a mismatch is a silent fallback to the system font. The
 * TTFs are committed; run this only when a cut changes (`npm run copy-fonts`).
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
