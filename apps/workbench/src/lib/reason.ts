import type { DecisionRecord } from '../../plugin/decisions.ts';
import type { RetiredClaim } from '../../plugin/markdown.ts';

/**
 * The one line a board row carries under its title: why something in it is no
 * longer true.
 *
 * The board could say *who* struck a claim — `by 0009 0015 0026` — and could not
 * say *why* without being expanded, which is the wrong way round: the clause is
 * the interesting half, and most strikes name no record at all, so for those the
 * clause is the only thing there is to say. The board prints both counts from the
 * records themselves, so this file types neither.
 *
 * What makes this a rule rather than a `slice(0, 120)` is the shape of the
 * clauses, measured rather than assumed. **Over `adr/` on 2026-09-16, 73 strikes
 * across 35 records: median clause 212 characters, longest 935, 31 naming no later
 * record, and 20 of them sentence FRAGMENTS** — `asynchronously since 0009`, `, and
 * from step 2 of the onboarding …`, `— that premise is voided by ADR 0030, which
 * …`. Dated, because it is a reading of a directory that grows, and the rule below
 * is what has to survive it rather than the numbers. A fragment printed on its own
 * is noise, and noise is worse than the count it replaced.
 */
export interface RowReason {
  /**
   * The struck text this clause continues, where the clause cannot stand without
   * it; empty where it can. Rendered struck through, as the record renders it.
   */
  lead: string;
  /** The one sentence shown. */
  text: string;
}

/**
 * How much of the struck text a fragment gets to carry, from its end.
 *
 * From the END because that is where the clause attaches: `…web show the same
 * brand` + `— that premise is voided by ADR 0030` reads as one sentence, and the
 * first half of a 124-character claim would only push the clause off the line.
 *
 * Short, and 24 rather than 48 because the first draft was 48 and the row was
 * measured: at the width the `Decision` column gets on a 1280 px page, a 46
 * character lead filled the whole line and ADR 0004's row read
 * `…that iOS, Android and web show t…`, which is a claim that is no longer true
 * presented as the reason it is not true. The lead is scaffolding, and a row whose
 * line is all scaffolding has said nothing — worse, it has said the wrong thing.
 */
const LEAD_MAX = 24;

/**
 * Where a sentence ends, which is not simply a full stop.
 *
 * These clauses are full of file names, version numbers and dates:
 * `create-store.ts, added shortly after`, `@rozenite/metro 2.4.0`,
 * `Struck on 2026-09-15: 49 in apps/mobile/src. Nothing voided the figure`. So a
 * boundary is a stop followed by whitespace and a capital — which is also what
 * rescues `Done. .github/workflows/pages.yml builds the export …`, where a
 * first sentence split on the stop alone would be the word "Done".
 */
const SENTENCE_END = /([.?!]["'»“]?)\s+(?=[("'„“«]{0,2}[A-ZÄÖÜ])/;

/**
 * What a clause may open with and still be a continuation of the struck text.
 *
 * Stripped only to ASK whether the clause stands alone; the connective is kept in
 * what is shown, because it is the join.
 */
const CONNECTIVE = /^[\s—–\-,.;:·]+/;

/** A sentence that begins as one: a capital, behind at most a bracket and a quote. */
const OPENS_A_SENTENCE = /^[("'„“«]{0,2}[A-ZÄÖÜ]/;

/**
 * Punctuation a sentence may end on inside a clause and must not end on here.
 *
 * ADR 0006's clause runs `… is unchanged by it:` and goes on to a table. A colon
 * left at the end of the line promises something the row does not show.
 */
const DANGLING = /[\s;:,–—-]+$/;

/** Does the clause need a space after the struck text it follows, or does it hug it? */
export function spaced(text: string): boolean {
  return !/^[,.;:)]/.test(text);
}

/**
 * A clause cut into sentences, with the leading punctuation-only scraps dropped.
 *
 * Those scraps are real: a strike inside a sentence leaves the rest of it behind,
 * so ADR 0016's clause begins `. The profile prints the areas since ADR 0020`,
 * and the stop belongs to the struck half.
 */
function sentences(clause: string): string[] {
  return clause
    .split(SENTENCE_END)
    .reduce<string[]>((parts, piece, index) => {
      // `split` with one capture group alternates text, stop, text, stop …, so an
      // odd index is the terminator that belongs to the sentence before it.
      if (index % 2 === 1) parts[parts.length - 1] += piece;
      else parts.push(piece.trim());
      return parts;
    }, [])
    .filter((part) => /[A-Za-zÄÖÜäöü0-9]/.test(part));
}

/** The tail of a struck claim, at a word boundary, marked where it was cut. */
function tail(claim: string): string {
  if (claim.length <= LEAD_MAX) return claim;
  const cut = claim.slice(claim.length - LEAD_MAX);
  const space = cut.indexOf(' ');
  return `…${(space === -1 ? cut : cut.slice(space + 1)).trimStart()}`;
}

/**
 * One struck claim, cut to the line the board shows.
 *
 * **Two rules, and they are the whole of it.**
 *
 * *Which sentence.* The one that names `voider`, the record that struck this
 * claim, because that is the sentence saying what happened — ADR 0019's clause
 * opens by restating the open question and answers it in its second sentence, and
 * ADR 0006's opens with `, all declared in packages/app-core/src/ports/index.ts`
 * before getting to the fifth port. Where the strike names no record, which is the
 * common case, there is nothing to look for and it is the first sentence.
 *
 * *Whether the struck text comes with it.* A clause is shown on its own when it
 * opens a sentence of its own — a capital letter, once any joining punctuation is
 * out of the way — and behind the text it struck when it does not. Only the
 * clause's first sentence can need that: a later one begins with a capital by the
 * definition of the boundary above.
 *
 * Shown on its own rather than always behind its claim, because the struck text
 * is a statement that is no longer true, and repeating it beside the reason is
 * the confusion the strike exists to prevent. It comes back only where the clause
 * would be ungrammatical without it.
 *
 * The capital is the test, not a parser, and it is wrong in one direction on
 * purpose: `MMKV, in a store of its own, since 0026` is a fragment that opens with
 * a capital, so it is shown alone and reads as terse rather than as noise. The
 * other direction — a fragment shown as a sentence — is the one that produces
 * `, and from step 2 of the onboarding`, and a capital never misses those.
 *
 * Nothing is shown for a claim with no clause at all — a handful have none, and
 * the board counts them where it explains them. The row falls back to another
 * strike, and the detail says plainly that the record itself has the answer.
 */
export function shorten(claim: RetiredClaim, voider = ''): RowReason | null {
  const parts = sentences(claim.clause.trim());
  if (parts.length === 0) return null;

  const named = voider === '' ? -1 : parts.findIndex((part) => part.includes(voider));
  const at = named === -1 ? 0 : named;
  const text = parts[at].replace(DANGLING, '');

  if (at > 0) return { lead: '', text };
  const body = text.replace(CONNECTIVE, '');
  if (body === '') return null;
  if (OPENS_A_SENTENCE.test(body)) return { lead: '', text: body };
  return { lead: tail(claim.claim.trim()), text };
}

/** The latest record this strike names, or nothing where it names none later. */
function voiderOf(record: DecisionRecord, claim: RetiredClaim): string {
  return (
    claim.by
      .filter((number) => number > record.number)
      .toSorted()
      .at(-1) ?? ''
  );
}

/**
 * The strike a row speaks for, where it has more than one.
 *
 * The newest, as far as the records carry a notion of newest: the strike whose
 * clause names the highest record number. That makes the line agree with the chips
 * beside it — the reason under the title belongs to the last chip in the `Struck
 * claims` column — and it is a fact rather than a guess, because ADR numbers
 * ascend with time.
 *
 * Where no strike names a later record, which is true of about half the records
 * that carry any, there is no recency in the data to read, and it is the last
 * strike the record writes. Said plainly rather than dressed up as an order it is
 * not: a strike carries no date of its own.
 */
export function newestStrike(record: DecisionRecord): RetiredClaim | null {
  const withClause = record.struck.filter((claim) => shorten(claim) !== null);
  if (withClause.length === 0) return null;
  return withClause.reduce((best, claim) =>
    voiderOf(record, claim) >= voiderOf(record, best) ? claim : best,
  );
}

/**
 * The reason line for one row, or nothing where the record has none.
 *
 * A withdrawn record is the one case that does not read its own strikes. Its
 * status line is struck, so what is no longer true is the whole record rather than
 * a claim inside it, and the sentence that says why is the index's — the same
 * sentence the care card above the board prints, which is where it was the only
 * copy until now. There is exactly one such record, and it is the row a reader
 * most needs an answer in.
 */
export function reasonFor(record: DecisionRecord): RowReason | null {
  if (record.standing === 'withdrawn') {
    const note = record.note.trim();
    return note === '' ? null : { lead: '', text: note };
  }
  const claim = newestStrike(record);
  return claim === null ? null : shorten(claim, voiderOf(record, claim));
}
