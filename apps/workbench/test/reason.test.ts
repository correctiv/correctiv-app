import { describe, expect, it } from 'vitest';

import { collectDocs } from '../plugin/collect.ts';
import type { DecisionRecord } from '../plugin/decisions.ts';
import type { RetiredClaim } from '../plugin/markdown.ts';
import { newestStrike, reasonFor, shorten, spaced } from '../src/lib/reason.ts';

const RECORDS: DecisionRecord[] = collectDocs().module.decisions;

/** A record with only the two fields this rule reads, so a case is legible. */
const fixture = (number: string, struck: RetiredClaim[]): DecisionRecord => ({
  number,
  struck,
  route: `/adr/${number}`,
  title: 'a decision',
  date: '2026-09-16',
  status: 'accepted',
  standing: 'partly-struck',
  note: 'a sentence from the index',
  caveats: [],
  voidedBy: [],
  voids: [],
});
const BY_NUMBER = new Map(RECORDS.map((record) => [record.number, record]));
const record = (number: string) => BY_NUMBER.get(number) as DecisionRecord;
const line = (number: string) => {
  const reason = reasonFor(record(number));
  if (reason === null) return null;
  return reason.lead === ''
    ? reason.text
    : `${reason.lead}${spaced(reason.text) ? ' ' : ''}${reason.text}`;
};

/**
 * The rule the board's one line of *why* is cut by.
 *
 * It exists because the clauses are longer and messier than a board row: a couple
 * of hundred characters at the median, and a fifth of them fragments that only read
 * attached to the text they struck. A `slice(0, 120)` over that data produces
 * `, and from step 2 of the onboarding` in a column, which is worse than the count
 * it replaced, and nothing about a green build would say so. `src/lib/reason.ts`
 * carries the measurement with the day it was taken.
 *
 * Both halves are checked: the rule against clauses written here, so a change to
 * it fails on a case a reader can see; and the rule against every record in the
 * repository, so a clause written tomorrow that the rule mishandles fails too.
 */
describe('the clause a board row shows', () => {
  it('shows a clause that opens a sentence on its own', () => {
    expect(
      shorten({ claim: 'the old thing', clause: 'Voided by ADR 0099: it moved.', by: [] }),
    ).toEqual({ lead: '', text: 'Voided by ADR 0099: it moved.' });
  });

  it('shows a clause that does not behind the text it struck', () => {
    expect(
      shorten({ claim: 'synchronously', clause: 'asynchronously since 0009', by: [] }),
    ).toEqual({ lead: 'synchronously', text: 'asynchronously since 0009' });
  });

  /**
   * The case this rule exists for.
   *
   * A clause opening with a connective is the majority of the fragments, and it
   * is the one that reads as noise alone: `, and from step 2 of the onboarding a
   * "Überspringen"` says nothing without the sentence it continues.
   */
  it('keeps the connective, because it is the join', () => {
    const reason = shorten({
      claim: 'a "Weiter" beside it',
      clause: ', and from step 2 of the onboarding a "Überspringen".',
      by: [],
    });
    expect(reason?.lead).toBe('a "Weiter" beside it');
    expect(reason?.text.startsWith(',')).toBe(true);
    expect(spaced(reason?.text ?? '')).toBe(false);
  });

  it('carries only the end of a long struck claim, which is where the clause joins', () => {
    const reason = shorten({
      claim:
        'this app sets headerShown: false throughout and builds its own header rows, so that iOS, Android and web show the same brand',
      clause: '— that premise is voided by ADR 0030.',
      by: ['0030'],
    });
    expect(reason?.lead).toBe('…web show the same brand');
  });

  /**
   * A stop inside a path or a version is not the end of a sentence.
   *
   * This is the assertion that catches a naive `split('.')`, and the clauses are
   * full of the cases: `create-store.ts, added shortly after`, `49 in
   * apps/mobile/src. Nothing voided the figure`, `@rozenite/metro 2.4.0`.
   */
  it('ends a sentence at a stop followed by a capital, and nowhere else', () => {
    expect(
      shorten({
        claim: 'a claim',
        clause: 'Struck on 2026-09-15: 49 in apps/mobile/src. Nothing voided the figure.',
        by: [],
      })?.text,
    ).toBe('Struck on 2026-09-15: 49 in apps/mobile/src.');
    expect(
      shorten({ claim: 'a claim', clause: 'It ran on create-store.ts, added later.', by: [] })
        ?.text,
    ).toBe('It ran on create-store.ts, added later.');
  });

  /**
   * `Done.` is a lead-in and not a reason, and the rule above is what keeps it
   * attached to the sentence that is one: the stop is followed by `.github`, not
   * by a capital.
   */
  it('does not leave a one-word lead-in standing as the reason', () => {
    expect(
      shorten({
        claim: 'a claim',
        clause: 'Done. .github/workflows/pages.yml builds the export. The rest is manual.',
        by: [],
      })?.text,
    ).toBe('Done. .github/workflows/pages.yml builds the export.');
  });

  it('takes the sentence that names the record which struck it', () => {
    expect(
      shorten(
        {
          claim: 'a claim',
          clause: 'If the answer is no, this flow leaves. Answered by ADR 0020: it was no.',
          by: ['0020'],
        },
        '0020',
      ),
    ).toEqual({ lead: '', text: 'Answered by ADR 0020: it was no.' });
  });

  it('drops the stop left behind by a strike inside a sentence', () => {
    expect(shorten({ claim: 'a claim', clause: '. The profile prints it.', by: [] })).toEqual({
      lead: '',
      text: 'The profile prints it.',
    });
  });

  it('ends no line on a colon, which promises something the row does not show', () => {
    expect(shorten({ claim: 'a claim', clause: 'A fifth was added by 0032:', by: [] })?.text).toBe(
      'A fifth was added by 0032',
    );
  });

  it('shows nothing for a strike with no clause', () => {
    expect(shorten({ claim: 'a claim', clause: '', by: [] })).toBeNull();
    expect(shorten({ claim: 'a claim', clause: ' — ', by: [] })).toBeNull();
  });
});

describe('the strike a row speaks for', () => {
  it('is the one naming the highest record number', () => {
    const chosen = newestStrike(
      fixture('0004', [
        { claim: 'first', clause: 'Voided by ADR 0009.', by: ['0009'] },
        { claim: 'second', clause: 'Voided by ADR 0030.', by: ['0030'] },
        { claim: 'third', clause: 'Re-measured since.', by: [] },
      ]),
    );
    expect(chosen?.claim).toBe('second');
  });

  it('is the last the record writes, where none names a later one', () => {
    const chosen = newestStrike(
      fixture('0022', [
        { claim: 'first', clause: 'Re-measured on Monday.', by: [] },
        { claim: 'second', clause: 'Re-measured on Friday.', by: [] },
      ]),
    );
    expect(chosen?.claim).toBe('second');
  });

  it('ignores a record number a clause names that is older than the record itself', () => {
    // ADR 0026 strikes a claim of its own with a clause naming ADR 0006, which is
    // the record it struck a claim IN. `voidedBy` filters those out and so does
    // this, or a row would call its own descendant its voider.
    const chosen = newestStrike(
      fixture('0026', [
        { claim: 'first', clause: 'Two cells in ADR 0006.', by: ['0006'] },
        { claim: 'second', clause: 'Landed since.', by: [] },
      ]),
    );
    expect(chosen?.claim).toBe('second');
  });

  it('skips a strike with no clause and speaks for one that has one', () => {
    const chosen = newestStrike(
      fixture('0018', [
        { claim: 'first', clause: 'Retired by ADR 0019.', by: ['0019'] },
        { claim: 'second', clause: '', by: ['0020'] },
      ]),
    );
    expect(chosen?.claim).toBe('first');
  });
});

describe('every record in this repository, read through that rule', () => {
  const withReason = RECORDS.filter((r) => reasonFor(r) !== null);

  it('gives a line to every record that has a strike with a clause', () => {
    const silent = RECORDS.filter(
      (r) => reasonFor(r) === null && r.struck.some((claim) => claim.clause.trim() !== ''),
    );
    expect(silent.map((r) => r.number)).toEqual([]);
    expect(withReason.length).toBeGreaterThan(10);
  });

  it('gives no line to a record that struck nothing', () => {
    expect(withReason.filter((r) => r.standing === 'stands').map((r) => r.number)).toEqual([]);
  });

  /**
   * The assertion the whole rule is for.
   *
   * A line that opens lowercase, or on a comma or a dash, is a fragment of
   * somebody else's sentence. It is allowed exactly where the text it continues is
   * printed in front of it, and nowhere else.
   */
  it('leaves no line opening as a fragment of a sentence nobody can see', () => {
    const orphans = withReason.filter((r) => {
      const reason = reasonFor(r);
      return reason !== null && reason.lead === '' && !/^[("'„“«]{0,2}[A-ZÄÖÜ]/.test(reason.text);
    });
    // The index's own sentence about the withdrawn record is written lowercase,
    // and it is the one line here that is not a clause.
    expect(orphans.map((r) => r.number)).toEqual(['0002']);
  });

  it('shows the struck text only where the clause needs it, never as the whole line', () => {
    const reasons = withReason.map((r) => reasonFor(r));
    expect(reasons.filter((reason) => reason?.lead !== '').length).toBeGreaterThan(0);
    expect(reasons.filter((reason) => reason?.text.trim() === '')).toEqual([]);
    expect(reasons.filter((reason) => (reason?.lead.length ?? 0) > 49)).toEqual([]);
  });

  it('shows a clause the record actually wrote, not one assembled here', () => {
    const invented = withReason
      .filter((r) => r.standing !== 'withdrawn')
      .filter((r) => {
        const reason = reasonFor(r);
        return reason === null || !r.struck.some((claim) => claim.clause.includes(reason.text));
      });
    expect(invented.map((r) => r.number)).toEqual([]);
  });

  /**
   * Issue #166's four wants, each on the record that makes it visible, so a
   * change that quietly drops one fails rather than merely looking different.
   */
  it('gives the withdrawn record its reason, which is the index sentence', () => {
    const withdrawn = RECORDS.filter((r) => r.standing === 'withdrawn');
    expect(withdrawn.map((r) => r.number)).toEqual(['0002']);
    expect(line('0002')).toBe(withdrawn[0].note);
  });

  it('gives a record with one strike the clause of that strike', () => {
    expect(line('0030')).toBe(
      "False, and corrected here rather than struck elsewhere, because it is this record's own claim.",
    );
  });

  it('gives a record with several the clause of the newest, which is its last chip', () => {
    expect(record('0014').voidedBy).toEqual(['0024']);
    expect(line('0014')).toBe(
      'Voided by ADR 0024: the workflow asserts nothing about a shell inside the export.',
    );
  });

  it('gives a record whose strikes name nobody the clause, which is all there is', () => {
    expect(record('0022').voidedBy).toEqual([]);
    expect(line('0022')).toBe(
      'Struck again on 2026-09-15, six days after that correction and by the same failure: five, not two.',
    );
  });

  it('repairs the lead where the newest clause is a fragment', () => {
    expect(line('0025')).toBe(
      'so it was not kept — re-measured on 2026-09-10 it moves both, and the route field has driven the router since.',
    );
  });
});
