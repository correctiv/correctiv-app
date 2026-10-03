import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { Localisation } from '../../src/i18n/Localisation';
import { de } from '../../src/i18n/catalogue/de';
import { PreviewCard } from '../../src/ui/kit/PreviewCard';
import { createIntl } from 'react-intl';

/**
 * The card both pages draw in, as markup rather than as a class string.
 *
 * `palette.test.ts` and `direct.test.ts` hold the shape by reading the source, which cannot see
 * whether a region is where it should be in the DOM or whether a card's foot really is inside
 * it. This renders one and asks, for the two faults that are of that kind and that a design
 * review found: **a drawing that is not inside the reserved box** — so the box sizes to it, and
 * every card in a row is a different height — and **a foot that is not last**, which is the
 * `mt-auto` that pins one.
 *
 * `renderToStaticMarkup` rather than a browser or jsdom, for the reason
 * `preview/palette-dom.test.tsx` gives: the defect is in what the first render contains, and it
 * costs no DOM. What cannot be asked here is pixels — jsdom lays nothing out, so a height, a
 * scale and a crop are invisible from here, which is why the source-reading half holds the
 * classes and this one holds the order.
 */

/** The site's own formatter, for the words a German reader sees. */
const german = createIntl({ locale: 'de', defaultLocale: 'en', messages: de });

/** One card as a German reader gets it, with the drawing a stand-in for the app's own. */
const card = (props: Partial<Parameters<typeof PreviewCard>[0]> = {}): string =>
  renderToStaticMarkup(
    <Localisation language="de">
      <PreviewCard
        title={<span>Mediathek-Reihe</span>}
        description="Zwei Kanäle als Reihe, nebeneinander."
        footer={<span>ui/MediathekReihe.tsx</span>}
        preview={<div data-testid="drawing" />}
        {...props}
      />
    </Localisation>,
  );

describe('the regions of a card, in the order a reader meets them', () => {
  it('puts the drawing in a reserved box, and the box before anything written about it', () => {
    const html = card();

    // The drawing is inside the well and the well is the first thing in the card. A well sized
    // by its content — the fault the reserved `aspect-ratio` exists to prevent — would come
    // after the words and the card would take its height from a block that settles at its own
    // speed: `Badge` in one frame and `LoginGate` in thirty.
    expect(html.indexOf('stage-grid')).toBeLessThan(html.indexOf('Mediathek-Reihe'));
    expect(html.indexOf('data-testid="drawing"')).toBeLessThan(html.indexOf('Mediathek-Reihe'));

    // `relative` on the well is what lets the crop note sit over the drawing instead of under
    // it, and `overflow-hidden` is what makes it a crop rather than an overflow.
    expect(html).toMatch(/class="stage-grid relative flex shrink-0 flex-col[^"]*overflow-hidden/);
  });

  it('puts the foot last, which is the whole of what pins it to the bottom', () => {
    // `mt-auto` takes the free space above the foot, so the foot is the region that has to come
    // after everything that can grow. A card whose foot sat under the name would be pushed up
    // into the drawing on a long sentence and left floating on a short one.
    const html = card();
    const drawing = html.indexOf('data-testid="drawing"');
    const name = html.indexOf('Mediathek-Reihe');
    const sentence = html.indexOf('Zwei Kanäle als Reihe');
    const foot = html.indexOf('ui/MediathekReihe.tsx');

    // Strictly increasing: the drawing, then the name, then the sentence, then the foot. A card
    // whose foot came before the sentence would take `mt-auto` from the wrong side of the text.
    expect([drawing, name, sentence, foot]).toEqual(
      [drawing, name, sentence, foot].sort((a, b) => a - b),
    );
    expect(foot).toBeGreaterThan(sentence);
    expect(html).toContain('mt-auto flex min-h-[2lh] min-w-0 items-baseline');
  });

  it('reserves the well, and a square unless it is told a height', () => {
    // Both pages need one of the two and neither needs the other: the component page's square
    // follows the column its grid gives it, the block picker's is a height in pixels because a
    // ratio would be 300px at two columns and 244px at three.
    expect(card()).toContain('aspect-square');
    expect(card()).not.toContain('style="height:');
    expect(card({ previewHeight: 240 })).toContain('style="height:240px"');
    expect(card({ previewHeight: 240 })).not.toContain('aspect-square');
  });

  it('carries the whole sentence under the pointer, and lets a caller say which', () => {
    // Clamped to two lines for the eye; the `title` is the rest of it. A string description
    // needs no second answer, and one that is not a string — the component page's, which is a
    // component's own JSDoc — is told where its full text lives.
    expect(card()).toMatch(/title="Zwei Kanäle als Reihe, nebeneinander\."/);
    expect(
      card({ description: <em>kein Kommentar</em>, descriptionTitle: 'aus dem Quelltext' }),
    ).toMatch(/title="aus dem Quelltext"/);
  });

  it('paints no crop note over a card that fits, and asks for one only where there is a crop', () => {
    // Nothing is laid out here, so the answer is nothing yet — which is the state that must not
    // paint a note on all forty cards for one frame. And the overlay, which is where the height
    // becomes something a reader can act on, is handed the same measurement rather than
    // measuring again.
    const html = card();
    expect(html).not.toContain('kit.previewCard.clipped');
    expect(html).not.toContain('from-canvas to-transparent');

    const seen: { clipped: boolean; height: number }[] = [];
    card({
      overlay: (crop) => {
        seen.push(crop);
        return <a href="/components/media/MediathekReihe">Alle Exemplare</a>;
      },
    });
    expect(seen).toHaveLength(1);
    expect(seen[0]).toEqual({ clipped: false, height: 0 });
  });

  it('keeps the badge the caller put on the name beside it, on the same line', () => {
    // The platform badge on a component card is the one thing there is that says which half of
    // a split file this is, and a row that wraps would put it under the name on the narrowest
    // columns — a fact about the file that reads as a fact about the card.
    const html = card({ titleExtra: <span className="shrink-0">web</span> });
    expect(html).toContain('class="flex min-w-0 items-center gap-2xs"');
    expect(html.indexOf('web')).toBeGreaterThan(html.indexOf('Mediathek-Reihe'));
  });

  it('says its one word in German, because the site’s catalogue is the one it formats against', () => {
    // The number in the note is measured in the browser and is not written down here, so the
    // only thing a check can hold is that the sentence comes out of the site's own catalogue and
    // not as a literal beside it.
    const html = card();
    expect(html).not.toContain('Beschnitten');
    expect(
      german.formatMessage({ id: 'kit.previewCard.clipped', defaultMessage: '' }, { height: 484 }),
    ).toBe('Beschnitten · 484 px hoch');
  });
});
