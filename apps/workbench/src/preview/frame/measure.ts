import { activeScheme } from './handle';
import { PALETTE, TOKENS, toRgb, type Scheme } from './tokens';
import { wbMessage, type WorkbenchMessage } from '../../i18n/messages';

/**
 * The three things a person misses on the twentieth screenshot.
 *
 * This does not replace looking, and nothing here should ever be presented as if
 * it did — `AGENTS.md` is blunt that a green check is not evidence about how the
 * app looks. What it does is take the mechanical part off the person: a row that
 * overflows by four pixels, a tap target too small for a thumb, and a colour that
 * is not in the palette at all.
 *
 * The colour check has a known blind spot and states it rather than hiding it: a
 * value match cannot say which token was meant, because several tokens share a
 * value. Counted in `tokens.generated.ts`, the light palette puts 35 tokens on 12
 * distinct values and the dark one puts them on 20, so the same reading is less
 * ambiguous in dark, which is why the report says to run it there. Less, not
 * unambiguous: dark collides too.
 *
 * ## A finding is a message and a few numbers, never a sentence
 *
 * What a finding says is this site's own words and follows the language setting
 * ([ADR 0052](../../../../../adr/0052-the-sites-own-words-follow-the-setting.md) §1),
 * and this module runs against the frame's DOM and may not import React. So a
 * finding carries the descriptor and the numbers that go in it, and
 * `preview/ui/Panels.tsx` formats the pair; nothing here builds a string a person
 * reads. `wbMessage()` is what declares one, one descriptor per call, and
 * `src/i18n/messages.ts` says why.
 *
 * That shape is also the better answer for `window.preview.audit()`, which hands
 * findings to an automation: an id and a number survive a reader switching the
 * language, an English sentence assembled here would not.
 */
export interface Finding {
  kind: 'overflow' | 'tap-target' | 'off-palette';
  /** What it says, unformatted. `values` holds everything its placeholders take. */
  says: WorkbenchMessage;
  values: Record<string, string | number>;
  /** A short path, enough to find the node in DevTools. */
  where?: string;
}

/**
 * The three checks' own sentences, one per thing that can be found.
 *
 * A `Record` whose every value is wrapped one at a time, because `@formatjs/cli`
 * reads a named function's single argument: a `defineMessages`-shaped block handed
 * to `wbMessage` extracts to nothing at all.
 *
 * Every placeholder in these is a measurement or a CSS spelling — a pixel count, a
 * CSS property name, an `rgb(…)` value, the name of a palette — so none of them is
 * translated and each is named in its descriptor.
 */
const FINDINGS = {
  page: wbMessage({
    id: 'tools.measure.finding.page',
    defaultMessage: 'The page scrolls sideways: {content}px of content in {viewport}px.',
    description:
      'A finding in the measure tool, about the framed page as a whole. {content} is how wide the scrolling content is in CSS pixels and {viewport} is how wide the frame is. tools.measure.finding.node is the same fault reported against one element.',
  }),
  node: wbMessage({
    id: 'tools.measure.finding.node',
    defaultMessage: 'Reaches {right}px, past the {viewport}px edge.',
    description:
      'A finding in the measure tool, about one element. {right} is the element’s right edge in CSS pixels, measured from the left of the frame, and {viewport} is how wide the frame is. tools.measure.finding.page is the same fault reported against the whole page.',
  }),
  tapTarget: wbMessage({
    id: 'tools.measure.finding.tapTarget',
    defaultMessage: '{width}×{height}px, under the {minimum}px a thumb needs.',
    description:
      'A finding in the measure tool: a link or a button too small to hit. {width} and {height} are the element’s own size in CSS pixels and {minimum} is the smallest side this check accepts.',
  }),
  offPalette: wbMessage({
    id: 'tools.measure.finding.offPalette',
    defaultMessage: '{property}: {value} is not a {scheme} token.',
    description:
      'A finding in the measure tool: a colour that is in no token of the palette the app is painting with. {property} is the CSS property in its own spelling, “color” or “backgroundColor”; {value} is the colour as the browser reports it, such as rgb(255, 0, 0); {scheme} is “light” or “dark”, the name of the palette, and all three stay as they are written.',
  }),
};

const OUTLINE_ID = 'preview-outline';

/**
 * The smallest side a control may have, in CSS pixels.
 *
 * Exported because the check's own name in the panel says it — "Tap targets under
 * 44 px" was typed there once, beside this, and two copies of one number is one
 * number that goes wrong on its own.
 */
export const MIN_TAP = 44;
/**
 * Declared controls only. `[tabindex]` would be tempting and is wrong here:
 * react-native-web puts one on a great many plain views, so including it turns
 * the check into a list of every scroll container on the screen.
 */
const TAPPABLE = 'a[href], button, [role="button"], [role="link"], [role="tab"]';

/**
 * Expo's dev-server error toast, which is in the frame's DOM but is not the app.
 * Left in, it supplies most of the findings on any page where a feed failed —
 * and on web every feed fails, so that would be every page. A checker whose
 * output is mostly noise gets ignored, which is worse than not having one.
 */
const NOT_THE_APP = '#error-toast';

/** A node with text of its own, as opposed to one that merely inherits a colour. */
function hasOwnText(el: Element): boolean {
  return Array.from(el.childNodes).some(
    (node) => node.nodeType === 3 && (node.textContent ?? '').trim() !== '',
  );
}

export function setOutline(win: Window | null, on: boolean): void {
  const doc = win?.document;
  if (!doc) return;
  const existing = doc.getElementById(OUTLINE_ID);
  if (!on) return existing?.remove();
  const style = existing ?? doc.createElement('style');
  style.id = OUTLINE_ID;
  style.textContent = '*{outline:1px solid rgb(255 80 100 / 30%) !important}';
  doc.head.append(style);
}

/**
 * Something a person can find the node by. React Native Web's class names are
 * generated (`css-view-g5y9jx`), so a CSS path says nothing; the accessibility
 * label is both readable and the handle the Android tour already taps by.
 */
function path(el: Element): string {
  const label = el.getAttribute('aria-label') ?? (el.textContent ?? '').trim();
  const role = el.getAttribute('role') ?? el.tagName.toLowerCase();
  return label ? `${role} "${label.slice(0, 40)}"` : role;
}

/**
 * What makes two findings the same finding, in one place.
 *
 * It used to be `${kind}|${text}`, and the text was the whole of what a finding
 * said. With the sentence unformatted until it is drawn, the id and the numbers
 * are what carry that, and both halves of the answer — the run's own de-duplication
 * below and the React key in `preview/ui/Panels.tsx` — have to agree about it or
 * one of them starts collapsing rows the other keeps.
 */
export function findingKey(finding: Finding): string {
  return `${finding.kind}|${finding.says.id}|${JSON.stringify(finding.values)}`;
}

export function audit(win: Window | null): {
  findings: Finding[];
  scheme: Scheme;
  scanned: number;
} {
  const doc = win?.document;
  const scheme = activeScheme(win);
  if (!doc || !win) return { findings: [], scheme, scanned: 0 };

  const findings: Finding[] = [];
  const palette = new Set(
    TOKENS.map((token) => toRgb(PALETTE[scheme][token])).filter((v): v is string => v !== null),
  );

  const viewport = doc.documentElement.clientWidth;
  const scroller = doc.scrollingElement ?? doc.documentElement;
  if (scroller.scrollWidth > viewport + 1) {
    findings.push({
      kind: 'overflow',
      says: FINDINGS.page,
      values: { content: scroller.scrollWidth, viewport },
    });
  }

  const elements = Array.from(doc.body.querySelectorAll('*'));
  for (const el of elements) {
    if (el.closest(NOT_THE_APP)) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;

    if (rect.right > viewport + 1 && el.children.length === 0) {
      findings.push({
        kind: 'overflow',
        says: FINDINGS.node,
        values: { right: Math.round(rect.right), viewport },
        where: path(el),
      });
    }

    if (el.matches(TAPPABLE) && (rect.width < MIN_TAP || rect.height < MIN_TAP)) {
      findings.push({
        kind: 'tap-target',
        says: FINDINGS.tapTarget,
        values: {
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          minimum: MIN_TAP,
        },
        where: path(el),
      });
    }

    const style = win.getComputedStyle(el);
    for (const property of ['color', 'backgroundColor'] as const) {
      const value = style[property];
      if (!value.startsWith('rgb(') || palette.has(value)) continue;
      // A colour is only a finding where it is visible: on a node that draws its
      // own text, or on a painted surface. Everywhere else it is inherited and
      // will be reported once, at the node that shows it.
      if (property === 'color' && !hasOwnText(el)) continue;
      findings.push({
        kind: 'off-palette',
        says: FINDINGS.offPalette,
        values: { property, value, scheme },
        where: path(el),
      });
    }
  }

  // One line per distinct complaint; twenty rows with the same colour are one finding.
  const seen = new Set<string>();
  const unique = findings.filter((f) => {
    const key = findingKey(f);
    return seen.has(key) ? false : (seen.add(key), true);
  });

  return { findings: unique.slice(0, 40), scheme, scanned: elements.length };
}
