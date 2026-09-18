import { createIntl } from 'react-intl';
import { describe, expect, it } from 'vitest';

import { de } from '../../src/i18n/catalogue/de';
import { SOURCE_LANGUAGE } from '../../src/i18n/language';
import { frameLabel, frameShort, handover, repoPath } from '../../src/preview/handover';
import type { Located } from '../../src/preview/frame/locate';

/**
 * English, which is every `defaultMessage`, so the assertions below are the block
 * as it is written in the source. The German run underneath is the one that would
 * catch a column padded by hand again.
 */
const english = createIntl({ locale: SOURCE_LANGUAGE, defaultLocale: SOURCE_LANGUAGE });
const german = createIntl({ locale: 'de', defaultLocale: SOURCE_LANGUAGE, messages: de });

const frame = (file: string, lineNumber: number, methodName: string | null = null): Located => ({
  file: `/home/someone/projects/correctiv-app/${file}`,
  lineNumber,
  column: 0,
  methodName,
});

const CHAIN = [
  frame('apps/mobile/src/components/ui/Chip.tsx', 31, 'Chip'),
  frame('apps/mobile/src/app/(tabs)/entdecken.tsx', 88, 'EntdeckenScreen'),
  frame('apps/mobile/src/app/_layout.tsx', 101, 'RootLayout'),
];

describe('repoPath', () => {
  it('drops the part that differs per machine', () => {
    expect(repoPath(CHAIN[0]!.file)).toBe('apps/mobile/src/components/ui/Chip.tsx');
  });

  it('leaves a path it does not recognise alone', () => {
    expect(repoPath('/tmp/elsewhere.ts')).toBe('/tmp/elsewhere.ts');
  });

  it('knows the three workspace roots', () => {
    for (const root of ['apps', 'packages', 'tools']) {
      expect(repoPath(`/x/y/${root}/a/b.ts`)).toBe(`${root}/a/b.ts`);
    }
  });
});

describe('handover', () => {
  const view = 'http://localhost:8081/preview.html#/entdecken?d=iphone-se&t=dark';

  it('names the selected level as the source and the rest as context', () => {
    const text = handover({ label: 'Klima', frames: CHAIN, selected: 0, view }, english);
    expect(text).toContain('Element: "Klima"');
    expect(text).toContain('Source:  apps/mobile/src/components/ui/Chip.tsx:31 · Chip');
    expect(text).toContain('Context: apps/mobile/src/app/(tabs)/entdecken.tsx:88');
    expect(text).toContain(`View:    ${view}`);
  });

  it('follows the selection, because only the person knows which level they meant', () => {
    const text = handover({ label: 'Klima', frames: CHAIN, selected: 1, view }, english);
    expect(text).toContain('Source:  apps/mobile/src/app/(tabs)/entdecken.tsx:88');
    expect(text).toContain('Context: apps/mobile/src/components/ui/Chip.tsx:31');
  });

  it('falls back to the innermost frame when the selection is out of range', () => {
    const text = handover({ label: 'Klima', frames: CHAIN, selected: 9, view }, english);
    expect(text).toContain('Source:  apps/mobile/src/components/ui/Chip.tsx:31');
  });

  it('says so rather than printing empty quotes for an unlabelled element', () => {
    expect(handover({ label: '', frames: CHAIN, selected: 0, view }, english)).toContain(
      'Element: (no label)',
    );
  });

  it('carries the view address, which is what makes the note reproducible', () => {
    const text = handover({ label: 'x', frames: CHAIN, selected: 0, view }, english);
    expect(text.trimEnd().endsWith(view)).toBe(true);
  });

  it('keeps one column in a language whose words are not the English lengths', () => {
    /*
     * The reason the padding is computed. Four literals padded by hand hold for
     * the four words they were counted against and for nothing else: `Kontext` is
     * a letter longer than `Context` and `Quelle` a letter shorter than `Source`,
     * so a German block written that way would stagger. Every line starts its
     * value at the same offset, in either language, and the continuation line of
     * the context chain starts there too.
     */
    // Everything up to and including the run of spaces after a `Word:`, which on
    // the chain's continuation line is the whole of the indent and nothing else.
    const valueStartsAt = (line: string) => line.length - line.replace(/^(\S*:)?\s+/, '').length;

    for (const intl of [english, german]) {
      const lines = handover({ label: 'Klima', frames: CHAIN, selected: 0, view }, intl).split(
        '\n',
      );
      expect(lines).toHaveLength(5);
      expect(new Set(lines.map(valueStartsAt)).size).toBe(1);
    }
  });
});

describe('frameLabel', () => {
  it('is the form a person would type', () => {
    expect(frameLabel(CHAIN[2]!)).toBe('apps/mobile/src/app/_layout.tsx:101');
  });

  it('shortens to something that still differs between rows', () => {
    expect(CHAIN.map(frameShort)).toEqual(['Chip.tsx:31', 'entdecken.tsx:88', '_layout.tsx:101']);
  });
});
