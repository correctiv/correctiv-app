/**
 * How a rendered document is cut into the pieces React puts into the page.
 *
 * Its own module, with no React in it, because two readers need exactly this cut:
 * `Document.tsx`, which hands each piece to `dangerouslySetInnerHTML`, and
 * `test/rendered-html.test.ts`, which parses each piece the way a browser will.
 * Parsing the whole string instead would be parsing something no browser is given:
 * a quote left open at the end of one piece swallows the next one into an
 * attribute value in the whole string, and in the page that next piece is parsed
 * fresh, with everything in it live.
 */

/** The slot `plugin/markdown.ts` leaves where a document names a drawing. */
const SLOT = /<div data-diagram="([\w-]+)"><\/div>/;

/**
 * The box `plugin/markdown.ts` wraps every table in.
 *
 * That box already exists for the phone-width scroll (`.prose .table-scroll` in
 * `styles/app.css`); this is the same string read a second time, as the mark that
 * says "this block is tabular" rather than sentences. Matched, not reconstructed,
 * so the two places cannot describe two different wrappers.
 */
const TABLE = /<div class="table-scroll"><table>[\s\S]*?<\/table><\/div>/;

export interface Part {
  html: string;
  diagram?: string;
  /** A table, cut out of the reading measure into its own `max-w-wide` box. */
  wide?: boolean;
}

/**
 * The rendered document, cut at each slot and each table, so React owns every
 * piece and sizes it on its own terms: a drawing, a table and a sentence are
 * three different widths, and only the third is the reading measure.
 */
export function split(html: string): Part[] {
  const parts: Part[] = [];
  let rest = html;
  for (;;) {
    const diagramHit = SLOT.exec(rest);
    const tableHit = TABLE.exec(rest);
    const hit =
      diagramHit && (!tableHit || diagramHit.index <= tableHit.index) ? diagramHit : tableHit;
    if (!hit) break;
    if (hit.index > 0) parts.push({ html: rest.slice(0, hit.index) });
    parts.push(hit === diagramHit ? { html: '', diagram: hit[1] } : { html: hit[0], wide: true });
    rest = rest.slice(hit.index + hit[0].length);
  }
  if (rest) parts.push({ html: rest });
  return parts;
}
