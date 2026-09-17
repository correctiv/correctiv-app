/**
 * Which element is under the cursor, and which one was picked.
 *
 * Without this the picker asks a person to aim at something and then tells them
 * nothing about what they hit, so a wrong hit is indistinguishable from a right
 * one until the file name in the panel turns out to be surprising. A frame around
 * the thing removes the guessing on both ends.
 *
 * Marked with an attribute and styled from one injected rule rather than by
 * writing `el.style`: React owns the `style` of everything it renders and a
 * re-render would drop the outline, while an attribute nothing in the app knows
 * about survives one.
 */
const STYLE_ID = 'preview-highlight';
const PICKED = 'data-preview-picked';
const HOVERED = 'data-preview-hover';

const CSS = `
[${PICKED}]{outline:2px solid #ff5064 !important;outline-offset:1px !important}
[${HOVERED}]{outline:1px dashed #ff5064 !important;outline-offset:1px !important}
`;

function ensureStyle(doc: Document): void {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  doc.head.append(style);
}

/**
 * The node currently carrying each mark.
 *
 * Remembered rather than searched for. The hover mark moves on every
 * `pointermove`, and querying the whole document for the previous one would put
 * a full tree walk in the path of the one interaction a person already found
 * fiddly. A remembered node can be stale after a navigation, which costs one
 * `removeAttribute` on a detached element and nothing else.
 */
const marked = new Map<string, Element>();

/** Takes the mark off whatever is remembered as carrying it, and puts it on `node`. */
function move(attribute: string, node: Element | null): void {
  marked.get(attribute)?.removeAttribute(attribute);
  marked.delete(attribute);
  if (node) {
    node.setAttribute(attribute, '');
    marked.set(attribute, node);
  }
}

function only(doc: Document, attribute: string, node: Element | null): void {
  // Anything left over from an earlier document, or set before this module was
  // the one doing the marking, still has to go. The remembered node is swept by
  // `move` rather than here, because after a navigation it is detached and no
  // query over this document reaches it.
  for (const previous of doc.querySelectorAll(`[${attribute}]`)) {
    previous.removeAttribute(attribute);
  }
  move(attribute, node);
}

/** The element the pick landed on. Stays until the next pick. */
export function markPicked(win: Window | null, node: Element | null): void {
  const doc = win?.document;
  if (!doc) return;
  ensureStyle(doc);
  only(doc, PICKED, node);
  only(doc, HOVERED, null);
}

/**
 * What a click would hit right now. Only while the picker is armed.
 *
 * `move` and not `only`: this runs on every `pointermove`, and the sweep `only`
 * does would put a full tree walk in the path of the one interaction a person
 * already found fiddly. What the sweep is for cannot arise here anyway, because
 * nothing but this function has ever written the hover mark.
 */
export function markHovered(win: Window | null, node: Element | null): void {
  const doc = win?.document;
  if (!doc) return;
  if (marked.get(HOVERED) === node) return; // the common case while a pointer moves inside one element
  ensureStyle(doc);
  move(HOVERED, node);
}

export function clearHighlight(win: Window | null): void {
  const doc = win?.document;
  if (!doc) return;
  only(doc, PICKED, null);
  only(doc, HOVERED, null);
}

/**
 * The frame element carrying this `data-testid`, or none.
 *
 * A scan rather than an attribute selector: the ids this is given come from a
 * document a person is editing, not from this module, and an attribute selector
 * built from an untrusted string is a malformed-selector exception waiting for a
 * quote mark. A home screen carries a dozen of these at most, so the scan costs
 * nothing worth avoiding it for.
 */
function byTestId(doc: Document, testId: string): Element | null {
  for (const node of doc.querySelectorAll('[data-testid]')) {
    if (node.getAttribute('data-testid') === testId) return node;
  }
  return null;
}

/**
 * The hover mark, reached by an id rather than by a pointer event.
 *
 * The picker (`locate.ts`) already has an `Element` in hand when it calls
 * `markHovered` on every `pointermove`, because a pointer event carries one. A row
 * in a panel carries only the id it was given, so this is the lookup that call
 * site never needed, in front of the same mark. `null` clears it, and so does an
 * id this build's frame has nothing for: a section that is switched off or
 * outside the current part of the day is not drawn at all
 * (`apps/mobile/src/app/(tabs)/index.tsx`, `sectionsAt`), so there is no element
 * to outline and this quietly outlines nothing rather than guessing at one.
 */
export function outlineByTestId(win: Window | null, testId: string | null): Element | null {
  const doc = win?.document;
  const node = testId && doc ? byTestId(doc, testId) : null;
  markHovered(win, node);
  // Handed back rather than looked up twice: `reveal.ts` wants the same element, and the
  // scan above is the one thing here that walks the frame's whole document.
  return node;
}
