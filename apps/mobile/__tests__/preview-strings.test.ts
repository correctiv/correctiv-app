import { CATALOGUES } from '@correctiv/catalogue';

import { PREVIEW_STRINGS_KEY, withPreviewStrings } from '@/lib/strings';

/**
 * The limit on the one key that can change what the app says.
 *
 * [ADR 0056](../../../adr/0056-a-string-is-picked-where-it-renders.md) §7: the
 * workbench may reword a string the catalogue already carries and may not extend the
 * vocabulary. That limit is the app's to hold, because the writer is a page on a
 * public URL and `localStorage` is anybody's to type into, so every refusal is asserted
 * here rather than in the workbench.
 */

const DE = CATALOGUES.de;
const key = (value: unknown) => JSON.stringify(value);

describe('the wordings the workbench may put on screen', () => {
  it('is spelled under the prefix that says who changed the screen', () => {
    expect(PREVIEW_STRINGS_KEY).toBe('workbench:strings');
  });

  it('rewords an id the shipped catalogue carries', () => {
    const merged = withPreviewStrings(key({ de: { 'home.viewAll': 'Alle zeigen' } }), 'de', DE);
    expect(merged['home.viewAll']).toBe('Alle zeigen');
    expect(merged['home.factChecks']).toBe(DE['home.factChecks']);
  });

  it('ignores an id the catalogue does not carry, so no new string can appear', () => {
    const merged = withPreviewStrings(key({ de: { 'home.invented': 'Neu' } }), 'de', DE);
    expect(merged).toBe(DE);
    expect('home.invented' in merged).toBe(false);
  });

  it('ignores an inherited name, which is not an id the catalogue carries', () => {
    const merged = withPreviewStrings(key({ de: { toString: 'x', constructor: 'y' } }), 'de', DE);
    expect(merged).toBe(DE);
  });

  it('ignores anything that is not a string', () => {
    const text = key({ de: { 'home.viewAll': 3, 'home.factChecks': null, 'home.allIssues': {} } });
    expect(withPreviewStrings(text, 'de', DE)).toBe(DE);
  });

  it('applies only the wordings for the language being rendered', () => {
    const text = key({ de: { 'home.viewAll': 'Alle zeigen' } });
    expect(withPreviewStrings(text, 'en', CATALOGUES.en)).toBe(CATALOGUES.en);
  });

  it('reads junk as nobody asking', () => {
    for (const junk of [null, '', 'not json', '[]', '"de"', key({ de: [] }), key({ de: 'x' })]) {
      expect(withPreviewStrings(junk, 'de', DE)).toBe(DE);
    }
  });

  it('hands back the shipped object when nothing differs, so the provider re-renders nothing', () => {
    const same = withPreviewStrings(key({ de: { 'home.viewAll': DE['home.viewAll'] } }), 'de', DE);
    expect(same).toBe(DE);
  });

  it('never writes into the shipped catalogue', () => {
    const before = DE['home.viewAll'];
    withPreviewStrings(key({ de: { 'home.viewAll': 'Alle zeigen' } }), 'de', DE);
    expect(DE['home.viewAll']).toBe(before);
  });
});
