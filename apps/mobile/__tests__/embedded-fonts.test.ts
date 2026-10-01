import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '..');

/**
 * Guards the five font families that the app ships embedded via the `expo-font`
 * config plugin against the one failure mode this repository has seen twice: the
 * registered name drifting between platforms, between the plugin config and the
 * `useFonts` keys, or between the keys and the hardcoded literals in component
 * code.
 *
 * Android registers an embedded family by FILE name; iOS by the TTF's PostScript
 * name (name ID 6). If those two disagree, or if they disagree with the name used
 * in a `fontFamily` style, React Native silently falls back to the system font —
 * no warning, just different glyphs and weights.
 *
 * This test reads the PostScript name out of each TTF itself, then walks every
 * name the app writes — the keys in `font-assets.ts`, the values in `fonts.ts`,
 * and the three hardcoded literals in `Chip.tsx`, `_layout.tsx` and
 * `_layout.web.tsx` — and demands they all agree with the file name, which agrees
 * with the PostScript name. The file name is the bridge: it is what Android sees,
 * it is what `app.json`'s plugin config references, and it is what the test
 * renames if a fix is needed. Changing any one name without the others fails this
 * test, because each assertion reads a different source than the last.
 */

/** The five PostScript names, read from the TTF `name` table (name ID 6). */
function readPostScriptName(ttfPath: string): string {
  const buf = readFileSync(ttfPath);
  const numTables = buf.readUInt16BE(4);
  let nameTableOffset = -1;
  for (let i = 0; i < numTables; i++) {
    const entryOffset = 12 + i * 16;
    const tag = buf.toString('ascii', entryOffset, entryOffset + 4);
    if (tag === 'name') {
      nameTableOffset = buf.readUInt32BE(entryOffset + 8);
      break;
    }
  }
  if (nameTableOffset < 0) throw new Error(`no 'name' table in ${ttfPath}`);

  const count = buf.readUInt16BE(nameTableOffset + 2);
  const stringOffset = buf.readUInt16BE(nameTableOffset + 4);
  // Prefer Windows UCS-2 (platformID 3, encodingID 1); fall back to Mac Roman.
  for (let i = 0; i < count; i++) {
    const rec = nameTableOffset + 6 + i * 12;
    const platformId = buf.readUInt16BE(rec);
    const encodingId = buf.readUInt16BE(rec + 2);
    const nameId = buf.readUInt16BE(rec + 6);
    if (nameId !== 6) continue;
    if (platformId === 3 && encodingId === 1) {
      const len = buf.readUInt16BE(rec + 8);
      const off = buf.readUInt16BE(rec + 10);
      // Windows name records are UTF-16BE; Buffer only decodes utf16le, so swap
      // 16-bit words in-place to convert BE → LE.
      const raw = buf.subarray(
        nameTableOffset + stringOffset + off,
        nameTableOffset + stringOffset + off + len,
      );
      return Buffer.from(raw).swap16().toString('utf16le').trim();
    }
  }
  for (let i = 0; i < count; i++) {
    const rec = nameTableOffset + 6 + i * 12;
    const nameId = buf.readUInt16BE(rec + 6);
    const platformId = buf.readUInt16BE(rec);
    if (nameId === 6 && platformId === 1) {
      const len = buf.readUInt16BE(rec + 8);
      const off = buf.readUInt16BE(rec + 10);
      return buf
        .toString(
          'latin1',
          nameTableOffset + stringOffset + off,
          nameTableOffset + stringOffset + off + len,
        )
        .trim();
    }
  }
  throw new Error(`could not find PostScript name (nameID 6) in ${ttfPath}`);
}

const FONT_DIR = resolve(ROOT, 'assets', 'fonts');
const FONT_FILES = readdirSync(FONT_DIR)
  .filter((f) => f.endsWith('.ttf'))
  .sort();

/** PostScript name extracted from each font file's name table. */
const postScriptNames: Record<string, string> = {};
for (const file of FONT_FILES) {
  postScriptNames[file] = readPostScriptName(resolve(FONT_DIR, file));
}
const postScriptSet = new Set(Object.values(postScriptNames));

describe('embedded font names', () => {
  it('registers all five families', () => {
    expect(FONT_FILES).toEqual([
      'Merriweather-Bold.ttf',
      'Merriweather-Regular.ttf',
      'SourceSans3-Bold.ttf',
      'SourceSans3-Regular.ttf',
      'SourceSans3-SemiBold.ttf',
    ]);
  });

  it('names each file after its PostScript name (name ID 6)', () => {
    for (const [file, ps] of Object.entries(postScriptNames)) {
      const fileName = file.replace(/\.ttf$/, '');
      expect(fileName).toBe(ps);
    }
  });
});

describe('app.json expo-font plugin', () => {
  const config = JSON.parse(readFileSync(resolve(ROOT, 'app.json'), 'utf8')) as {
    expo: { plugins?: (string | [string, Record<string, unknown>])[] };
  };

  function fontPluginOptions(): Record<string, unknown> | null {
    for (const entry of config.expo.plugins ?? []) {
      if (Array.isArray(entry) && entry[0] === 'expo-font') return entry[1] ?? {};
    }
    return null;
  }

  const opts = fontPluginOptions();

  it('is configured (no longer bare "expo-font")', () => {
    expect(opts).not.toBeNull();
  });

  it('references exactly the five font files', () => {
    const fonts = (opts?.fonts as string[] | undefined) ?? [];
    expect(fonts).toHaveLength(5);
    for (const p of fonts) {
      expect(p).toMatch(/^\.\/assets\/fonts\/.*\.ttf$/);
      const file = p.replace(/^\.\/assets\/fonts\//, '');
      expect(postScriptSet).toContain(file.replace(/\.ttf$/, ''));
    }
  });
});

describe('fontAssets keys agree with the embedded names', () => {
  const src = readFileSync(resolve(ROOT, 'src/lib/theme/font-assets.ts'), 'utf8');
  const blockMatch = src.match(/export const fontAssets = \{([\s\S]*?)\};/);

  it('has a fontAssets block', () => {
    expect(blockMatch).not.toBeNull();
  });

  it('every key is a PostScript name', () => {
    const block = blockMatch![1];
    const objectKeys = Array.from(block.matchAll(/'([^']+)':/g)).map((m) => m[1]);
    expect(objectKeys).toHaveLength(5);
    for (const k of objectKeys) {
      expect(postScriptSet).toContain(k);
    }
  });
});

describe('FAMILY_MAP values agree with the embedded names', () => {
  const src = readFileSync(resolve(ROOT, 'src/lib/theme/fonts.ts'), 'utf8');
  // Extract every string literal assigned as a FAMILY_MAP value.
  const values = Array.from(src.matchAll(/:\s*'([^']+)'/g)).map((m) => m[1]);

  it('every value is a PostScript name', () => {
    expect(values.length).toBeGreaterThan(0);
    for (const v of values) {
      expect(postScriptSet).toContain(v);
    }
  });
});

describe('hardcoded fontFamily literals agree with the embedded names', () => {
  const sites = [
    resolve(ROOT, 'src/components/ui/Chip.tsx'),
    resolve(ROOT, 'src/app/(tabs)/_layout.tsx'),
    resolve(ROOT, 'src/app/(tabs)/_layout.web.tsx'),
  ];

  for (const path of sites) {
    const src = readFileSync(path, 'utf8');
    it(`uses a PostScript name in ${path.replace(ROOT + '/', '')}`, () => {
      const matches = Array.from(src.matchAll(/fontFamily:\s*'([^']+)'/g));
      expect(matches.length).toBeGreaterThan(0);
      for (const m of matches) {
        expect(postScriptSet).toContain(m[1]);
      }
    });
  }
});

describe('no stale export names survive as fontFamily values', () => {
  const stale = [
    'Merriweather_400Regular',
    'Merriweather_700Bold',
    'SourceSans3_400Regular',
    'SourceSans3_600SemiBold',
    'SourceSans3_700Bold',
  ];
  const sources = [
    'src/lib/theme/font-assets.ts',
    'src/lib/theme/fonts.ts',
    'src/components/ui/Chip.tsx',
    'src/app/(tabs)/_layout.tsx',
    'src/app/(tabs)/_layout.web.tsx',
    'src/lib/env/fonts.ts',
  ];

  for (const rel of sources) {
    const src = readFileSync(resolve(ROOT, rel), 'utf8');
    it(`does not use stale names as fontFamily values in ${rel}`, () => {
      for (const s of stale) {
        expect(src).not.toMatch(new RegExp(`fontFamily:\\s*['"]${s}['"]`));
      }
    });
  }
});
