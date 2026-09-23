import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { HOME_LAYOUT_MAX_CHARS } from '@correctiv/app-core/stores/homeLayout';

import { ROOT } from '../plugin/collect.ts';
import {
  applyHome,
  applyIssue,
  longestCommonRun,
  readSubmission,
  Refusal,
  refusalText,
  summariseHome,
  type RefusalCode,
} from '../scripts/submission.ts';
import {
  formatLayoutDocument,
  moved,
  SHIPPED,
  withHidden,
  withMoment,
  withSetting,
} from '../src/preview/home/document';
import { issueFor, SUBMISSION_KINDS, type SubmissionKind } from '../src/preview/submission';

/**
 * ADR 0061: an issue in, one file and a German summary out, or a reason the person can act
 * on. The issue is text anybody can write, so most of this is about what is refused.
 */

const CURRENT = formatLayoutDocument(SHIPPED);
const LEAD = { heading: 'Änderungen an der Startseite', lead: 'Aus der Workbench.' };

/** What the workbench opens, for a given document. */
function issueOf(document: string, kind: SubmissionKind = 'home') {
  return issueFor(kind, document, LEAD);
}

function refusal(run: () => unknown): RefusalCode {
  try {
    run();
  } catch (error) {
    if (error instanceof Refusal) return error.code;
    throw error;
  }
  throw new Error('expected a refusal');
}

const EDITED = withHidden(SHIPPED, null, 'hero', true);

describe('reading an issue', () => {
  it('takes the payload out of what the workbench writes, and applies it', () => {
    const { title, body } = issueOf(formatLayoutDocument(EDITED));
    const applied = applyIssue(title, body, () => CURRENT);
    expect(applied.kind).toBe('home');
    expect(applied.file).toBe(SUBMISSION_KINDS.home.file);
    expect(applied.content).toBe(formatLayoutDocument(EDITED));
  });

  it('forgives prose around the block and a pasted body with Windows line ends', () => {
    const { title } = issueOf('');
    const body = `Hallo,\r\n\r\n\`\`\`json\r\n${formatLayoutDocument(EDITED).replace(/\n/g, '\r\n')}\`\`\`\r\n\r\nDanke`;
    expect(JSON.parse(readSubmission(title, body).payload)).toMatchObject({ version: 3 });
  });

  it('refuses a body without the block', () => {
    const { title } = issueOf('');
    expect(refusal(() => readSubmission(title, 'Bitte einfügen.'))).toBe('no-block');
    // An opening with no closing fence is no block either.
    expect(refusal(() => readSubmission(title, '```json\n{}\n'))).toBe('no-block');
  });

  it('refuses two blocks rather than choosing one', () => {
    const { title, body } = issueOf(CURRENT);
    expect(refusal(() => readSubmission(title, `${body}\n${body}`))).toBe('several-blocks');
  });

  it('refuses a title without a known prefix, and a kind that is named and not built', () => {
    const { body } = issueOf(CURRENT);
    expect(refusal(() => readSubmission('Startseite geändert', body))).toBe('no-kind');
    expect(refusal(() => readSubmission('[irgendwas] Startseite', body))).toBe('no-kind');
    expect(refusal(() => readSubmission(issueOf(CURRENT, 'strings').title, body))).toBe(
      'kind-not-built',
    );
  });

  it('refuses a payload larger than the app itself would read', () => {
    const { title, body } = issueOf(`"${'x'.repeat(HOME_LAYOUT_MAX_CHARS)}"`);
    expect(refusal(() => readSubmission(title, body))).toBe('too-large');
    expect(refusal(() => readSubmission(title, 'x'.repeat(HOME_LAYOUT_MAX_CHARS * 2 + 1)))).toBe(
      'too-large',
    );
  });

  it('refuses a block that is not JSON, and one the core’s parser refuses', () => {
    expect(refusal(() => applyHome('{ "version": 3, ', CURRENT))).toBe('not-json');
    expect(refusal(() => applyHome('{ "version": 3, "sections": [] }', CURRENT))).toBe('refused');
    const badTime = JSON.stringify({
      ...JSON.parse(CURRENT),
      moments: [{ at: '25:00', changes: [] }],
    });
    expect(refusal(() => applyHome(badTime, CURRENT))).toBe('refused');
  });

  it('refuses a submission that changes nothing', () => {
    expect(refusal(() => applyHome(CURRENT, CURRENT))).toBe('unchanged');
  });

  it('writes what the parser read, printed again, and not what arrived', () => {
    const squashed = JSON.stringify(JSON.parse(formatLayoutDocument(EDITED)));
    expect(applyHome(squashed, CURRENT).content).toBe(formatLayoutDocument(EDITED));
    // A key the parser does not know is left behind rather than committed.
    const extra = JSON.stringify({ ...JSON.parse(formatLayoutDocument(EDITED)), extra: true });
    expect(applyHome(extra, CURRENT).content).not.toContain('extra');
  });

  it('has a German sentence for every refusal, and the parser’s codes where it gave some', () => {
    const codes: RefusalCode[] = [
      'no-kind',
      'kind-not-built',
      'too-large',
      'no-block',
      'several-blocks',
      'not-json',
      'refused',
      'unchanged',
    ];
    for (const code of codes) expect(refusalText(new Refusal(code)).length).toBeGreaterThan(20);
    const refused = (() => {
      try {
        applyHome('{ "version": 3, "sections": [] }', CURRENT);
      } catch (error) {
        return error as Refusal;
      }
      throw new Error('expected a refusal');
    })();
    expect(refusalText(refused)).toContain('Genauer:');
  });
});

describe('the summary a reviewer reads', () => {
  it('names a block switched off where the day starts, by the editor’s name for it', () => {
    expect(summariseHome(SHIPPED, EDITED)).toContain(
      '„Aufmacher (hero)“ ist zu Tagesbeginn ausgeblendet.',
    );
  });

  it('names the block that was moved, and not every block it pushed along', () => {
    const after = moved(SHIPPED, 'impact', -5);
    const summary = summariseHome(SHIPPED, after);
    const lines = summary.split('\n').filter((line) => line.startsWith('- '));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('ist verschoben, jetzt an Stelle 7 von 12.');
  });

  it('says what a pin is, by the article’s title', () => {
    const after = withSetting(
      SHIPPED,
      null,
      'hero',
      'pin',
      'https://correctiv.org/faktencheck/2026/08/11/keine-ki-foto-von-voigt-kretschmer-und-schulze-ist-echt/',
    );
    expect(summariseHome(SHIPPED, after)).toContain(
      'ist jetzt „Keine KI: Foto von Voigt, Kretschmer und Schulze ist echt“, vorher nichts angepinnt.',
    );
  });

  it('names a new moment and what it does', () => {
    const at = 18 * 60;
    const after = withHidden(withMoment(SHIPPED, at), at, 'briefing', true);
    expect(summariseHome(SHIPPED, after)).toContain(
      'Neuer Moment um 18:00: „Spotlight-Briefing (briefing)“ ausgeblendet.',
    );
  });

  it('names a block added and one taken away', () => {
    const after = {
      ...SHIPPED,
      sections: [
        ...SHIPPED.sections.filter((section) => section.id !== 'backstage'),
        { id: 'fact-checks-2', module: 'faktencheck-rail' },
      ],
    };
    const summary = summariseHome(SHIPPED, after);
    expect(summary).toContain('„Backstage (backstage)“ ist entfernt.');
    expect(summary).toContain('„Faktenchecks (fact-checks-2)“ ist neu, an Stelle 12 von 12.');
  });

  it('names an edition added, with its span', () => {
    const edition = JSON.parse(CURRENT);
    edition.editions = [
      {
        id: 'wahlabend',
        title: 'Wahlabend',
        from: '2026-09-27T18:00',
        until: '2026-09-28T02:00',
        changes: [{ id: 'hero', hidden: true }],
      },
    ];
    const applied = applyHome(JSON.stringify(edition), CURRENT);
    expect(applied.summary).toContain(
      'Neue Ausgabe „Wahlabend“ (wahlabend), vom 27.09.2026, 18:00 bis 28.09.2026, 02:00 Uhr: „Aufmacher (hero)“ ausgeblendet.',
    );
  });

  it('finds the longest run two orders share', () => {
    expect(longestCommonRun(['a', 'b', 'c', 'd'], ['b', 'c', 'a', 'd'])).toEqual(['b', 'c', 'd']);
    expect(longestCommonRun([], ['a'])).toEqual([]);
  });
});

/**
 * The workflow, read as text. Two things are held here, and each is the kind of mistake
 * that looks right in review.
 */
describe('.github/workflows/submission.yml', () => {
  const text = readFileSync(join(ROOT, '.github/workflows/submission.yml'), 'utf8');
  const lines = text.split('\n');

  /**
   * Every `run:` and `script:` block scalar, as its lines. A block runs from the key to the
   * first line indented no deeper than the key. Read by hand rather than with a YAML
   * library, because none is a dependency here and this needs only the one shape the file
   * is written in; the floor below is what stops it passing on a file it no longer reads.
   */
  function blocks(): { key: string; body: string[] }[] {
    const found: { key: string; body: string[] }[] = [];
    lines.forEach((line, index) => {
      const match = /^(\s*)(?:- )?(run|script):\s*(.*)$/.exec(line);
      if (!match) return;
      const indent = match[1].length;
      const body = [match[3]];
      for (const next of lines.slice(index + 1)) {
        if (next.trim() !== '' && next.search(/\S/) <= indent) break;
        body.push(next);
      }
      found.push({ key: match[2], body });
    });
    return found;
  }

  /*
   * The injection line. `${{ … }}` inside a shell or a script is pasted in before either is
   * parsed, so an issue title can become code. Every value goes through `env:` instead. The
   * rule is stricter than "never the issue's body or title": no expression at all, because
   * a step output carries issue text just as well, and a rule with exceptions is the one
   * somebody extends.
   */
  it('puts no expression inside any run: or script:', () => {
    const found = blocks();
    expect(found.filter((block) => block.key === 'run').length).toBeGreaterThanOrEqual(5);
    expect(found.filter((block) => block.key === 'script').length).toBeGreaterThanOrEqual(4);
    for (const block of found) expect(block.body.join('\n')).not.toContain('${{');
  });

  it('never names the issue’s body, and names its title only where GitHub evaluates it', () => {
    expect(text).not.toMatch(/github\.event\.issue\.body/);
    const titled = lines.filter((line) => line.includes('github.event.issue.title'));
    expect(titled.length).toBeGreaterThan(0);
    for (const line of titled) expect(line.trim()).toMatch(/^if: /);
  });

  it('starts for exactly the kinds that are built', () => {
    const gate = lines.find((line) =>
      /^\s+if: github\.event_name == 'workflow_dispatch'/.test(line),
    );
    const prefixes = [
      ...(gate ?? '').matchAll(/startsWith\(github\.event\.issue\.title, '([^']+)'\)/g),
    ].map((match) => match[1]);
    const built = Object.values(SUBMISSION_KINDS)
      .filter((kind) => kind.built)
      .map((kind) => kind.prefix);
    expect(prefixes.sort()).toEqual([...built].sort());
  });

  it('closes the issue with the English keyword on a line of its own', () => {
    expect(text).toContain('`Closes #${ISSUE}`');
  });
});
