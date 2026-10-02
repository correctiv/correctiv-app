import { renderToStaticMarkup } from 'react-dom/server';
import { createIntl } from 'react-intl';
import { describe, expect, it } from 'vitest';

import { Localisation } from '../../src/i18n/Localisation';
import { MARK_CHIP, markOf } from '../../src/preview/features/document';
import { FeatureChip } from '../../src/preview/features/Mark';
import { Segmented } from '../../src/ui/kit/segmented';
import { de } from '../../src/i18n/catalogue/de';

/**
 * The two halves of the picker a design review named, rendered rather than read as text.
 *
 * `palette.test.ts` holds the shape of the card by reading the source, which cannot see
 * whether a chip actually carries a tooltip or whether the tab row really holds seven
 * options. This renders both and asks, because the two faults were exactly of that kind:
 * **the mark was a three-line paragraph where a chip fits, and the tab row broke its seventh
 * option onto a line of its own.**
 *
 * `renderToStaticMarkup` rather than a browser or jsdom, for the reason
 * `shell/tool-panel.test.tsx` gives: the defect is in what the first render contains, and it
 * also costs no DOM. What cannot be asked here is pixels — jsdom lays nothing out, so a
 * height or a wrap is invisible from here, which is why `palette.test.ts` holds the classes
 * and this file holds the content.
 */

/** The site's own formatter, for the words a German reader sees. */
const german = createIntl({ locale: 'de', defaultLocale: 'en', messages: de });

/**
 * Three features out of the release file, because the three states a mark can be in are all
 * reachable: `early-access` is held back and reads sample data, `atlas` is declared nowhere
 * at all, and `reader` ships.
 */
const PREVIEW_ONLY = 'early-access';
const OFF = 'atlas';
const SHIPPING = 'reader';

const chip = (feature: string): string =>
  renderToStaticMarkup(
    <Localisation language="de">
      <FeatureChip feature={feature} />
    </Localisation>,
  );

/** The text inside the chip's own span, with the title's words left out of it. */
function said(html: string): string {
  return html.match(/<span class="min-w-0 truncate">([^<]*)</)?.[1] ?? '';
}

describe('the mark on a card', () => {
  it('is one word, and the sentence about it is underneath', () => {
    const html = chip(PREVIEW_ONLY);

    // One word, which is the whole of the height fix: the paragraph it replaced ran to three
    // lines under one card and made that card taller than the two beside it.
    expect(html).toContain('data-testid="feature-chip"');
    expect(said(html)).toBe(german.formatMessage(MARK_CHIP.vorschau));

    // The sentence is not dropped, it is moved: the same two descriptors the long form prints,
    // so a tooltip and the sentence cannot part. `title` for a pointer under the cursor,
    // `aria-description` for a screen reader, and the two are the same string.
    const mark = markOf(PREVIEW_ONLY)!;
    const full = `${german.formatMessage(mark.state_words)} ${german.formatMessage(
      mark.reason_words,
    )}`;
    expect(html).toContain(`title="${full}"`);
    expect(html).toContain(`aria-description="${full}"`);
    // And the reason is in there, which is what makes the tooltip actionable: the release
    // file holds this one back for reading sample data only, and „Vorschau" on its own says
    // nothing about what to do about it.
    expect(full).toContain('Beispieldaten');
  });

  it('says nothing at all about a block this build draws', () => {
    // ADR 0072 §5 in the other direction: a mark on a shipping feature would be a mark on
    // the shelf for a condition that does not exist, and its absence is what tells a reader
    // the block is in the next store build.
    expect(markOf(SHIPPING)).toBeNull();
    expect(chip(SHIPPING)).toBe('');
  });

  it('reads differently for a feature nothing draws than for one a preview draws', () => {
    // `aus` and `vorschau` are two states of one mark, and the chip says a different word for
    // each, because a reader asking „can I put this in the app?" needs the difference and one
    // word for both would answer a question nobody asked.
    expect(said(chip(OFF))).toBe(german.formatMessage(MARK_CHIP.aus));
    expect(said(chip(PREVIEW_ONLY))).not.toBe(said(chip(OFF)));
    expect(chip(OFF)).toContain('data-feature-state="aus"');
  });
});

describe('the family tabs', () => {
  /** „Alle" and the six families, in the core's order — the row a Home palette opens with. */
  const OPTIONS = [
    { value: 'all', label: 'Alle' },
    { value: 'struktur', label: 'Aufbau und Hinweise' },
    { value: 'recherche', label: 'Nachrichten und Recherchen' },
    { value: 'faktencheck', label: 'Faktencheck' },
    { value: 'medien', label: 'Audio und Video' },
    { value: 'mitmachen', label: 'Mitmachen und Community' },
    { value: 'club', label: 'Club und Profil' },
  ];

  const row = (scroll: boolean): string =>
    renderToStaticMarkup(
      <Localisation language="de">
        <Segmented
          name="home.palette.tab"
          legend="Welche Familie von Blöcken"
          value="all"
          scroll={scroll}
          options={OPTIONS}
          onChange={() => {}}
        />
      </Localisation>,
    );

  it('hold every family on one row, and the row scrolls rather than wrapping', () => {
    const html = row(true);

    // Seven radios for „Alle" and the six families, all in the output. The orphan a design
    // review found was the seventh option on a line of its own, which a count cannot see and
    // a class can: `flex-wrap` is what put it there.
    expect(html.match(/type="radio"/g)).toHaveLength(OPTIONS.length);
    for (const option of OPTIONS) expect(html).toContain(`>${option.label}</span>`);

    expect(html).toContain('flex-nowrap');
    expect(html).toContain('overflow-x-auto');
    expect(html).not.toContain('flex-wrap');
    // No option may be squeezed to fit, which is what wrapping was answering, and the words
    // themselves may not break, which is the other half: „Mitmachen und Community" is two
    // words because the German is, and a broken one would read as a hyphenation bug.
    expect(html.match(/shrink-0/g)).toHaveLength(OPTIONS.length);
    expect(html).toContain('whitespace-nowrap');
  });

  it('keep the wrapping default everywhere else, because ten pages share this control', () => {
    // The alternative was making every caller scroll, which changes the feature page's row of
    // three states and the toolbar's device picker for a fault only the picker has.
    expect(row(false)).toContain('flex-wrap');
    expect(row(false)).not.toContain('flex-nowrap');
  });

  it('name the row for the browser whichever way it is drawn', () => {
    // The legend is what tells a screen reader what the seven radios are choosing between, and
    // it is the one thing that must survive being switched off and being scrolled.
    expect(row(true)).toContain('Welche Familie von Blöcken');
  });
});
