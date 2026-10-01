/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from 'vitest';

import { armPicker, pointedTexts, type Pick } from '../../src/preview/frame/locate';
import { publishable, publishDraft, restoreDraft } from '../../src/preview/strings/draft';
import { PREVIEW_STRINGS_KEY } from '../../src/preview/strings/names';

/**
 * The halves of the strings tool that need a document: what the picker reads under the
 * pointer (ADR 0056 §2), and the draft in `localStorage` (§7).
 *
 * jsdom lays nothing out, so it has no caret API of its own. The test gives the
 * document the one `caretPositionFromPoint` answer a browser would give for a point on
 * the label, which is the part `pointedTexts` does not decide; what it does with that
 * answer is what is under test.
 */

afterEach(() => {
  document.body.innerHTML = '';
  delete (document as { caretPositionFromPoint?: unknown }).caretPositionFromPoint;
  window.localStorage.clear();
});

/** "Alle ansehen" and its arrow, as the app writes that row: two text nodes, one element. */
function arrowRow(): { row: HTMLElement; label: Text } {
  const row = document.createElement('div');
  const label = document.createTextNode('Alle ansehen');
  row.append(label, document.createTextNode(' →'));
  document.body.append(row);
  return { row, label };
}

function caretAt(node: Node): void {
  (document as { caretPositionFromPoint?: unknown }).caretPositionFromPoint = () => ({
    offsetNode: node,
    offset: 0,
  });
}

describe('what the picker offers for the text under the pointer (§2)', () => {
  it('offers the text node first and the element’s whole text after it', () => {
    const { row, label } = arrowRow();
    caretAt(label);
    expect(pointedTexts(document, 10, 10, row)).toEqual(['Alle ansehen', 'Alle ansehen →']);
  });

  it('offers only the element’s text where the caret lands on no text node', () => {
    const { row } = arrowRow();
    caretAt(row);
    expect(pointedTexts(document, 10, 10, row)).toEqual(['Alle ansehen →']);
  });

  it('does not offer a neighbour’s text node, which is what the caret finds past a label', () => {
    const { row } = arrowRow();
    const neighbour = document.createTextNode('Faktenchecks');
    document.body.append(neighbour);
    caretAt(neighbour);
    expect(pointedTexts(document, 10, 10, row)).toEqual(['Alle ansehen →']);
  });

  it('offers a text once where the node is the element’s whole text', () => {
    const row = document.createElement('div');
    const label = document.createTextNode('Faktenchecks');
    row.append(label);
    document.body.append(row);
    caretAt(label);
    expect(pointedTexts(document, 10, 10, row)).toEqual(['Faktenchecks']);
  });
});

describe('the picker hands those texts over', () => {
  it('delivers the pointed texts with the pick, on the click that ends the press', async () => {
    const { row, label } = arrowRow();
    caretAt(label);
    const picked = new Promise<Pick>((resolve) => {
      const disarm = armPicker(window, (pick) => {
        disarm();
        resolve(pick);
      });
    });
    row.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 10, clientY: 10 }));
    row.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const pick = await picked;
    expect(pick.texts).toEqual(['Alle ansehen', 'Alle ansehen →']);
    // The handover's label stays prose (§2): the element's text, not the key.
    expect(pick.label).toBe('Alle ansehen →');
  });
});

describe('the draft the frame reads (§7)', () => {
  const shipped = { 'home.viewAll': 'Alle ansehen', 'home.factChecks': 'Faktenchecks' };

  it('writes the German under the edited locale, and removes the key when empty', () => {
    publishDraft({ 'home.viewAll': 'Alle zeigen' });
    expect(window.localStorage.getItem(PREVIEW_STRINGS_KEY)).toBe(
      JSON.stringify({ de: { 'home.viewAll': 'Alle zeigen' } }),
    );
    publishDraft({});
    expect(window.localStorage.getItem(PREVIEW_STRINGS_KEY)).toBeNull();
  });

  it('restores only ids the catalogue carries, only strings, and only what differs', () => {
    window.localStorage.setItem(
      PREVIEW_STRINGS_KEY,
      JSON.stringify({
        de: {
          'home.viewAll': 'Alle zeigen',
          'home.factChecks': 'Faktenchecks',
          'home.invented': 'Neu',
          'home.allIssues': 3,
        },
      }),
    );
    expect(restoreDraft(shipped)).toEqual({ 'home.viewAll': 'Alle zeigen' });
  });

  it('publishes only what passes the validator', () => {
    const english = (id: string) =>
      ({ 'a.count': '{count} results', 'a.plain': 'Results' })[id as 'a.count'];
    const draft = {
      'a.count': 'Ergebnisse', // lost {count}
      'a.plain': 'Treffer',
      'a.unknown': 'Neu',
    };
    expect(
      publishable(draft, { 'a.count': '{count} Treffer', 'a.plain': 'Ergebnisse' }, english),
    ).toEqual({
      'a.plain': 'Treffer',
    });
  });
});
