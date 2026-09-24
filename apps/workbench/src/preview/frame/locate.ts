/**
 * Which line of which file drew the thing that was clicked.
 *
 * This is the bridge the whole shell exists for: a designer points at a card, and
 * what comes back is `src/components/feed/ArticleRow.tsx:42` — an instruction an
 * agent or a developer can act on, instead of a sentence describing a rectangle.
 *
 * How it works, because none of it is obvious. React 19 removed `_debugSource`,
 * so there is no field to read. What a development build does keep is
 * `_debugStack`: the JSX runtime creates an `Error` at every element's call site,
 * and `_debugOwner` chains those together. Walking that chain and formatting each
 * stack the way `react-dom` formats it internally yields one frame per level —
 * innermost the DOM node, outermost the screen. Those frames point into the Metro
 * bundle, not into source, so they go to Metro's own `/symbolicate`, which maps
 * them back and marks everything under `node_modules/` as collapsible. What
 * survives that filter is the app's own code.
 *
 * The whole thing is same-origin: `preview.html` is served by the Metro dev
 * server itself, so `/symbolicate` and `/open-stack-frame` are plain fetches.
 *
 * It works only against `npm run web`. A production bundle has no `_debugStack`,
 * and this returns nothing rather than guessing — the panel says which case it is.
 */
import { clearHighlight, markHovered, markPicked } from './highlight';

export interface Located {
  file: string;
  lineNumber: number;
  column: number;
  methodName: string | null;
}

interface Fiber {
  _debugOwner?: Fiber | null;
  _debugStack?: Error | null;
}

const AT_PAREN = /^\s*at\s+(?:(.+?)\s+\()?(.+?):(\d+):(\d+)\)?\s*$/; // V8
const AT_AT = /^\s*(?:(.*?)@)?(.+?):(\d+):(\d+)\s*$/; // SpiderMonkey, JavaScriptCore

/** The randomised expando react-dom stamps on every host node. */
function fiberOf(node: Element | null): Fiber | null {
  for (let n: Element | null = node; n; n = n.parentElement) {
    const key = Object.keys(n).find((k) => k.startsWith('__reactFiber$'));
    if (key) return (n as unknown as Record<string, Fiber>)[key] ?? null;
  }
  return null;
}

/**
 * The frames of one element's creation site.
 *
 * `react-dom` truncates this at its own `react_stack_bottom_frame` marker, and
 * copying that was a mistake: the marker is only present when the stack is long
 * enough to contain it, and `Error.stackTraceLimit` is 10 by default. Raising the
 * limit does not help either, because these Errors were created during a render
 * that already happened. So the first version of this returned nothing at all,
 * every time, on every element.
 *
 * Truncating is also unnecessary here. React's own frames and everything under
 * `node_modules` are marked `collapse` by Metro a moment later, so the cheapest
 * correct thing is to hand over the top few frames of each owner and let the
 * symbolicator sort them out.
 */
function ownerFrames(err: Error | null | undefined): string[] {
  if (!err?.stack) return [];
  return err.stack
    .split('\n')
    .filter((line) => /^\s*(at\s|\S+@)/.test(line))
    .filter((line) => !line.includes('react_stack_bottom_frame'))
    .slice(0, 3);
}

/** Metro wants an absolute bundle URL and a zero-based column. */
function toFrame(line: string): Located | null {
  const m = AT_PAREN.exec(line) ?? AT_AT.exec(line);
  if (!m) return null;
  const [, methodName, rawFile, lineNumber, column] = m;
  let file = rawFile!;
  if (file.startsWith('http')) {
    const url = new URL(file);
    if (!url.searchParams.has('platform')) url.searchParams.set('platform', 'web');
    if (!url.searchParams.has('dev')) url.searchParams.set('dev', 'true');
    file = url.toString();
  }
  return {
    file,
    lineNumber: Number(lineNumber),
    column: Number(column) - 1,
    methodName: methodName ?? null,
  };
}

export async function locate(win: Window | null, node: Element): Promise<Located[]> {
  if (!win) return [];

  // A longer limit keeps React's bottom frame inside the stack. Future renders only.
  try {
    (win as Window & typeof globalThis).Error.stackTraceLimit = 50;
  } catch {
    // Frozen or gone; the walk below simply finds fewer frames.
  }

  const lines = new Set<string>();
  let fiber = fiberOf(node);
  for (let depth = 0; fiber && depth < 24 && lines.size < 40; depth++) {
    for (const line of ownerFrames(fiber._debugStack)) lines.add(line);
    fiber = fiber._debugOwner ?? null;
  }
  if (lines.size === 0) return [];

  const stack = [...lines].map(toFrame).filter((f): f is Located => f !== null);

  try {
    const response = await fetch('/symbolicate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stack }),
    });
    const body = (await response.json()) as { stack: (Located & { collapse?: boolean })[] };
    // Expo collapses every `node_modules/.+/` frame, so what is left is this app.
    // The owner chain repeats a call site whenever one component wraps another,
    // so the same file and line can arrive several times.
    const seen = new Set<string>();
    return body.stack.filter((f) => {
      if (f.collapse) return false;
      const key = `${f.file}:${f.lineNumber}`;
      return seen.has(key) ? false : (seen.add(key), true);
    });
  } catch {
    return []; // no Metro to ask: the static export, or the server is gone
  }
}

/** Expo's dev server mounts this; it opens the file in the editor. */
export async function openInEditor(frame: Located): Promise<void> {
  try {
    await fetch('/open-stack-frame', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file: frame.file, lineNumber: frame.lineNumber }),
    });
  } catch (error) {
    // There is no second thing to try, and no panel state that would help: a
    // frame to open at all means the symbolicator answered a moment ago. So it
    // goes where whoever is inspecting already is, the shell's own console,
    // rather than into a rejection nobody is holding.
    console.warn('preview: /open-stack-frame did not answer.', error);
  }
}

/**
 * An element, from whichever realm.
 *
 * `instanceof Element` cannot answer this and quietly says no: the frame is a
 * realm of its own, its nodes are instances of ITS `Element`, and the shell's
 * constructor is a different object. The `nodeType` of an element is 1 in every
 * realm there is.
 */
function isElement(value: EventTarget | undefined): value is Element {
  return value !== undefined && 'nodeType' in value && (value as Node).nodeType === 1;
}

/**
 * Arms the picker on the frame's document, and swallows the whole interaction.
 *
 * Not only `pointerdown`. A press that reaches the app activates it, and a click
 * on a link navigates: the address recorded in the handover would then point at a
 * screen the element is not on.
 *
 * The subtle half is **when** to stop swallowing. Tying it to the hit is wrong,
 * and wrong in a way that hides itself: `locate()` is async, so a fast synthetic
 * click is still swallowed while a person, who holds the button for a moment
 * longer than a symbolicate round trip takes, gets their link followed. That is
 * exactly how this shipped and exactly how it was reported. So the interaction
 * ends the swallowing, not the answer: the hit is delivered on the `click`, after
 * that event has been stopped, with a timer as the fallback for interactions that
 * never produce one.
 *
 * Re-armed after every navigation, because the frame's document is replaced.
 */
const SWALLOWED = ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click'] as const;

/** A press that ends without a click still has to answer. */
const INTERACTION_END_MS = 400;

/**
 * The text that was pointed at, in the order a lookup should try it.
 *
 * [ADR 0056](../../../../../adr/0056-a-string-is-picked-where-it-renders.md) §2: the
 * text node under the pointer first, and the element's whole text only after it.
 * `textContent` concatenates every text child, and a row whose label ends in an arrow
 * writes that arrow as a node of its own beside the message, so the element reads
 * `Alle ansehen →` while the catalogue holds `Alle ansehen`. Decoration is common and a
 * message spanning children is something nothing in the app does today, so the order
 * that looks backwards is the one that finds the string.
 *
 * The node is only offered when it is inside the element the pointer landed on: the
 * caret APIs answer with the NEAREST text, which past the end of a short label can be a
 * neighbour's.
 */
export function pointedTexts(doc: Document, x: number, y: number, target: Element): string[] {
  const texts: string[] = [];
  const caret = doc as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  let node: Node | null = null;
  try {
    node =
      caret.caretPositionFromPoint?.(x, y)?.offsetNode ??
      caret.caretRangeFromPoint?.(x, y)?.startContainer ??
      null;
  } catch {
    node = null;
  }
  if (node && node.nodeType === 3 && target.contains(node)) {
    const text = (node.textContent ?? '').trim();
    if (text) texts.push(text);
  }
  const whole = (target.textContent ?? '').trim();
  if (whole && !texts.includes(whole)) texts.push(whole);
  return texts;
}

/** What a pick hands back: the owner chain, the handover's label, and the pointed texts. */
export interface Pick {
  hits: Located[];
  /** Prose for the handover block, cut short; not a key (ADR 0056 §2). */
  label: string;
  /** `pointedTexts`, whole. */
  texts: string[];
}

export function armPicker(win: Window | null, onHit: (pick: Pick) => void): () => void {
  const doc = win?.document;
  if (!doc) return () => {};

  clearHighlight(win);

  let pending: { hits: Promise<Located[]>; label: string; texts: string[] } | null = null;
  let fallback: number | undefined;

  const deliver = () => {
    const current = pending;
    pending = null;
    win?.clearTimeout(fallback);
    if (current) {
      void current.hits.then((hits) => onHit({ hits, label: current.label, texts: current.texts }));
    }
  };

  const swallow = (event: Event) => {
    event.preventDefault();
    event.stopPropagation();

    if (event.type === 'pointerdown') {
      const target = event.composedPath()[0];
      if (!isElement(target)) return;
      markPicked(win, target);
      const pointer = event as PointerEvent;
      pending = {
        hits: locate(win, target),
        label: (target.textContent ?? '').trim().slice(0, 40),
        texts: pointedTexts(doc, pointer.clientX, pointer.clientY, target),
      };
      return;
    }

    // `click` is the last event of an ordinary interaction, so delivering here
    // means every event of it has already been stopped.
    if (event.type === 'click') deliver();
    else if (event.type === 'pointerup' && pending) {
      fallback = win?.setTimeout(deliver, INTERACTION_END_MS);
    }
  };

  const hover = (event: Event) => {
    const target = event.composedPath()[0];
    if (isElement(target)) markHovered(win, target);
  };

  for (const type of SWALLOWED) doc.addEventListener(type, swallow, { capture: true });
  doc.addEventListener('pointermove', hover, { capture: true });

  return () => {
    win?.clearTimeout(fallback);
    for (const type of SWALLOWED) doc.removeEventListener(type, swallow, { capture: true });
    doc.removeEventListener('pointermove', hover, { capture: true });
    markHovered(win, null);
  };
}
