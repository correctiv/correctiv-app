import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { HOME_LAYOUT_VERSION } from '@correctiv/app-core/lib/home-layout';
import { HOME_LAYOUT_MAX_CHARS } from '@correctiv/app-core/stores/homeLayout';

import { ROOT } from '../plugin/collect.ts';
import { applyIssue, KINDS } from '../scripts/submission-kinds.ts';
import {
  applyHome,
  longestCommonRun,
  plain,
  readSubmission,
  Refusal,
  refusalText,
  summariseHome,
  SUMMARY_MAX,
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

/** The refusal itself, for what it says. */
function refusedWith(run: () => unknown): Refusal {
  try {
    run();
  } catch (error) {
    if (error instanceof Refusal) return error;
    throw error;
  }
  throw new Error('expected a refusal');
}

const EDITED = withHidden(SHIPPED, null, 'hero', true);

describe('reading an issue', () => {
  it('takes the payload out of what the workbench writes, and applies it', () => {
    const { title, body } = issueOf(formatLayoutDocument(EDITED));
    const applied = applyIssue(title, body, { read: () => CURRENT, list: () => [] });
    expect(applied.kind).toBe('home');
    expect(applied.files).toEqual([
      { path: SUBMISSION_KINDS.home.file, content: formatLayoutDocument(EDITED) },
    ]);
    expect(applied.format).toBe(false);
  });

  it('forgives a lead of its own and a pasted body with Windows line ends', () => {
    const { title } = issueOf('');
    const body = `Hallo,\r\nbitte übernehmen.\r\n\r\n\`\`\`json\r\n${formatLayoutDocument(EDITED).replace(/\n/g, '\r\n')}\`\`\`\r\n\r\n`;
    expect(JSON.parse(readSubmission(title, body).payload)).toMatchObject({
      version: HOME_LAYOUT_VERSION,
    });
    // And the block alone, which is what somebody who deleted the lead leaves.
    expect(readSubmission(title, `\`\`\`json\n{}\n\`\`\``).payload).toBe('{}\n');
  });

  /*
   * The shape the workbench writes and nothing else, because a reader that takes any fence
   * and a renderer that shows only some disagree about what the issue says. Each of these
   * was a body the renderer and the first reader read differently, measured with
   * `gh api markdown` in the cold review of #263.
   */
  it('refuses a body that is not the workbench’s shape, wherever the difference is', () => {
    const { title, body } = issueOf(CURRENT);
    const fenced = body.slice(body.indexOf('```'));
    const cases = [
      // A fence inside an attribute renders as nothing, and was read.
      `Harmlos.\n\n<div title="\n\n${fenced}\n">\n</div>\n`,
      `<div title="\n${fenced}">`,
      // An indented fence renders as a block, and was not read.
      `Harmlos.\n\n   ${fenced}`,
      // Prose after the block, which a reader might take for part of the change.
      `${body}\nDanke!`,
      // A backtick or an angle bracket in the lead.
      `Siehe \`x\`.\n\n${fenced}`,
      `Das <b>ist</b> es.\n\n${fenced}`,
      // A lead that runs into the fence without a blank line.
      `Harmlos.\n${fenced}`,
    ];
    for (const hostile of cases)
      expect(refusal(() => readSubmission(title, hostile))).toBe('body-shape');
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

  it('refuses a title without a known prefix, and reads each built kind’s', () => {
    const { body } = issueOf(CURRENT);
    expect(refusal(() => readSubmission('Startseite geändert', body))).toBe('no-kind');
    expect(refusal(() => readSubmission('[irgendwas] Startseite', body))).toBe('no-kind');
    expect(refusal(() => readSubmission(' [startseite] mit Leerzeichen', body))).toBe('no-kind');
    expect(readSubmission(issueOf(CURRENT, 'strings').title, body).kind).toBe('strings');
  });

  it('has a way through for every kind it calls built, and none for a kind it does not', () => {
    for (const kind of Object.keys(SUBMISSION_KINDS) as SubmissionKind[])
      expect(KINDS[kind] !== null).toBe(SUBMISSION_KINDS[kind].built);
  });

  /*
   * GitHub renders nothing of an HTML comment, so a block inside one is a change nobody
   * reading the issue sees, a maintainer deciding about an outsider's issue included.
   */
  it('refuses a body with an HTML comment in it, wherever it stands', () => {
    const { title, body } = issueOf(CURRENT);
    expect(refusal(() => readSubmission(title, `<!-- ${body} -->`))).toBe('hidden-text');
    expect(refusal(() => readSubmission(title, `${body}\n<!-- danke -->`))).toBe('hidden-text');
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
      'hidden-text',
      'not-json',
      'refused',
      'unchanged',
      'not-wordings',
      'texts-too-large',
      'texts-refused',
      'texts-unchanged',
    ];
    for (const code of codes) expect(refusalText(new Refusal(code)).length).toBeGreaterThan(20);
    const refused = refusedWith(() => applyHome('{ "version": 3, "sections": [] }', CURRENT));
    expect(refusalText(refused)).toContain('Genauer:');
  });
});

describe('the summary a reviewer reads', () => {
  it('names a block switched off where the day starts, by the editor’s name for it', () => {
    expect(summariseHome(SHIPPED, EDITED)).toContain(
      '„Aufmacher“ (`hero`) ist zu Tagesbeginn ausgeblendet.',
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
      'Neuer Moment um 18:00: „Spotlight-Briefing“ (`briefing`) ausgeblendet.',
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
    expect(summary).toContain('„Backstage“ (`backstage`) ist entfernt.');
    expect(summary).toContain('„Faktenchecks“ (`fact-checks-2`) ist neu, an Stelle 12 von 12.');
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
      'Neue Ausgabe `Wahlabend` (`wahlabend`), vom 27.09.2026, 18:00 bis 28.09.2026, 02:00 Uhr: „Aufmacher“ (`hero`) ausgeblendet.',
    );
  });

  it('finds the longest run two orders share', () => {
    expect(longestCommonRun(['a', 'b', 'c', 'd'], ['b', 'c', 'a', 'd'])).toEqual(['b', 'c', 'd']);
    expect(longestCommonRun([], ['a'])).toEqual([]);
  });
});

/**
 * The security review of #252, its inputs kept as tests. Each of these got through the first
 * version: text in the document became instructions to GitHub in the pull request's body, a
 * summary outgrew what GitHub accepts as a body, and a home screen showing nothing passed.
 */
describe('what the review of #252 got through', () => {
  /** Every way a body can tell GitHub to do something, or hide what follows. */
  function harmless(markdown: string) {
    expect(markdown).not.toMatch(/#\d/);
    expect(markdown).not.toContain('@correctiv');
    expect(markdown).not.toContain('<!--');
    expect(markdown).not.toMatch(/^\s*(closes|fixes|resolves)\b/im);
  }

  const HOSTILE = 'Hallo\n\nFixes #2 `x` @correctiv/everyone <!-- und der Rest ist weg';

  it('refuses an id that smuggles lines into the body', () => {
    const document = JSON.parse(CURRENT);
    document.editions = [
      {
        id: 'x`\n\nCloses #1\n\n@correctiv/everyone <!--',
        title: HOSTILE,
        from: '2026-09-27T18:00',
        until: '2026-09-28T02:00',
      },
    ];
    expect(refusal(() => applyHome(JSON.stringify(document), CURRENT))).toBe('refused');
    harmless(refusalText(refusedWith(() => applyHome(JSON.stringify(document), CURRENT))));
  });

  it('prints a hostile title, id and pin as inert text on one line', () => {
    const document = JSON.parse(CURRENT);
    document.sections.push({ id: 'Fixes #5 @correctiv/everyone <b>', module: 'callout-teaser' });
    document.sections[3].settings = { pin: 'Closes #3 <!-- https://example.invalid' };
    document.editions = [
      {
        id: 'wahl #6',
        title: HOSTILE,
        from: '2026-09-27T18:00',
        until: '2026-09-28T02:00',
        changes: [{ id: 'hero', hidden: true }],
      },
    ];
    const { summary } = applyHome(JSON.stringify(document), CURRENT);
    harmless(summary);
    for (const line of summary.split('\n').filter((each) => each.startsWith('- ')))
      expect((line.match(/`/g) ?? []).length % 2).toBe(0);
    expect(plain('a\n\nb\tc')).toBe('a b c');
    expect(plain('x'.repeat(200))).toHaveLength(80);
  });

  it('quotes what the JSON parser said about the input inside a code span', () => {
    const text = refusalText(
      refusedWith(() => applyHome('Closes #4 <!-- @correctiv/everyone {', CURRENT)),
    );
    harmless(text);
    expect(text).toMatch(/Genauer: `[^`]*`/);
  });

  it('keeps the summary far under the body GitHub accepts', () => {
    const document = JSON.parse(CURRENT);
    const ids = Array.from({ length: 30 }, (_, index) => `block-${'x'.repeat(60)}-${index}`);
    document.sections.push(...ids.map((id) => ({ id, module: 'callout-teaser' })));
    document.moments = Array.from({ length: 23 }, (_, hour) => ({
      at: `${String(hour + 1).padStart(2, '0')}:00`,
      changes: ids.map((id) => ({ id, hidden: hour % 2 === 0 })),
    }));
    const { summary } = applyHome(JSON.stringify(document), CURRENT);
    expect(summary.length).toBeLessThanOrEqual(SUMMARY_MAX + 1000);
    expect(summary).toMatch(/… und \d+ weitere Änderungen/);
  });

  it('warns in bold when nothing is left to see', () => {
    const allHidden = {
      ...SHIPPED,
      sections: SHIPPED.sections.map((section) => ({ ...section, hidden: true })),
      moments: [],
    };
    expect(summariseHome(SHIPPED, allHidden)).toContain(
      '**Achtung: Die Startseite zeigt zu Tagesbeginn keinen Inhalt.**',
    );
    const onlyHeader = { ...SHIPPED, sections: [SHIPPED.sections[0]], moments: [] };
    const warned = summariseHome(SHIPPED, onlyHeader);
    expect(warned).toContain('keinen Inhalt');
    expect(warned).toContain('**Achtung: Von 12 Blöcken sind nur 1 übrig.**');
    expect(warned.indexOf('Achtung')).toBeLessThan(warned.indexOf('### Was sich'));
    expect(summariseHome(SHIPPED, EDITED)).not.toContain('Achtung');
  });

  it('refuses a module the app cannot draw', () => {
    const document = JSON.parse(CURRENT);
    document.sections.push({ id: 'neu', module: 'no-such-module' });
    expect(refusal(() => applyHome(JSON.stringify(document), CURRENT))).toBe('refused');
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
   * Every `run:`, `script:` and `if:` value, block scalars included, as its lines. A value
   * runs from the key to the first line indented no deeper than the key. Read by hand
   * rather than with a YAML library, because none is a dependency here and this needs
   * only the one shape the file is written in; the floors below are what stop it passing
   * on a file it no longer reads.
   */
  function blocks(): { key: string; body: string[]; at: number }[] {
    const found: { key: string; body: string[]; at: number }[] = [];
    lines.forEach((line, index) => {
      const match = /^(\s*)(?:- )?(run|script|if):\s*(.*)$/.exec(line);
      if (!match) return;
      const indent = match[1].length;
      const body = [match[3]];
      for (const next of lines.slice(index + 1)) {
        if (next.trim() !== '' && next.search(/\S/) <= indent) break;
        body.push(next);
      }
      found.push({ key: match[2], body, at: index });
    });
    return found;
  }

  /** Each step, from its `- name:` to the next one, for the questions asked per step. */
  function steps(): { name: string; text: string }[] {
    const starts = lines
      .map((line, index) => ({ match: /^\s+- name: (.*)$/.exec(line), index }))
      .filter((each) => each.match);
    return starts.map((start, i) => ({
      name: start.match?.[1] ?? '',
      text: lines.slice(start.index, starts[i + 1]?.index ?? lines.length).join('\n'),
    }));
  }

  /*
   * The injection line. `${{ … }}` inside a shell or a script is pasted in before either is
   * parsed, so an issue title can become code. Every value goes through `env:` instead. The
   * rule is stricter than "never the issue's body or title": no expression at all, because
   * a step output carries issue text just as well, and a rule with exceptions is the one
   * somebody extends.
   */
  it('puts no expression inside any run: or script:', () => {
    const found = blocks().filter((block) => block.key !== 'if');
    expect(found.filter((block) => block.key === 'run').length).toBeGreaterThanOrEqual(5);
    expect(found.filter((block) => block.key === 'script').length).toBeGreaterThanOrEqual(5);
    for (const block of found) expect(block.body.join('\n')).not.toContain('${{');
  });

  it('never names the issue’s body, and names its title only where GitHub evaluates it', () => {
    expect(text).not.toMatch(/github\.event\.issue\.body/);
    const inIf = new Set(
      blocks()
        .filter((block) => block.key === 'if')
        .flatMap((block) => block.body.map((_, offset) => block.at + offset)),
    );
    const titled = lines
      .map((line, index) => ({ line, index }))
      .filter(({ line }) => line.includes('github.event.issue.title'));
    expect(titled.length).toBeGreaterThanOrEqual(2);
    for (const { index } of titled) expect(inIf.has(index)).toBe(true);
  });

  it('starts for exactly the kinds that are built, in both jobs and in the first step', () => {
    const built = Object.values(SUBMISSION_KINDS)
      .filter((kind) => kind.built)
      .map((kind) => kind.prefix)
      .sort();
    const gates = blocks().filter(
      (block) => block.key === 'if' && block.body.join(' ').includes('startsWith('),
    );
    expect(gates).toHaveLength(2);
    for (const gate of gates) {
      const prefixes = [
        ...gate.body.join(' ').matchAll(/startsWith\(github\.event\.issue\.title, '([^']+)'\)/g),
      ].map((match) => match[1]);
      expect(prefixes.sort()).toEqual(built);
    }
    const listed = /const PREFIXES = (\[.*\]);/.exec(text)?.[1] ?? '[]';
    expect((JSON.parse(listed.replace(/'/g, '"')) as string[]).sort()).toEqual(built);
  });

  /*
   * The token. An install script is code from the registry; it must not run where a token
   * that can push is lying in `.git/config`, and only the two steps that write to GitHub as
   * the repository get the secret.
   */
  it('keeps the token away from the install and gives it to the push and the pull request only', () => {
    expect(text).toContain('persist-credentials: false');
    expect(text).toMatch(/run: npm ci --ignore-scripts\n/);
    const holding = steps()
      .filter((step) => step.text.includes('secrets.SUBMISSIONS_TOKEN'))
      .map((step) => step.name);
    expect(holding).toEqual(['Push the branch', 'Open or update the pull request']);
  });

  it('pins every action by commit, with its version beside it', () => {
    const uses = lines.filter((line) => /^\s+(?:- )?uses: /.test(line));
    expect(uses.length).toBeGreaterThanOrEqual(5);
    for (const line of uses) expect(line).toMatch(/uses: [\w.-]+\/[\w.-]+@[0-9a-f]{40} # v\d/);
  });

  it('asks a dispatch for the text it was started for, and comments on an outsider once', () => {
    expect(text).toMatch(/text_sha256:\n\s+description: .*\n\s+required: true/);
    // The number is a number, so that "05" and "5" are one concurrency group.
    expect(text).toMatch(
      /issue:\n\s+description: .*\n\s+required: true\n(\s+#.*\n)*\s+type: number/,
    );
    expect(text).not.toMatch(/body_sha256|body-sha256/);
    // The outsider's job reads one file of the repository and writes comments, nothing else.
    expect(text).toMatch(
      /outsider:[\s\S]*?permissions:\n\s+contents: read\n\s+issues: write\n\s+steps:/,
    );
    expect(text).toContain('sparse-checkout: apps/workbench/scripts/submission-quote.mjs');
    expect(text).toContain('quote.quoteComment(');
    // A dispatch runs the text the automation quoted, never the issue as it is by then.
    const read = steps().find((step) => step.name === 'Read the issue')!.text;
    expect(read).toContain('text = quote.approved(comments, process.env.EXPECTED_SHA);');
    expect(read).toMatch(
      /if \(dispatched\) \{[\s\S]*?quote\.approved[\s\S]*?\} else \{[\s\S]*?getCollaboratorPermissionLevel/,
    );
    expect(read).toContain("permission !== 'admin' && permission !== 'write'");
    // The failure comment carries no value to start a run with.
    const failure = steps().find((step) => step.name === 'Say why there is no pull request')!.text;
    expect(failure).not.toMatch(/sha256/i);
  });

  it('hands the push its token in git’s environment, never in the address', () => {
    const push = steps().find((step) => step.name === 'Push the branch')!.text;
    expect(push).not.toMatch(/x-access-token:\$\{?TOKEN\}?@/);
    expect(push).toContain('GIT_CONFIG_KEY_0=http.https://github.com/.extraheader');
    expect(push).toContain('echo "::add-mask::$BASIC"');
    expect(push).toMatch(/git push --force "https:\/\/github\.com\/\$\{GITHUB_REPOSITORY\}\.git"/);
  });

  /*
   * The allow-list (ADR 0062 §2). The commit may only carry what the proof listed, the
   * proof runs for every kind and before the commit, and nothing else in the file stages a
   * change. A second `git add` would be a way round the proof that reads like tidying up.
   */
  it('commits only what the proof listed, and proves before it commits', () => {
    const names = steps().map((step) => step.name);
    const write = names.indexOf('Write the files from the issue');
    const prove = names.indexOf('Prove the tree');
    const commit = names.indexOf('Commit as the person who opened the issue');
    expect(write).toBeGreaterThanOrEqual(0);
    expect(prove).toBeGreaterThan(write);
    expect(commit).toBeGreaterThan(prove);

    const proof = steps()[prove]!.text;
    expect(proof).toContain('apps/workbench/scripts/submission-verify.ts');
    expect(proof).toContain('"$RUNNER_TEMP/submission-files.txt"');
    expect(proof).not.toMatch(/^\s+(if|continue-on-error):/m);
    expect(text).not.toMatch(/continue-on-error/);

    const code = lines.filter((line) => !line.trim().startsWith('#'));
    const adds = code.filter((line) => /\bgit\b.*\badd\b/.test(line));
    expect(adds).toEqual([expect.stringContaining('git --literal-pathspecs add \\')]);
    expect(steps()[commit]!.text).toContain(
      '--pathspec-from-file="$RUNNER_TEMP/submission-files.txt" --pathspec-file-nul',
    );
    expect(code.join('\n')).not.toMatch(/git (add|commit) (-A|--all|-a|\.)/);
    // The one-file assertion in shell is gone, and nothing takes a file name from an output.
    expect(text).not.toMatch(/outputs\.file\b/);
  });

  it('checks each built kind’s files by that kind’s own checks', () => {
    const built = (Object.keys(SUBMISSION_KINDS) as SubmissionKind[]).filter(
      (kind) => SUBMISSION_KINDS[kind].built,
    );
    for (const kind of built) expect(text).toContain(`if: steps.apply.outputs.kind == '${kind}'`);
    const texts = steps().find((step) => step.name === 'Check the written texts')!.text;
    expect(texts).toContain('npx oxfmt --check');
    expect(texts).toContain('npm test -w @correctiv/catalogue');
  });

  it('closes the issue with the English keyword on a line of its own', () => {
    expect(text).toContain('`Closes #${ISSUE}`');
  });
});
